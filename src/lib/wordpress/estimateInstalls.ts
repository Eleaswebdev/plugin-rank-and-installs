import { RankedPlugin, InstallEstimateMeta, PluginEstimateResponse } from './types';
import { getBracketUpperBound } from './brackets';
import { scrapePopularPlugins } from './scrapePopularPlugins';
import { scrapePluginTracker } from './scrapePluginTracker';
import { parseInstalls } from './parseInstalls';
import axios from 'axios';

/**
 * Core estimation logic.
 */
export async function estimateInstalls(slug: string): Promise<PluginEstimateResponse> {
  // 1. Fetch basic plugin data from WP API
  let officialData: any = null;
  try {
    const apiRes = await axios.get(`https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=${slug}`);
    officialData = apiRes.data;
  } catch (e) {
    console.error("Failed to fetch official API data", e);
  }

  const officialBucketLabel = String(officialData?.active_installs || "0+");
  const officialBucketValue = parseInstalls(officialBucketLabel);
  const name = officialData?.name || slug;
  
  // 2. Try to find in WP.org Popular (first 5 pages / 100 plugins)
  let { rankedPlugins, targetPlugin } = await scrapePopularPlugins(slug, 5);
  let source = "WordPress.org Popular";

  // 3. ALWAYS try PluginTracker for more precise data if available
  const ptResult = await scrapePluginTracker(slug);
  if (ptResult.targetPlugin) {
    // If we found it on PluginTracker, we use their data as it's often more accurate
    // and provides a more precise estimate base.
    if (!targetPlugin || ptResult.targetPlugin.rank < 500) {
      rankedPlugins = ptResult.rankedPlugins;
      targetPlugin = ptResult.targetPlugin;
      source = "PluginTracker.io";
    }
  }

  if (!targetPlugin) {
    return {
      slug,
      name,
      active_installs: officialBucketLabel,
      activeInstallsParsed: officialBucketValue,
      estimatedInstalls: null,
      installEstimateMeta: null
    };
  }

  // 4. Determine the bracket to use. 
  // We prioritize the official API bucket as the source of truth for the bracket.
  let bracketLowerBound = officialBucketValue;
  
  // If the scraper found a valid bracket that is close to the official one, use it.
  if (targetPlugin.activeInstalls > 0) {
    const ratio = targetPlugin.activeInstalls / officialBucketValue;
    if (officialBucketValue === 0 || (ratio > 0.5 && ratio < 2)) {
      bracketLowerBound = targetPlugin.activeInstalls;
    }
  }
  
  const bracketUpperBound = getBracketUpperBound(bracketLowerBound);
  const rank = targetPlugin.rank;
  
  // 5. If PluginTracker provided a precise estimate, use it as a strong hint
  if (targetPlugin.ptEstimate) {
    // We trust PluginTracker's precise estimate if it's "sane" relative to the official bucket
    // (within 50% margin to account for data lag/updates)
    const lowerLimit = bracketLowerBound * 0.5;
    const upperLimit = bracketUpperBound * 1.5;

    if (targetPlugin.ptEstimate >= lowerLimit && targetPlugin.ptEstimate <= upperLimit) {
      const meta: InstallEstimateMeta = {
        rank,
        nextBracketRank: -1,
        previousBracketRank: -1,
        bracketLowerBound,
        bracketUpperBound,
        bracketSize: bracketUpperBound - bracketLowerBound,
        pluginsInBracket: -1,
        installsPerRank: -1,
        distanceFromUpper: -1,
        confidence: "estimated",
        reason: `Precise estimate from ${source}.`
      };

      return {
        slug,
        name,
        active_installs: officialBucketLabel,
        activeInstallsParsed: officialBucketValue,
        estimatedInstalls: targetPlugin.ptEstimate,
        trend: targetPlugin.trend,
        installEstimateMeta: meta
      };
    }
  }

  // 6. Fallback to interpolation if no precise estimate
  // Find all plugins in the same bracket to determine the rank range
  const sameBracketPlugins = rankedPlugins.filter(p => p.activeInstalls === bracketLowerBound);
  
  let nextBracketRank: number;
  let previousBracketRank: number;

  if (sameBracketPlugins.length >= 2) {
    // If we have multiple plugins in the same bracket, use them to define the range
    nextBracketRank = sameBracketPlugins[0].rank - 1;
    previousBracketRank = sameBracketPlugins[sameBracketPlugins.length - 1].rank;
  } else {
    // Fallback to transition points if we don't have enough same-bracket plugins
    const lastAbove = [...rankedPlugins].reverse().find(p => p.activeInstalls >= bracketUpperBound);
    nextBracketRank = lastAbove ? lastAbove.rank : Math.max(0, rank - 100); // Use a wider default range

    const firstBelow = rankedPlugins.find(p => p.activeInstalls > 0 && p.activeInstalls < bracketLowerBound);
    previousBracketRank = firstBelow ? firstBelow.rank - 1 : Math.max(rank + 100, rankedPlugins[rankedPlugins.length - 1].rank);
  }

  const bracketSize = bracketUpperBound - bracketLowerBound;
  // If we only have one plugin in the bracket, we can't interpolate accurately,
  // so we assume a typical bracket size for this rank range.
  const pluginsInBracket = Math.max(20, previousBracketRank - nextBracketRank);
  
  // Linear interpolation
  const installsPerRank = bracketSize / pluginsInBracket;
  const distanceFromUpper = Math.max(0, rank - nextBracketRank);
  
  let estimatedInstalls = Math.round(bracketUpperBound - (distanceFromUpper * installsPerRank));
  
  // Clamp to bracket
  estimatedInstalls = Math.max(bracketLowerBound, Math.min(bracketUpperBound, estimatedInstalls));

  const meta: InstallEstimateMeta = {
    rank,
    nextBracketRank,
    previousBracketRank,
    bracketLowerBound,
    bracketUpperBound,
    bracketSize,
    pluginsInBracket,
    installsPerRank,
    distanceFromUpper,
    confidence: "estimated",
    reason: `Estimated using ${source} rankings.`
  };

  return {
    slug,
    name,
    active_installs: officialBucketLabel,
    activeInstallsParsed: officialBucketValue,
    estimatedInstalls,
    trend: targetPlugin.trend,
    installEstimateMeta: meta
  };
}
