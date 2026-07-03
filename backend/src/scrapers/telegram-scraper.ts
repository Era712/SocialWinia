import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeTelegram(): Promise<RawPost[]> {
  // Public Telegram channels known for giveaways
  const channels = [
    'giveaways',
    'contests',
    'freebies',
    'cryptogiveaways',
    'nftgiveaways',
  ];
  
  const posts: RawPost[] = [];

  for (const channel of channels) {
    try {
      const url = `https://t.me/s/${channel}`;
      const html = await scrapingBeeClient.fetch(url, { renderJs: true });
      
      // Telegram embeds messages in HTML
      const messageMatches = html.matchAll(/<div class="tgme_widget_message_text js-message_text"[^>]*>(.*?)<\/div>/gs);
      const dateMatches = html.matchAll(/<time[^>]*datetime="([^"]*)"[^>]*>/g);
      const authorMatch = html.match(/<div class="tgme_channel_info_header_title"[^>]*><span[^>]*>([^<]*)<\/span>/);
      const subscribersMatch = html.match(/<div class="tgme_channel_info_counter"[^>]*><span class="counter_value">([^<]*)<\/span>/);

      const messages = Array.from(messageMatches);
      const dates = Array.from(dateMatches);
      const author = authorMatch?.[1] || channel;
      const subscribers = subscribersMatch?.[1] || '0';

      for (let i = 0; i < Math.min(messages.length, 20); i++) {
        const messageText = messages[i][1].replace(/<[^>]*>/g, '').trim();
        const dateStr = dates[i]?.[1] || new Date().toISOString();

        // Filter for giveaway-related content
        if (!messageText.toLowerCase().includes('giveaway') && 
            !messageText.toLowerCase().includes('contest') &&
            !messageText.toLowerCase().includes('win')) continue;

        posts.push({
          platform: 'telegram',
          title: messageText.slice(0, 100),
          description: messageText,
          url: `https://t.me/${channel}`,
          organizer: author,
          follower_count: parseInt(subscribers.replace(/[^0-9]/g, '')) || 0,
          is_verified: false,
          posted_at: new Date(dateStr).toISOString(),
          full_text: messageText,
        });
      }

      console.log(`✅ Scraped Telegram @${channel}: ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping Telegram @${channel}:`, error);
    }
  }

  return posts;
}
