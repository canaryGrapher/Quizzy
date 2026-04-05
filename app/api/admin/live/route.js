import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { getLiveState } from '@/lib/socket-emitter';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(getLiveState());
}
