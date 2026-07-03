import { NextRequest, NextResponse } from 'next/server';
import { isOpenAIConfigured, openai } from '@/lib/openai';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    if (!isOpenAIConfigured) {
      return NextResponse.json(
        { error: 'OpenAI is not configured' },
        { status: 400 }
      );
    }

    const { message, history } = await req.json();

    const { data: giveaways } = await supabase
      .from('giveaways')
      .select('*')
      .limit(5);

    const context = giveaways?.length
      ? `Current giveaways:\n${JSON.stringify(giveaways, null, 2)}`
      : 'No giveaways available.';

    const messages = [
      {
        role: 'system',
        content: `You are the SocialWinia assistant. Answer briefly and helpfully in English. Use the following giveaway data:\n${context}`,
      },
      ...history,
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      temperature: 0.7,
    });

    return NextResponse.json({
      response: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Processing error' },
      { status: 500 }
    );
  }
}
