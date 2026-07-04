import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

type RedditListingChild = {
  data?: {
    author?: string;
    created_utc?: number;
    permalink?: string;
    selftext?: string;
    stickied?: boolean;
    subreddit?: string;
    subreddit_subscribers?: number;
    title?: string;
    url?: string;
    url_overridden_by_dest?: string;
  };
};

const giveawaySubreddits = new Set([
  'giveaways',
  'sweepstakes',
  'randomactsofgaming',
  'freegamefindings',
  'efreebies',
  'contests',
  'freebies',
  'free',
]);

const redditSources = [
  ...[
    'giveaways',
    'sweepstakes',
    'RandomActsOfGaming',
    'FreeGameFindings',
    'eFreebies',
    'contests',
    'freebies',
    'FREE',
  ].map((subreddit) => ({
    label: `r/${subreddit}`,
    url: `https://www.reddit.com/r/${subreddit}/new.json?limit=100&raw_json=1`,
  })),
  {
    label: 'r/giveaways hot',
    url: 'https://www.reddit.com/r/giveaways/hot.json?limit=100&raw_json=1',
  },
  {
    label: 'r/sweepstakes hot',
    url: 'https://www.reddit.com/r/sweepstakes/hot.json?limit=100&raw_json=1',
  },
  {
    label: 'reddit search giveaways',
    url: 'https://www.reddit.com/search.json?q=giveaway%20OR%20sweepstakes%20OR%20%22enter%20to%20win%22&sort=new&t=month&limit=100&raw_json=1',
  },
  {
    label: 'reddit search contests',
    url: 'https://www.reddit.com/search.json?q=contest%20OR%20raffle%20OR%20prize&sort=new&t=month&limit=100&raw_json=1',
  },
];

export async function scrapeReddit(): Promise<RawPost[]> {
  const maxPosts = Number(process.env.SCRAPER_MAX_RAW_POSTS || 0);
  const posts: RawPost[] = [];
  const seenUrls = new Set<string>();
  const sourceSummaries: string[] = [];

  for (const source of redditSources) {
    try {
      const data = await fetchRedditJson(source.url);
      const children = Array.isArray(data?.data?.children) ? data.data.children : [];
      let matchedPosts = 0;

      for (const item of children as RedditListingChild[]) {
        if (maxPosts > 0 && posts.length >= maxPosts) {
          return posts;
        }

        const post = item.data;
        if (!post?.title || !post?.permalink || post.stickied) continue;

        const createdUtc = post.created_utc;
        if (!createdUtc || !isRecentPost(createdUtc)) continue;
        if (!isGiveawayCandidate(post)) continue;

        const postUrl = `https://www.reddit.com${post.permalink}`;
        if (seenUrls.has(postUrl)) continue;
        seenUrls.add(postUrl);

        posts.push({
          platform: 'reddit',
          title: post.title,
          description: post.selftext || post.url_overridden_by_dest || post.url || '',
          url: postUrl,
          organizer: post.author || 'reddit_user',
          follower_count: post.subreddit_subscribers || 0,
          is_verified: false,
          posted_at: new Date(createdUtc * 1000).toISOString(),
          full_text: [`r/${post.subreddit}`, post.title, post.selftext, post.url_overridden_by_dest, post.url]
            .filter(Boolean)
            .join('\n\n'),
        });
        matchedPosts += 1;
      }

      console.log(`✅ Scraped ${source.label}: ${matchedPosts} giveaway candidates`);
      sourceSummaries.push(`${source.label}: ${children.length} read, ${matchedPosts} matched`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error scraping ${source.label}:`, error);
      sourceSummaries.push(`${source.label}: failed (${message})`);
    }
  }

  if (posts.length === 0) {
    throw new Error(`Reddit returned 0 giveaway candidates. ${sourceSummaries.slice(0, 6).join(' | ')}`);
  }

  return posts;
}

function isRecentPost(createdUtc?: number) {
  if (!createdUtc) return false;

  const postAge = Date.now() - createdUtc * 1000;
  return postAge <= 30 * 24 * 60 * 60 * 1000;
}

function isGiveawayCandidate(post: {
  subreddit?: string;
  title?: string;
  selftext?: string;
  url?: string;
  url_overridden_by_dest?: string;
}) {
  const subreddit = post.subreddit?.toLowerCase();
  const text = `${post.title || ''}\n${post.selftext || ''}\n${post.url_overridden_by_dest || ''}\n${post.url || ''}`.toLowerCase();
  const includePatterns = [
    /\bgiveaway\b/,
    /\bgive away\b/,
    /\bcontest\b/,
    /\bsweepstakes?\b/,
    /\braffle\b/,
    /\benter to win\b/,
    /\bchance to win\b/,
    /\bwin a\b/,
    /\bwin this\b/,
    /\bwin\b/,
    /\bwinners?\b/,
    /\bprize\b/,
    /\bfreebies?\b/,
    /\bcompetition\b/,
    /\bsteam key\b/,
    /\bkey drop\b/,
    /\bcode giveaway\b/,
    /\bclaim\b/,
    /\bfree game\b/,
    /\bfree copy\b/,
  ];
  const excludePatterns = [
    /\bexpired\b/,
    /\bclosed\b/,
    /\bended\b/,
    /\bdelete if not allowed\b/,
    /\bdiscussion\b/,
    /\bquestion\b/,
    /\brequest\b/,
    /\blooking for\b/,
    /\btrade\b/,
    /\bselling\b/,
    /\bbuying\b/,
  ];

  const excluded = excludePatterns.some((pattern) => pattern.test(text));
  if (excluded) return false;

  if (includePatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  return Boolean(subreddit && giveawaySubreddits.has(subreddit) && text.length > 8);
}

async function fetchRedditJson(url: string) {
  try {
    const directResponse = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SocialWinia/1.0 by socialwinia',
      },
    });

    if (directResponse.ok && directResponse.headers.get('content-type')?.includes('application/json')) {
      return directResponse.json();
    }
  } catch (error) {
    console.warn(`Direct Reddit fetch failed, falling back to ScrapingBee: ${url}`, error);
  }

  return scrapingBeeClient.fetchJson(url);
}
