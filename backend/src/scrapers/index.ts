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

type ScraperRunResult = {
  name: string;
  posts: RawPost[];
};

type ScraperDiagnostics = {
  activePlatforms: string[];
  invalidPlatforms: string[];
  messages: string[];
  selectedPlatforms: string[];
};

let lastScraperDiagnostics: ScraperDiagnostics = {
  activePlatforms: [],
  invalidPlatforms: [],
  messages: [],
  selectedPlatforms: [],
};

export function getLastScraperDiagnostics() {
  return lastScraperDiagnostics;
}

export async function scrapeAllPlatforms(): Promise<RawPost[]> {
  const selectedPlatforms = (process.env.SCRAPER_PLATFORMS || '')
    .split(',')
    .map((platform) => platform.trim().toLowerCase())
    .filter(Boolean);
  const maxRawPosts = Number(process.env.SCRAPER_MAX_RAW_POSTS || 0);
  const validPlatformNames = new Set(scrapers.map((scraper) => scraper.name));
  const invalidPlatforms = selectedPlatforms.filter((platform) => !validPlatformNames.has(platform));
  const filteredScrapers =
    selectedPlatforms.length > 0
      ? scrapers.filter((scraper) => selectedPlatforms.includes(scraper.name))
      : scrapers;

  const activeScrapers =
    selectedPlatforms.length > 0 && filteredScrapers.length === 0
      ? scrapers.filter((scraper) => scraper.name === 'reddit')
      : filteredScrapers;

  const messages = [
    `Active scrapers: ${activeScrapers.map((scraper) => scraper.name).join(', ') || 'none'}`,
  ];

  if (invalidPlatforms.length > 0) {
    messages.push(`Invalid SCRAPER_PLATFORMS ignored: ${invalidPlatforms.join(', ')}`);
  }

  if (selectedPlatforms.length > 0 && filteredScrapers.length === 0) {
    messages.push('No valid scraper platform was selected, so SocialWinia fell back to reddit.');
  }

  const results = await Promise.allSettled(
    activeScrapers.map(async (scraper): Promise<ScraperRunResult> => {
      const posts = await scraper.run();
      return { name: scraper.name, posts };
    })
  );

  const rawPosts = results.flatMap((result) => {
    if (result.status === 'fulfilled') {
      messages.push(`${result.value.name}: ${result.value.posts.length} raw posts`);
      return result.value.posts;
    }

    const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
    messages.push(`Scraper failed: ${errorMessage}`);
    console.error('Scraper failed:', result.reason);
    return [];
  });

  const limitedPosts = maxRawPosts > 0 ? rawPosts.slice(0, maxRawPosts) : rawPosts;

  if (maxRawPosts > 0 && rawPosts.length > maxRawPosts) {
    messages.push(`Limited raw posts from ${rawPosts.length} to ${maxRawPosts}.`);
  }

  lastScraperDiagnostics = {
    activePlatforms: activeScrapers.map((scraper) => scraper.name),
    invalidPlatforms,
    messages,
    selectedPlatforms,
  };

  return limitedPosts;
}
