import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import { emitToAll } from '@/lib/socket-emitter';

export async function POST(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const teamId = parseInt(params.id);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const newBanned = !team.isBanned;
  await prisma.team.update({ where: { id: teamId }, data: { isBanned: newBanned } });

  // Notify the team via socket
  if (newBanned) {
    emitToAll(`team:${teamId}:banished`, { teamName: team.name });
    // Also emit to their specific room
    if (global._io) {
      global._io.to(`team-${teamId}`).emit('quiz:banished', { message: 'You have been removed from this quiz.' });
    }
  }

  return NextResponse.json({ isBanned: newBanned });
}
