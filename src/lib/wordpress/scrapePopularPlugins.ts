import axios from 'axios';
import * as cheerio from 'cheerio';
import { RankedPlugin } from './types';
import { parseInstalls } from './parseInstalls';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Scrapes the popular plugins pages from WordPress.org.
 * Updated to handle the new WP.org layout where plugins are in h3 headers.
 */
export async function scrapePopularPlugins(
  targetSlug: string,
  maxPages: number = 5
): Promise<{ rankedPlugins: RankedPlugin[]; targetPlugin: RankedPlugin | null }> {
  const rankedPlugins: RankedPlugin[] = [];
  let targetPlugin: RankedPlugin | null = null;
  let currentRank = 1;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `https://wordpress.org/plugins/browse/popular/page/${page}/`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // The new structure seems to use h3 for plugin titles
      // We look for links inside h3 or elements with plugin-card class
      const pluginElements = $('.plugin-card, h3.entry-title, .plugin-section h3');

      if (pluginElements.length === 0) {
        // Fallback: search for any plugin link in the main content
        $('#main .plugin-card, #main h3').each((_, el) => {
           // logic below
        });
      }

      pluginElements.each((_, element) => {
        const $el = $(element);
        const $link = $el.is('a') ? $el : $el.find('a').first();
        if (!$link.length) return;

        const name = $link.text().trim();
        const pluginUrl = $link.attr('href') || '';
        if (!pluginUrl.includes('/plugins/')) return;

        const slug = pluginUrl.split('/').filter(Boolean).pop() || '';
        
        // Find active installs in the parent or sibling
        const $container = $el.closest('.plugin-card, article, section, .plugin-section > div');
        
        // Try specific selectors first
        let activeInstallsLabel = $container.find('.active-installs, .installs, .plugin-card__stats-item--installs').first().text().trim();
        
        // If not found, look for any text containing "+" and "install"
        if (!activeInstallsLabel) {
          $container.find('span, li, div, p').each((_, span) => {
            const text = $(span).text().trim().toLowerCase();
            if (text.includes('+') && text.includes('install')) {
              activeInstallsLabel = text;
              return false;
            }
          });
        }
        
        // Final fallback: look for something that looks like an install count (e.g. "100,000+")
        if (!activeInstallsLabel) {
          $container.find('span, li, div').each((_, span) => {
            const text = $(span).text().trim();
            if (text.includes('+') && /^\d+[,.\d]*\+?$/.test(text)) {
              activeInstallsLabel = text;
              return false;
            }
          });
        }

        const activeInstalls = parseInstalls(activeInstallsLabel);

        const plugin: RankedPlugin = {
          slug,
          name,
          rank: currentRank++,
          activeInstalls,
          activeInstallsLabel,
          url: pluginUrl
        };

        // Avoid duplicates if selectors overlap
        if (!rankedPlugins.find(p => p.slug === slug)) {
          rankedPlugins.push(plugin);
          if (slug === targetSlug) {
            targetPlugin = plugin;
          }
        }
      });

      if (targetPlugin && rankedPlugins[rankedPlugins.length - 1].activeInstalls < targetPlugin.activeInstalls) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.error(`Error scraping WP page ${page}:`, error);
      break;
    }
  }

  return { rankedPlugins, targetPlugin };
}
