import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeDiscord(): Promise<RawPost[]> {
  // Discord public servers with giveaway channels
  const publicServers = [
    'https://discord.com/invite/giveaways',
    'https://discord.com/invite/contests',
    'https://discord.com/invite/freebies',
  ];
  
  const posts: RawPost[] = [];

  for (const serverUrl of publicServers) {
    try {
      const html = await scrapingBeeClient.fetch(serverUrl, { renderJs: true });
      
      // Discord embeds invite data in meta tags and scripts
      const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
      if (!jsonMatch) continue;

      const data = JSON.parse(jsonMatch[1]);
      const invite = data?.props?.pageProps?.invite;
      
      if (!invite) continue;

      const guild = invite.guild;
      const channel = invite.channel;

      posts.push({
        platform: 'discord',
        title: `${guild.name} - Giveaway Server`,
        description: guild.description || `Join ${guild.name} for giveaways and contests!`,
        url: serverUrl,
        organizer: guild.name,
        follower_count: invite.approximate_member_count || 0,
        is_verified: guild.verified || false,
        posted_at: new Date().toISOString(),
        full_text: `${guild.name}\n\n${guild.description || ''}`,
      });

      console.log(`✅ Scraped Discord server: ${guild.name}`);
    } catch (error) {
      console.error(`❌ Error scraping Discord ${serverUrl}:`, error);
    }
  }

  return posts;
}
