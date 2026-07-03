import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    if (process.env.BACKEND_SCRAPE_SECRET) {
      headers['x-scrape-secret'] = process.env.BACKEND_SCRAPE_SECRET;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/scrape/run`, {
      method: 'POST',
      headers,
    });

    const data = await response.json();

    return NextResponse.json({ success: response.ok, data }, { status: response.status });
  } catch (error) {
    console.error('Scrape API error:', error);
    return NextResponse.json(
      { error: 'Scraping error' },
      { status: 500 }
    );
  }
}
