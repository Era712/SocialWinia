import { openai } from '../config/openai';
import { RawPost, CategorizationResult } from '../types';

export async function categorizeGiveaway(post: RawPost): Promise<CategorizationResult> {
  const prompt = `
You are an expert at categorizing giveaways into relevant categories.

Analyze this giveaway and assign categories:

POST DATA:
Title: ${post.title}
Description: ${post.description}
Prize Items: ${post.full_text}

AVAILABLE CATEGORIES:
- Beauty
- Cash Prizes
- Crypto & Digital Assets
- Education & Courses
- Events & Experiences
- Fashion
- Food & Beverage
- Gaming
- Health & Wellness
- Home & Living
- Kids & Family
- Sports & Fitness
- Tech & Electronics
- Travel
- Vehicles & Mobility
- Other

RULES:
- Pick 1 PRIMARY category (most relevant)
- Pick 0-3 SECONDARY categories
- Add 3-8 TAGS (specific keywords like "playstation", "iphone", "nike")

EXAMPLE:
"Win a PS5 and 3 games!" 
→ primary: "Gaming"
→ secondary: ["Tech & Electronics"]
→ tags: ["ps5", "playstation", "console", "video_games"]

Return JSON:
{
  "primary_category": "category name",
  "secondary_categories": ["category1", "category2"],
  "tags": ["tag1", "tag2", "tag3"]
}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error('OpenAI categorizer returned no content');
  }

  const result = JSON.parse(content);
  return result as CategorizationResult;
}
