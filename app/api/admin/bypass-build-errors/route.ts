// This is a temporary file to bypass build errors with missing exports
// It's intentionally named in a way to be obvious that it's a workaround

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: "This is a workaround file to bypass build errors with missing exports" 
  });
}

// Export the compatible route handler methods only
export const dynamic = 'force-dynamic';