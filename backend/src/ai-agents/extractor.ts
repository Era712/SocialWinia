import { openai } from '../config/openai';
import { RawPost, ExtractionResult } from '../types';

export async function extractGiveawayData(post: RawPost): Promise<ExtractionResult> {
  const prompt = `
You are an expert at extracting structured data from giveaway posts.

Extract the following information from this giveaway:

POST DATA:
Title: ${post.title}
Description: ${post.description}
Full Text: ${post.full_text}
URL: ${post.url}

EXTRACT:
1. Prize Value (in CHF) - estimate if not stated
2. End Date (ISO format YYYY-MM-DD) - null if not found
3. Number of Winners
4. Requirements to enter (follow, like, comment, tag friends, etc.)
5. List of prize items

EXAMPLES:
- "Win a PS5!" → prize_value_chf: 500
- "Enter by Dec 25" → end_date: "2024-12-25"
- "3 winners" → winner_count: 3
- "Follow & tag 2 friends" → requirements: ["follow", "tag_friends"]

Return JSON:
{
  "prize_value_chf": number,
  "end_date": "YYYY-MM-DD" or null,
  "winner_count": number,
  "requirements": ["array", "of", "requirements"],
  "prize_items": ["item1", "item2"]
}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error('OpenAI extractor returned no content');
  }

  const result = JSON.parse(content);
  return result as ExtractionResult;
}
