import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeLinkedIn(): Promise<RawPost[]> {
  const hashtags = ['giveaway', 'gewinnspiel', 'verlosung', 'contest', 'win', 'sweepstakes', 'competition', 'gratis', 'kostenlos'];
  const posts: RawPost[] = [];

  for (const hashtag of hashtags) {
    try {
      const url = `https://www.linkedin.com/feed/hashtag/${hashtag}`;
      const html = await scrapingBeeClient.fetch(url, { renderJs: true });
      
      // LinkedIn embeds data in script tags
      const jsonMatch = html.match(/<code style="display: none" id="bpr-guid-.*?">(.*?)<\/code>/g);
      if (!jsonMatch) continue;

      for (const match of jsonMatch.slice(0, 20)) {
        try {
          const jsonStr = match.replace(/<code style="display: none" id="bpr-guid-.*?">|<\/code>/g, '');
          const decoded = jsonStr.replace(/"/g, '"').replace(/&/g, '&');
          const data = JSON.parse(decoded);

          // Navigate LinkedIn's structure
          const included = data?.included || [];
          
          for (const item of included) {
            if (item['$type'] === 'com.linkedin.voyager.feed.render.UpdateV2') {
              const commentary = item.commentary?.text?.text || '';
              const actor = item.actor?.name?.text || 'unknown';
              
              if (!commentary) continue;

              posts.push({
                platform: 'linkedin',
                title: commentary.slice(0, 100),
                description: commentary,
                url: `https://www.linkedin.com/feed/update/${item.updateMetadata?.urn?.split(':').pop()}`,
                organizer: actor,
                follower_count: 0, // LinkedIn doesn't expose this easily
                is_verified: false,
                posted_at: new Date(item.actor?.createdAt || Date.now()).toISOString(),
                full_text: commentary,
              });
            }
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`✅ Scraped LinkedIn #${hashtag}: ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping LinkedIn #${hashtag}:`, error);
    }
  }

  return posts;
}
