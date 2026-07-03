import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeX(): Promise<RawPost[]> {
  const hashtags = ['giveaway', 'contest', 'win', 'sweepstakes', 'NFTGiveaway'];
  const posts: RawPost[] = [];

  for (const hashtag of hashtags) {
    try {
      const url = `https://twitter.com/search?q=%23${hashtag}&src=typed_query&f=live`;
      const html = await scrapingBeeClient.fetch(url, { renderJs: true });

      const matches = html.matchAll(/"full_text":"([^"]+)".{0,600}?"screen_name":"([^"]+)".{0,600}?"id_str":"([^"]+)"/g);

      for (const match of Array.from(matches).slice(0, 20)) {
        const fullText = match[1].replace(/\\n/g, ' ');
        const screenName = match[2] || 'unknown';
        const tweetId = match[3] || '';

        posts.push({
          platform: 'x',
          title: fullText.slice(0, 100) || 'X Giveaway',
          description: fullText,
          url: tweetId ? `https://twitter.com/${screenName}/status/${tweetId}` : url,
          organizer: screenName,
          follower_count: 0,
          is_verified: false,
          posted_at: new Date().toISOString(),
          full_text: fullText,
        });
      }

      console.log(`✅ Scraped X #${hashtag}: ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping X #${hashtag}:`, error);
    }
  }

  return posts;
}
