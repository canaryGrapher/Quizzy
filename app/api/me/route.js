import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (session.isAdmin) return NextResponse.json({ type: 'admin' });
  if (session.teamId) return NextResponse.json({ type: 'team', teamId: session.teamId, teamName: session.teamName });
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}
