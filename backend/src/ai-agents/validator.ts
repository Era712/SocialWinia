import { openai } from '../config/openai';
import { RawPost, ValidationResult } from '../types';

export async function validateGiveaway(post: RawPost): Promise<ValidationResult> {
  const prompt = `
You are an expert at detecting fake giveaways and scams on social media.

Analyze this giveaway post and determine if it's LEGITIMATE or SPAM/SCAM.

POST DATA:
Platform: ${post.platform}
Title: ${post.title}
Description: ${post.description}
Organizer: ${post.organizer}
Verified Account: ${post.is_verified ? 'Yes' : 'No'}
Follower Count: ${post.follower_count || 'Unknown'}
URL: ${post.url}
Full Text: ${post.full_text}

RULES:
- Legitimate brands (Nike, PlayStation, etc.) with verified accounts = APPROVE
- Posts asking for personal info (SSN, credit card) = REJECT
- "Send money to claim prize" = REJECT
- Too good to be true prizes from unknown accounts = REJECT
- Proper contest rules and end date = good sign
- Small accounts (<1000 followers) offering expensive prizes = suspicious

Return JSON:
{
  "is_legitimate": boolean,
  "confidence": 0-100,
  "reasoning": "why you think this",
  "red_flags": ["list", "of", "issues"],
  "action": "approve" | "reject" | "review"
}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error('OpenAI validator returned no content');
  }

  const result = JSON.parse(content);
  return result as ValidationResult;
}
