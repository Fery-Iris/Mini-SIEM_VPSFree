import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');

  if (!ip) {
    return NextResponse.json({ error: 'IP parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'VirusTotal API Key is not configured on the server.' },
      { status: 500 }
    );
  }

  try {
    const vtResponse = await fetch(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
      method: 'GET',
      headers: {
        'x-apikey': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!vtResponse.ok) {
      const errorData = await vtResponse.json();
      return NextResponse.json(
        { error: 'VirusTotal API error', details: errorData },
        { status: vtResponse.status }
      );
    }

    const data = await vtResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching VirusTotal data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from VirusTotal' },
      { status: 500 }
    );
  }
}
