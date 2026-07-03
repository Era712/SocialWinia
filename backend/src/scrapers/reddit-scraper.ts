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
    'contests',
  ];

  const posts: RawPost[] = [];

  for (const subreddit of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=50`;
      const data = await fetchRedditJson(url);
      const children = Array.isArray(data?.data?.children) ? data.data.children : [];
      let matchedPosts = 0;

      for (const item of children) {
        if (maxPosts > 0 && posts.length >= maxPosts) {
          return posts;
        }

        const post = item.data;
        if (!post?.title || !post?.permalink || post.stickied) continue;

        if (!isRecentPost(post.created_utc)) continue;
        if (!isGiveawayCandidate(post)) continue;

        const postUrl = `https://www.reddit.com${post.permalink}`;

        posts.push({
          platform: 'reddit',
          title: post.title,
          description: post.selftext || post.url || '',
          url: postUrl,
          organizer: post.author,
          follower_count: post.subreddit_subscribers || 0,
          is_verified: false,
          posted_at: new Date(post.created_utc * 1000).toISOString(),
          full_text: [`r/${post.subreddit}`, post.title, post.selftext, post.url]
            .filter(Boolean)
            .join('\n\n'),
        });
        matchedPosts += 1;
      }

      console.log(`✅ Scraped r/${subreddit}: ${matchedPosts} giveaway candidates`);
    } catch (error) {
      console.error(`❌ Error scraping r/${subreddit}:`, error);
    }
  }

  return posts;
}

function isRecentPost(createdUtc?: number) {
  if (!createdUtc) return false;

  const postAge = Date.now() - createdUtc * 1000;
  return postAge <= 7 * 24 * 60 * 60 * 1000;
}

function isGiveawayCandidate(post: { title?: string; selftext?: string }) {
  const text = `${post.title || ''}\n${post.selftext || ''}`.toLowerCase();
  const includePatterns = [
    /\bgiveaway\b/,
    /\bgive away\b/,
    /\bcontest\b/,
    /\bsweepstakes?\b/,
    /\braffle\b/,
    /\benter to win\b/,
    /\bwin\b/,
    /\bwinners?\b/,
    /\bprize\b/,
    /\bfreebies?\b/,
  ];
  const excludePatterns = [
    /\bexpired\b/,
    /\bclosed\b/,
    /\bended\b/,
    /\bdiscussion\b/,
    /\bquestion\b/,
    /\brequest\b/,
    /\blooking for\b/,
  ];

  return (
    includePatterns.some((pattern) => pattern.test(text)) &&
    !excludePatterns.some((pattern) => pattern.test(text))
  );
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
