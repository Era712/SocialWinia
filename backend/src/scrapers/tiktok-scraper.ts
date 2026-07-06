import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeTikTok(): Promise<RawPost[]> {
  const hashtags = ['giveaway', 'gewinnspiel', 'verlosung', 'contest', 'win', 'sweepstakes', 'giveawaycontest', 'gratis', 'kostenlos'];
  const posts: RawPost[] = [];

  for (const hashtag of hashtags) {
    try {
      const url = `https://www.tiktok.com/tag/${hashtag}`;
      const html = await scrapingBeeClient.fetch(url, { renderJs: true });
      
      // Extract JSON data from script tag
      const jsonMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/);
      if (!jsonMatch) continue;

      const data = JSON.parse(jsonMatch[1]);
      const items = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemList || [];

      for (const item of items.slice(0, 20)) {
        const video = item.video || {};
        const author = item.author || {};
        
        posts.push({
          platform: 'tiktok',
          title: item.desc?.slice(0, 100) || 'TikTok Giveaway',
          description: item.desc || '',
          url: `https://www.tiktok.com/@${author.uniqueId}/video/${item.id}`,
          organizer: author.uniqueId || 'unknown',
          follower_count: author.followerCount || 0,
          is_verified: author.verified || false,
          posted_at: new Date(item.createTime * 1000).toISOString(),
          full_text: item.desc || '',
        });
      }

      console.log(`✅ Scraped TikTok #${hashtag}: ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping TikTok #${hashtag}:`, error);
    }
  }

  return posts;
}
