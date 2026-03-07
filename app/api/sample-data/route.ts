import { NextResponse } from 'next/server';
import { generateSampleData } from '@/lib/sampleData';

export async function GET() {
  try {
    const data = generateSampleData();
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
