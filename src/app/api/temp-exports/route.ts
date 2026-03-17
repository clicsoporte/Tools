
import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('This route is deprecated and has been moved to /routes/temp-exports', { status: 410 });
}
