import { NextResponse } from 'next/server';

export async function GET(req) {
  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
  };

  return NextResponse.json(config);
}
