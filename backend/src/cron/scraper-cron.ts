import cron from 'node-cron';
import { runGiveawayPipeline } from '../pipeline/giveaway-pipeline';

export function startScraperCron() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('⏰ Cron job started:', new Date().toISOString());
    
    try {
      const result = await runGiveawayPipeline();
      console.log(`✅ Cron job completed: ${result.processedCount} processed, ${result.savedCount} saved, ${result.skippedCount} skipped`);

      if (result.errors.length > 0) {
        console.error('Pipeline errors:', result.errors);
      }
    } catch (error) {
      console.error('❌ Cron job failed:', error);
    }
  });

  console.log('✅ Scraper cron job scheduled (every 15 minutes)');
}
