import dotenv from 'dotenv';

dotenv.config();

export const isScrapingBeeConfigured = Boolean(process.env.SCRAPINGBEE_API_KEY);

export const scrapingBeeClient = {
  apiKey: process.env.SCRAPINGBEE_API_KEY || '',
  
  async fetch(url: string, options: { renderJs?: boolean } = {}) {
    if (!this.apiKey) {
      throw new Error('SCRAPINGBEE_API_KEY is not configured');
    }

    const params = new URLSearchParams({
      api_key: this.apiKey,
      url: url,
      render_js: options.renderJs ? 'true' : 'false',
    });

    const response = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
    
    if (!response.ok) {
      throw new Error(`ScrapingBee error: ${response.status}`);
    }

    return response.text();
  },

  async fetchJson(url: string) {
    const html = await this.fetch(url, { renderJs: false });
    return JSON.parse(html);
  }
};

