import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    alerts: [],
    meta: {
      message: 'Alert rules will be backed by Neon/Upstash in the ingestion milestone.',
    },
  });
}

