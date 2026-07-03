import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeKick(): Promise<RawPost[]> {
  const searchTerms = ['giveaway', 'contest', 'drops', 'free'];
  const posts: RawPost[] = [];

  for (const term of searchTerms) {
    try {
      const url = `https://kick.com/search?term=${encodeURIComponent(term)}`;
      const html = await scrapingBeeClient.fetch(url, { renderJs: true });
      
      // Kick embeds data in script tags (similar to Twitch)
      const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
      if (!jsonMatch) continue;

      const data = JSON.parse(jsonMatch[1]);
      const channels = data?.props?.pageProps?.channels || [];

      for (const channel of channels.slice(0, 20)) {
        // Check if channel title or description mentions giveaway
        const title = channel.session_title || '';
        const description = channel.user?.bio || '';
        
        if (!title.toLowerCase().includes('giveaway') && 
            !title.toLowerCase().includes('contest') &&
            !description.toLowerCase().includes('giveaway')) continue;

        posts.push({
          platform: 'kick',
          title: title || `${channel.user?.username} - Giveaway Stream`,
          description: description,
          url: `https://kick.com/${channel.slug}`,
          organizer: channel.user?.username || 'unknown',
          follower_count: channel.followers_count || 0,
          is_verified: channel.user?.verified || false,
          posted_at: new Date(channel.created_at || Date.now()).toISOString(),
          full_text: `${title}\n\n${description}`,
        });
      }

      console.log(`✅ Scraped Kick "${term}": ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping Kick "${term}":`, error);
    }
  }

  return posts;
}
