import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { content, to } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Message content required' }, { status: 400 });

  const io = global._io;
  if (!io) return NextResponse.json({ error: 'Socket server not available' }, { status: 503 });

  const payload = {
    content: content.trim(),
    to,
    sentAt: new Date().toISOString(),
  };

  if (!to || to === 'everyone') {
    io.emit('message:received', payload);
  } else if (to.startsWith('team-')) {
    io.to(to).emit('message:received', payload);
  }

  return NextResponse.json({ success: true });
}
