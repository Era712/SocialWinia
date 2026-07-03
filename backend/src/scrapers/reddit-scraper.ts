import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeReddit(): Promise<RawPost[]> {
  const maxPosts = Number(process.env.SCRAPER_MAX_RAW_POSTS || 0);
  const subreddits = [
    'giveaways',
    'freebies', 
    'sweepstakes',
    'RandomActsOfGaming',
    'FreeGameFindings',
    'eFreebies',
    'FREE',
    'contests'
  ];
  
  const posts: RawPost[] = [];

  for (const subreddit of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=50`;
      const data = await fetchRedditJson(url);

      for (const item of data.data.children) {
        if (maxPosts > 0 && posts.length >= maxPosts) {
          return posts;
        }

        const post = item.data;

        // Skip if too old (older than 7 days)
        const postAge = Date.now() - (post.created_utc * 1000);
        if (postAge > 7 * 24 * 60 * 60 * 1000) continue;

        posts.push({
          platform: 'reddit',
          title: post.title,
          description: post.selftext || '',
          url: `https://reddit.com${post.permalink}`,
          organizer: post.author,
          follower_count: post.subreddit_subscribers || 0,
          is_verified: false,
          posted_at: new Date(post.created_utc * 1000).toISOString(),
          full_text: `${post.title}\n\n${post.selftext || ''}`,
        });
      }

      console.log(`✅ Scraped r/${subreddit}: ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping r/${subreddit}:`, error);
    }
  }

  return posts;
}

async function fetchRedditJson(url: string) {
  const directResponse = await fetch(url, {
    headers: {
      'User-Agent': 'SocialWinia/1.0 by socialwinia',
    },
  });

  if (directResponse.ok) {
    return directResponse.json();
  }

  return scrapingBeeClient.fetchJson(url);
}
