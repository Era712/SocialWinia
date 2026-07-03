import cron from 'node-cron';
import { scrapeReddit } from '../scrapers/reddit-scraper';

export function startScraperCron() {
  // Run every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    console.log('🔄 Running scheduled scraper...');
    try {
      await scrapeReddit();
      console.log('✅ Scraper completed successfully');
    } catch (error) {
      console.error('❌ Scraper error:', error);
    }
  });

  console.log('✅ Scraper cron job scheduled to run every 2 hours');
}
