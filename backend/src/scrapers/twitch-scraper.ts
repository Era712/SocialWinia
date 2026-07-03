import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeTwitch(): Promise<RawPost[]> {
  const searchTerms = ['giveaway', 'contest', 'win', 'drops', 'free'];
  const posts: RawPost[] = [];

  for (const term of searchTerms) {
    try {
      const url = `https://www.twitch.tv/search?term=${encodeURIComponent(term)}`;
      const html = await scrapingBeeClient.fetch(url, { renderJs: true });
      
      // Twitch embeds data in script tags
      const jsonMatch = html.match(/<script type="application\/json" data-a-page-loaded-name="SearchPage">(.*?)<\/script>/);
      if (!jsonMatch) continue;

      const data = JSON.parse(jsonMatch[1]);
      const channels = data?.props?.relayQueryRecords || {};

      // Extract channel data
      for (const key in channels) {
        if (key.startsWith('Channel:')) {
          const channel = channels[key];
          
          // Check if channel description mentions giveaway
          const description = channel.description || '';
          if (!description.toLowerCase().includes('giveaway') && 
              !description.toLowerCase().includes('contest')) continue;

          posts.push({
            platform: 'twitch',
            title: `${channel.displayName} - Giveaway Stream`,
            description: description,
            url: `https://www.twitch.tv/${channel.login}`,
            organizer: channel.displayName || 'unknown',
            follower_count: channel.followers?.totalCount || 0,
            is_verified: channel.roles?.isPartner || false,
            posted_at: new Date().toISOString(),
            full_text: `${channel.displayName}\n\n${description}`,
          });
        }
      }

      console.log(`✅ Scraped Twitch "${term}": ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping Twitch "${term}":`, error);
    }
  }

  return posts;
}
