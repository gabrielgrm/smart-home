import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 });
    }

    const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}`;
    const basic = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basic}`,
      },
    });

    const text = await res.text();
    const status = res.status;
    let data = null;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    return NextResponse.json({ status, data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
