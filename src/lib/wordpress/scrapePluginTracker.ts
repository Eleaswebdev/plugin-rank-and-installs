import axios from 'axios';
import * as cheerio from 'cheerio';
import { RankedPlugin } from './types';
import { parseInstalls } from './parseInstalls';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Fetches precise data from the plugin's detail page.
 */
async function fetchPluginDetail(slug: string): Promise<{ ptEstimate: number | null, trend: string | null }> {
  try {
    const url = `https://plugintracker.io/plugins/${slug}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    
    let ptEstimate: number | null = null;
    let trend: string | null = null;

    // On the detail page, the precise estimate is often in a specific header or large text element
    $('div, span, p, h1, h2, td').each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      
      // Look for trend
      if (!trend && (text.includes('↑') || text.includes('↓'))) {
        const trendMatch = text.match(/(\(?[↑↓][^)]*\)?)/);
        if (trendMatch) trend = trendMatch[0];
      }

      // Look for precise estimate
      // We look for numbers that have commas or are just large digits
      // But we avoid things that look like dates or versions
      const cleanText = text.replace(/[,]/g, '');
      if (/^\d+$/.test(cleanText)) {
        const val = parseInt(cleanText, 10);
        if (val > 1000) {
          // If we find multiple, we usually want the largest one that isn't a round bucket
          // (round buckets like 1000000 are less likely to be the "precise" estimate)
          if (!ptEstimate || (val > ptEstimate && val % 1000 !== 0)) {
            ptEstimate = val;
          } else if (!ptEstimate) {
            ptEstimate = val;
          }
        }
      } else if (/^\d+(\.\d+)?[MK]$/i.test(cleanText)) {
         // Handle 1.9M etc
         const val = parseInstalls(text);
         if (val > 1000 && (!ptEstimate || val > ptEstimate)) {
           ptEstimate = val;
         }
      }
    });

    return { ptEstimate, trend };
  } catch (e) {
    console.error(`Failed to fetch detail for ${slug}`, e);
    return { ptEstimate: null, trend: null };
  }
}

/**
 * Helper to parse rows from the grid layout.
 */
function parseRows(
  $: cheerio.CheerioAPI, 
  targetSlug: string, 
  allRankedPlugins: RankedPlugin[],
  onTargetFound: (p: RankedPlugin) => void
): boolean {
  // Try both grid and table layouts
  const rows = $('div.grid.grid-cols-1.md\\:grid-cols-12, table tr, div.flex.flex-row.border-b');
  let found = false;

  rows.each((_, row) => {
    const $row = $(row);
    
    // Find the link to get the slug
    const $link = $row.find('a[href*="/plugins/"]').first();
    const href = $link.attr('href') || '';
    const slug = href.split('/').filter(Boolean).pop() || '';
    
    if (!slug) return;

    // Extract Rank: Look for the # symbol or a number in a specific column
    let rankText = $row.find('span:contains("#"), td:first-child').first().text().trim();
    if (!rankText && $row.find('div:first-child').text().includes('#')) {
      rankText = $row.find('div:first-child').text().trim();
    }
    const rank = parseInt(rankText.replace(/[#,]/g, ''), 10);
    
    if (isNaN(rank)) return;

    // Extract Name
    const name = $row.find('h3, span.font-semibold, td:nth-child(2) a').first().text().trim();
    
    // Extract all text parts from the row to find the data
    const textParts: string[] = [];
    $row.find('span, div, p, h3, td').each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, ' ');
      if (t) textParts.push(t);
    });

    let installsLabel = '';
    let ptEstimateLabel = '';
    let trendLabel = '';
    
    for (const s of textParts) {
      const lower = s.toLowerCase();
      
      // 1. Look for the official bucket (e.g., "300,000+")
      if (s.includes('+') && !lower.includes('ago') && !lower.includes('updated')) {
        installsLabel = s;
        continue;
      }
      
      // 2. Look for trend (e.g., "↑1,786")
      if (s.includes('↑') || s.includes('↓')) {
        const trendMatch = s.match(/(\(?[↑↓][^)]*\)?)/);
        if (trendMatch) {
          trendLabel = trendMatch[0];
          // Check if the rest of the string is the precise estimate
          const rest = s.replace(trendMatch[0], '').replace(/[()]/g, '').trim();
          if (rest && /^\d+([,.]\d+)*$/.test(rest)) {
            ptEstimateLabel = rest;
          }
        }
        continue;
      }
      
      // 3. Look for precise estimate (e.g., "373,215" or "373215")
      // It should be a number with commas/dots, not the rank (which starts with #)
      if (/^\d+([,.]\d+)*[MK]?$/.test(s) && !s.startsWith('#')) {
        // Avoid picking up the rank if it's just a number
        const val = parseInstalls(s);
        if (val > 1000) { // Precise estimates are usually large
          ptEstimateLabel = s;
        }
      }
    }
    
    // Fallback for installsLabel if not found but we have a precise estimate
    if (!installsLabel && ptEstimateLabel) {
      const val = parseInstalls(ptEstimateLabel);
      // Round down to nearest major bucket if possible, or just use it
      installsLabel = ptEstimateLabel;
    }
    
    const activeInstalls = parseInstalls(installsLabel);
    const ptEstimate = ptEstimateLabel ? parseInstalls(ptEstimateLabel) : null;

    const plugin: RankedPlugin = {
      slug,
      name,
      rank,
      activeInstalls,
      activeInstallsLabel: installsLabel,
      url: `https://wordpress.org/plugins/${slug}/`,
      ptEstimate,
      trend: trendLabel || null
    };

    // Avoid duplicates
    if (!allRankedPlugins.find(p => p.rank === rank)) {
      allRankedPlugins.push(plugin);
    }

    if (slug === targetSlug) {
      onTargetFound(plugin);
      found = true;
    }
  });

  return found;
}

/**
 * Scrapes PluginTracker.io using the specific grid layout provided.
 * Iterates through pages if the plugin is not found on the first page.
 */
export async function scrapePluginTracker(
  targetSlug: string,
  maxPages: number = 10
): Promise<{ rankedPlugins: RankedPlugin[]; targetPlugin: RankedPlugin | null }> {
  let targetPlugin: RankedPlugin | null = null;
  const allRankedPlugins: RankedPlugin[] = [];

  // Try search first as it is much faster to find the rank
  try {
    const searchUrl = `https://plugintracker.io/plugins?search=${targetSlug}`;
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    parseRows($, targetSlug, allRankedPlugins, (p) => { targetPlugin = p; });
  } catch (e) {
    console.error("Search failed, falling back to crawl", e);
  }

  // If we found the target via search but it lacks a precise estimate, 
  // try fetching the detail page for maximum accuracy
  if (targetPlugin && (!targetPlugin.ptEstimate || targetPlugin.ptEstimate === targetPlugin.activeInstalls)) {
    const detail = await fetchPluginDetail(targetSlug);
    if (detail.ptEstimate) {
      targetPlugin.ptEstimate = detail.ptEstimate;
      if (detail.trend) targetPlugin.trend = detail.trend;
    }
  } else if (!targetPlugin) {
    // If not found in search, try fetching detail page anyway to see if it exists
    const detail = await fetchPluginDetail(targetSlug);
    if (detail.ptEstimate) {
      // We still need the rank for interpolation, so we'll continue to crawl
      // but we at least have the precise number now.
      targetPlugin = {
        slug: targetSlug,
        name: targetSlug,
        rank: 0, // Will be filled if found in crawl
        activeInstalls: 0,
        activeInstallsLabel: '',
        url: `https://wordpress.org/plugins/${targetSlug}/`,
        ptEstimate: detail.ptEstimate,
        trend: detail.trend
      };
    }
  }
  let pageToFetch = 1;
  if (targetPlugin) {
    pageToFetch = Math.ceil(targetPlugin.rank / 50);
  }

  // Fetch the specific page to get the bracket context
  for (let page = pageToFetch; page <= pageToFetch + 1; page++) {
    try {
      const url = `https://plugintracker.io/plugins?page=${page}`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const found = parseRows($, targetSlug, allRankedPlugins, (p) => { targetPlugin = p; });
      
      // If we were crawling and found it, or if we just fetched the context page, we're good
      if (targetPlugin && page >= pageToFetch) {
        // We want at least some neighbors. If we have them, we can stop.
        if (allRankedPlugins.length > 1) break;
      }
      
      if ($('div.grid.grid-cols-1.md\\:grid-cols-12').length === 0) break;
      
      // If we haven't found the target yet and we are crawling
      if (!targetPlugin && page >= maxPages) break;

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`Error fetching PluginTracker page ${page}:`, error);
      break;
    }
  }

  // Deduplicate
  const uniquePlugins = Array.from(new Map(allRankedPlugins.map(p => [p.rank, p])).values())
    .sort((a, b) => a.rank - b.rank);

  return { rankedPlugins: uniquePlugins, targetPlugin };
}
