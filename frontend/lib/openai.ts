import OpenAI from 'openai';

export const isOpenAIConfigured = Boolean(process.env.OPENAI_API_KEY);

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'openai-placeholder',
});
