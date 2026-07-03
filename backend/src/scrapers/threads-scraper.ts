import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeThreads(): Promise<RawPost[]> {
  const hashtags = ['giveaway', 'contest', 'win', 'sweepstakes', 'freebie'];
  const posts: RawPost[] = [];

  for (const hashtag of hashtags) {
    try {
      const url = `https://www.threads.net/search?q=%23${hashtag}&serp_type=default`;
      const html = await scrapingBeeClient.fetch(url, { renderJs: true });
      
      // Threads uses similar structure to Instagram
      const jsonMatch = html.match(/<script type="application\/json" data-sjs>(.*?)<\/script>/);
      if (!jsonMatch) continue;

      const data = JSON.parse(jsonMatch[1]);
      const edges = data?.require?.[0]?.[3]?.[0]?.__bbox?.result?.data?.data?.search_results?.edges || [];

      for (const edge of edges.slice(0, 20)) {
        const thread = edge?.node?.thread_items?.[0]?.post;
        if (!thread) continue;

        const user = thread.user;
        const caption = thread.caption?.text || '';

        posts.push({
          platform: 'threads',
          title: caption.slice(0, 100) || 'Threads Giveaway',
          description: caption,
          url: `https://www.threads.net/@${user.username}/post/${thread.code}`,
          organizer: user.username || 'unknown',
          follower_count: user.follower_count || 0,
          is_verified: user.is_verified || false,
          posted_at: new Date(thread.taken_at * 1000).toISOString(),
          full_text: caption,
        });
      }

      console.log(`✅ Scraped Threads #${hashtag}: ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping Threads #${hashtag}:`, error);
    }
  }

  return posts;
}
