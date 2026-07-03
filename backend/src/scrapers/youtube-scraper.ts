import { scrapingBeeClient } from '../config/scrapingbee';
import { RawPost } from '../types';

export async function scrapeYouTube(): Promise<RawPost[]> {
  const searchTerms = ['giveaway', 'contest', 'win', 'sweepstakes', 'free giveaway'];
  const posts: RawPost[] = [];

  for (const term of searchTerms) {
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}&sp=CAI%253D`;
      const html = await scrapingBeeClient.fetch(url, { renderJs: true });
      
      // Extract ytInitialData from script tag
      const jsonMatch = html.match(/var ytInitialData = ({.*?});/);
      if (!jsonMatch) continue;

      const data = JSON.parse(jsonMatch[1]);
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

      for (const section of contents) {
        const items = section?.itemSectionRenderer?.contents || [];
        
        for (const item of items.slice(0, 15)) {
          const video = item?.videoRenderer;
          if (!video) continue;

          const channel = video.ownerText?.runs?.[0];
          const title = video.title?.runs?.[0]?.text || '';
          const description = video.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || '';

          posts.push({
            platform: 'youtube',
            title: title.slice(0, 100),
            description: description,
            url: `https://www.youtube.com/watch?v=${video.videoId}`,
            organizer: channel?.text || 'unknown',
            follower_count: 0, // YouTube doesn't show subscriber count in search
            is_verified: video.ownerBadges?.[0]?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED',
            posted_at: new Date().toISOString(), // YouTube search doesn't always show exact date
            full_text: `${title}\n\n${description}`,
          });
        }
      }

      console.log(`✅ Scraped YouTube "${term}": ${posts.length} posts`);
    } catch (error) {
      console.error(`❌ Error scraping YouTube "${term}":`, error);
    }
  }

  return posts;
}
