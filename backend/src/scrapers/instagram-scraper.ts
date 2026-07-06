import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeInstagram(): Promise<RawPost[]> {
  const hashtags = ['giveaway', 'gewinnspiel', 'verlosung', 'contest', 'win', 'sweepstakes', 'freebie', 'gratis', 'kostenlos'];
  const posts: RawPost[] = [];

  for (const hashtag of hashtags) {
    try {
      const url = `https://www.instagram.com/explore/tags/${hashtag}/?__a=1&__d=dis`;
      const html = await scrapingBeeClient.fetch(url, { renderJs: true });
      
      // Instagram returns JSON in HTML
      const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
      if (!jsonMatch) continue;

      const data = JSON.parse(jsonMatch[1]);
      const edges = data?.graphql?.hashtag?.edge_hashtag_to_media?.edges || [];

      for (const edge of edges.slice(0, 20)) {
        const node = edge.node;
        
        posts.push({
          platform: 'instagram',
          title: node.edge_media_to_caption?.edges[0]?.node?.text?.slice(0, 100) || 'Instagram Giveaway',
          description: node.edge_media_to_caption?.edges[0]?.node?.text || '',
          url: `https://www.instagram.com/p/${node.shortcode}/`,
          organizer: node.owner?.username || 'unknown',
          follower_count: node.owner?.edge_followed_by?.count || 0,
          is_verified: node.owner?.is_verified || false,
          posted_at: new Date(node.taken_at_timestamp * 1000).toISOString(),
          full_text: node.edge_media_to_caption?.edges[0]?.node?.text || '',
        });
      }

      console.log(`✅ Scraped Instagram #${hashtag}: ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping Instagram #${hashtag}:`, error);
    }
  }

  return posts;
}
