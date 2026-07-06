import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeFacebook(): Promise<RawPost[]> {
  const hashtags = ['giveaway', 'gewinnspiel', 'verlosung', 'contest', 'win', 'sweepstakes', 'freebie', 'gratis', 'kostenlos'];
  const posts: RawPost[] = [];

  for (const hashtag of hashtags) {
    try {
      const url = `https://www.facebook.com/hashtag/${hashtag}`;
      const html = await scrapingBeeClient.fetch(url, { renderJs: true });
      
      // Facebook embeds data in script tags
      const jsonMatch = html.match(/<script type="application\/json" data-content-len=".*?">(.*?)<\/script>/g);
      if (!jsonMatch) continue;

      for (const match of jsonMatch.slice(0, 20)) {
        try {
          const jsonStr = match.replace(/<script type="application\/json" data-content-len=".*?">|<\/script>/g, '');
          const data = JSON.parse(jsonStr);
          
          // Navigate through Facebook's complex JSON structure
          const edges = data?.data?.node?.timeline_feed_units?.edges || [];

          for (const edge of edges) {
            const post = edge?.node?.comet_sections?.content?.story?.message?.text || '';
            const author = edge?.node?.comet_sections?.context_layout?.story?.comet_sections?.actor_photo?.story?.actors?.[0];
            
            if (!post) continue;

            posts.push({
              platform: 'facebook',
              title: post.slice(0, 100),
              description: post,
              url: edge?.node?.comet_sections?.context_layout?.story?.url || `https://facebook.com/hashtag/${hashtag}`,
              organizer: author?.name || 'unknown',
              follower_count: 0, // Facebook doesn't expose this easily
              is_verified: author?.is_verified || false,
              posted_at: new Date(edge?.node?.comet_sections?.context_layout?.story?.creation_time * 1000).toISOString(),
              full_text: post,
            });
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`✅ Scraped Facebook #${hashtag}: ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping Facebook #${hashtag}:`, error);
    }
  }

  return posts;
}
