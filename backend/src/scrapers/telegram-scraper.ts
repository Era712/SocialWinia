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
      const messageMatches = html.matchAll(/<div class="tgme_widget_message\b[^>]*data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<time[^>]*datetime="([^"]*)"[^>]*>/g);
      const authorMatch = html.match(/<div class="tgme_channel_info_header_title"[^>]*><span[^>]*>([^<]*)<\/span>/);
      const subscribersMatch = html.match(/<div class="tgme_channel_info_counter"[^>]*><span class="counter_value">([^<]*)<\/span>/);

      const messages = Array.from(messageMatches);
      const author = authorMatch?.[1] || channel;
      const subscribers = subscribersMatch?.[1] || '0';

      for (let i = 0; i < Math.min(messages.length, 20); i++) {
        const postId = messages[i][1];
        const messageText = messages[i][2].replace(/<[^>]*>/g, '').trim();
        const dateStr = messages[i][3] || new Date().toISOString();

        if (!isGiveawayText(messageText)) continue;

        posts.push({
          platform: 'telegram',
          title: messageText.slice(0, 100),
          description: messageText,
          url: `https://t.me/${postId}`,
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

function isGiveawayText(text: string): boolean {
  const lowerText = text.toLowerCase();
  return [
    'giveaway',
    'contest',
    'sweepstakes',
    'freebie',
    'win',
    'gewinnspiel',
    'verlosung',
    'zu gewinnen',
    'gewinne',
    'gewinnen',
    'verlose',
    'verlost',
    'gratis',
    'kostenlos',
  ].some((keyword) => lowerText.includes(keyword));
}
