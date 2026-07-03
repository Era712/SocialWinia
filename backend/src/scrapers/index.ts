import { RawPost } from '../types';
import { scrapeDiscord } from './discord-scraper';
import { scrapeFacebook } from './facebook-scraper';
import { scrapeInstagram } from './instagram-scraper';
import { scrapeKick } from './kick-scraper';
import { scrapeLinkedIn } from './linkedin-scraper';
import { scrapeReddit } from './reddit-scraper';
import { scrapeTelegram } from './telegram-scraper';
import { scrapeThreads } from './threads-scraper';
import { scrapeTikTok } from './tiktok-scraper';
import { scrapeTwitch } from './twitch-scraper';
import { scrapeX } from './x-scraper';
import { scrapeYouTube } from './youtube-scraper';

const scrapers = [
  { name: 'instagram', run: scrapeInstagram },
  { name: 'tiktok', run: scrapeTikTok },
  { name: 'x', run: scrapeX },
  { name: 'youtube', run: scrapeYouTube },
  { name: 'facebook', run: scrapeFacebook },
  { name: 'threads', run: scrapeThreads },
  { name: 'reddit', run: scrapeReddit },
  { name: 'twitch', run: scrapeTwitch },
  { name: 'linkedin', run: scrapeLinkedIn },
  { name: 'discord', run: scrapeDiscord },
  { name: 'telegram', run: scrapeTelegram },
  { name: 'kick', run: scrapeKick },
];

export async function scrapeAllPlatforms(): Promise<RawPost[]> {
  const selectedPlatforms = (process.env.SCRAPER_PLATFORMS || '')
    .split(',')
    .map((platform) => platform.trim().toLowerCase())
    .filter(Boolean);
  const maxRawPosts = Number(process.env.SCRAPER_MAX_RAW_POSTS || 0);
  const activeScrapers =
    selectedPlatforms.length > 0
      ? scrapers.filter((scraper) => selectedPlatforms.includes(scraper.name))
      : scrapers;

  const results = await Promise.allSettled(activeScrapers.map((scraper) => scraper.run()));

  const rawPosts = results.flatMap((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    console.error('Scraper failed:', result.reason);
    return [];
  });

  return maxRawPosts > 0 ? rawPosts.slice(0, maxRawPosts) : rawPosts;
}
