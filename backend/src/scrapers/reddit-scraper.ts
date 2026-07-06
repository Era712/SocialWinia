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

type RedditSource = {
  apiUrl?: string;
  label: string;
  rssUrl?: string;
  url: string;
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
  'steam_giveaway',
  'steamgiveaway',
  'giftofgames',
  'gamegiveaway',
  'pcgiveaways',
  'playitforward',
  'freegamesonsteam',
  'gamedealsfree',
  'freegamestuff',
  'freeebooks',
]);

const redditSources: RedditSource[] = [
  ...[
    'giveaways',
    'sweepstakes',
    'RandomActsOfGaming',
    'FreeGameFindings',
    'eFreebies',
    'contests',
    'freebies',
    'FREE',
    'steam_giveaway',
    'steamgiveaway',
    'GiftofGames',
    'GameGiveaway',
    'pcgiveaways',
    'playitforward',
    'FreeGamesOnSteam',
    'GameDealsFree',
    'FreeGameStuff',
    'FreeEBOOKS',
  ].map((subreddit) => ({
    apiUrl: `https://api.reddit.com/r/${subreddit}/new?limit=100&raw_json=1`,
    label: `r/${subreddit}`,
    rssUrl: `https://www.reddit.com/r/${subreddit}/new/.rss?limit=100`,
    url: `https://www.reddit.com/r/${subreddit}/new.json?limit=100&raw_json=1`,
  })),
  {
    apiUrl: 'https://api.reddit.com/r/giveaways/hot?limit=100&raw_json=1',
    label: 'r/giveaways hot',
    rssUrl: 'https://www.reddit.com/r/giveaways/hot/.rss?limit=100',
    url: 'https://www.reddit.com/r/giveaways/hot.json?limit=100&raw_json=1',
  },
  {
    apiUrl: 'https://api.reddit.com/r/sweepstakes/hot?limit=100&raw_json=1',
    label: 'r/sweepstakes hot',
    rssUrl: 'https://www.reddit.com/r/sweepstakes/hot/.rss?limit=100',
    url: 'https://www.reddit.com/r/sweepstakes/hot.json?limit=100&raw_json=1',
  },
  {
    apiUrl: 'https://api.reddit.com/search?q=giveaway%20OR%20sweepstakes%20OR%20%22enter%20to%20win%22&sort=new&t=month&limit=100&raw_json=1',
    label: 'reddit search giveaways',
    url: 'https://www.reddit.com/search.json?q=giveaway%20OR%20sweepstakes%20OR%20%22enter%20to%20win%22&sort=new&t=month&limit=100&raw_json=1',
  },
  {
    apiUrl: 'https://api.reddit.com/search?q=contest%20OR%20raffle%20OR%20prize&sort=new&t=month&limit=100&raw_json=1',
    label: 'reddit search contests',
    url: 'https://www.reddit.com/search.json?q=contest%20OR%20raffle%20OR%20prize&sort=new&t=month&limit=100&raw_json=1',
  },
  {
    apiUrl: 'https://api.reddit.com/search?q=gewinnspiel%20OR%20verlosung%20OR%20%22zu%20gewinnen%22&sort=new&t=month&limit=100&raw_json=1',
    label: 'reddit search gewinnspiel',
    url: 'https://www.reddit.com/search.json?q=gewinnspiel%20OR%20verlosung%20OR%20%22zu%20gewinnen%22&sort=new&t=month&limit=100&raw_json=1',
  },
  {
    apiUrl: 'https://api.reddit.com/search?q=%22free%20game%22%20OR%20%22steam%20key%22%20OR%20%22gog%22&sort=new&t=week&limit=100&raw_json=1',
    label: 'reddit search game prizes',
    url: 'https://www.reddit.com/search.json?q=%22free%20game%22%20OR%20%22steam%20key%22%20OR%20%22gog%22&sort=new&t=week&limit=100&raw_json=1',
  },
  {
    apiUrl: 'https://api.reddit.com/search?q=%23giveaway%20OR%20%23contest%20OR%20%23sweepstakes&sort=new&t=month&limit=100&raw_json=1',
    label: 'reddit search hashtags',
    url: 'https://www.reddit.com/search.json?q=%23giveaway%20OR%20%23contest%20OR%20%23sweepstakes&sort=new&t=month&limit=100&raw_json=1',
  },
  {
    apiUrl: 'https://api.reddit.com/search?q=%23gewinnspiel%20OR%20%23verlosung%20OR%20%22folge%20und%20kommentiere%22&sort=new&t=month&limit=100&raw_json=1',
    label: 'reddit search german hashtags',
    url: 'https://www.reddit.com/search.json?q=%23gewinnspiel%20OR%20%23verlosung%20OR%20%22folge%20und%20kommentiere%22&sort=new&t=month&limit=100&raw_json=1',
  },
  {
    apiUrl: 'https://api.reddit.com/search?q=%22comment%20to%20enter%22%20OR%20%22leave%20a%20comment%20to%20win%22%20OR%20%22ends%22%20%22giveaway%22&sort=new&t=month&limit=100&raw_json=1',
    label: 'reddit search entry phrases',
    url: 'https://www.reddit.com/search.json?q=%22comment%20to%20enter%22%20OR%20%22leave%20a%20comment%20to%20win%22%20OR%20%22ends%22%20%22giveaway%22&sort=new&t=month&limit=100&raw_json=1',
  },
  {
    apiUrl: 'https://api.reddit.com/search?q=%22amazon%20gift%20card%22%20%22giveaway%22%20OR%20%22paypal%22%20%22giveaway%22%20OR%20%22voucher%22%20%22giveaway%22&sort=new&t=month&limit=100&raw_json=1',
    label: 'reddit search gift prizes',
    url: 'https://www.reddit.com/search.json?q=%22amazon%20gift%20card%22%20%22giveaway%22%20OR%20%22paypal%22%20%22giveaway%22%20OR%20%22voucher%22%20%22giveaway%22&sort=new&t=month&limit=100&raw_json=1',
  },
];

export async function scrapeReddit(): Promise<RawPost[]> {
  const maxPosts = Number(process.env.SCRAPER_MAX_RAW_POSTS || 0);
  const posts: RawPost[] = [];
  const seenUrls = new Set<string>();
  const sourceSummaries: string[] = [];

  for (const source of redditSources) {
    try {
      const { children, method } = await fetchRedditChildren(source);
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
      sourceSummaries.push(`${source.label}: ${children.length} read via ${method}, ${matchedPosts} matched`);
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
    /\bprize\b/,
    /\bfreebies?\b/,
    /\bcompetition\b/,
    /\bsteam key\b/,
    /\bkey drop\b/,
    /\bcode giveaway\b/,
    /\bclaim\b/,
    /\bfree game\b/,
    /\bfree copy\b/,
    /\bgewinnspiel\b/,
    /#gewinnspiel\b/,
    /\bverlosung\b/,
    /\bzu gewinnen\b/,
    /\bgewinne\b/,
    /\bgewinnen\b/,
    /\bteilnehmen\b/,
    /\bverlose\b/,
    /\bverlost\b/,
    /\bgratis\b/,
    /\bkostenlos\b/,
  ];
  const excludePatterns = [
    /\bexpired\b/,
    /\bclosed\b/,
    /\bended\b/,
    /\bgiveaway over\b/,
    /\bcontest over\b/,
    /\bentries closed\b/,
    /\bwinner announced\b/,
    /\bwinners announced\b/,
    /\bwinner selected\b/,
    /\bwinners selected\b/,
    /\bcongrats\b/,
    /\bbeendet\b/,
    /\babgelaufen\b/,
    /\bgeschlossen\b/,
    /\bvorbei\b/,
    /\bgewinner steht fest\b/,
    /\bgewinner bekanntgegeben\b/,
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

async function fetchRedditChildren(source: RedditSource) {
  const errors: string[] = [];
  const jsonUrls = [source.url, source.apiUrl].filter(Boolean) as string[];

  for (const url of jsonUrls) {
    try {
      const data = await fetchRedditJsonDirect(url);
      const children = Array.isArray(data?.data?.children) ? data.data.children : [];
      return { children, method: url.includes('api.reddit.com') ? 'api.reddit.com' : 'reddit json' };
    } catch (error) {
      errors.push(formatFetchError(url, error));
    }
  }

  for (const url of jsonUrls) {
    try {
      const data = await scrapingBeeClient.fetchJson(url);
      const children = Array.isArray(data?.data?.children) ? data.data.children : [];
      return { children, method: 'ScrapingBee' };
    } catch (error) {
      errors.push(formatFetchError(`ScrapingBee ${url}`, error));
    }
  }

  if (source.rssUrl) {
    try {
      const rss = await fetchRedditTextDirect(source.rssUrl, 'application/atom+xml, application/xml, text/xml');
      return { children: parseRedditRss(rss, source.label), method: 'reddit rss' };
    } catch (error) {
      errors.push(formatFetchError(source.rssUrl, error));
    }

    try {
      const rss = await scrapingBeeClient.fetch(source.rssUrl, { renderJs: false });
      return { children: parseRedditRss(rss, source.label), method: 'ScrapingBee rss' };
    } catch (error) {
      errors.push(formatFetchError(`ScrapingBee ${source.rssUrl}`, error));
    }
  }

  throw new Error(errors.slice(0, 4).join('; '));
}

async function fetchRedditJsonDirect(url: string) {
  const text = await fetchRedditTextDirect(url, 'application/json');
  return JSON.parse(text);
}

async function fetchRedditTextDirect(url: string, accept: string) {
  try {
    const directResponse = await fetch(url, {
      headers: {
        Accept: accept,
        'User-Agent': 'SocialWinia/1.0 by socialwinia',
      },
    });

    if (!directResponse.ok) {
      throw new Error(`direct ${directResponse.status}`);
    }

    return directResponse.text();
  } catch (error) {
    console.warn(`Direct Reddit fetch failed: ${url}`, error);
    throw error;
  }
}

function parseRedditRss(rss: string, sourceLabel: string): RedditListingChild[] {
  const subreddit = sourceLabel.match(/^r\/([^ ]+)/)?.[1] || 'reddit';
  const entries = rss.match(/<entry[\s\S]*?<\/entry>/g) || [];

  return entries.map((entry) => {
    const title = decodeXml(readXmlTag(entry, 'title'));
    const author = decodeXml(readXmlTag(entry, 'name')) || 'reddit_user';
    const updated = readXmlTag(entry, 'updated') || readXmlTag(entry, 'published');
    const href = entry.match(/<link[^>]+href="([^"]+)"/)?.[1] || readXmlTag(entry, 'id');
    const url = decodeXml(href);
    const permalink = toRedditPermalink(url);
    const created = updated ? Math.floor(new Date(updated).getTime() / 1000) : Math.floor(Date.now() / 1000);

    return {
      data: {
        author,
        created_utc: Number.isFinite(created) ? created : Math.floor(Date.now() / 1000),
        permalink,
        selftext: decodeXml(stripTags(readXmlTag(entry, 'content'))),
        stickied: false,
        subreddit,
        title,
        url,
        url_overridden_by_dest: url,
      },
    };
  });
}

function readXmlTag(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1]?.trim() || '';
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function toRedditPermalink(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}

function formatFetchError(url: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `${url}: ${message}`;
}
