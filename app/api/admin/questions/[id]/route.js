import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import emitter from '@/lib/notifications';
import { emitToAll, getLiveState, updateLiveState } from '@/lib/socket-emitter';
import { scheduleAutoSubmit, cancelAutoSubmit } from '@/lib/question-timer';

export async function PUT(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const qid = parseInt(params.id);

  const before = await prisma.question.findUnique({
    where: { id: qid },
    include: { quiz: true },
  });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isReleasing = body.isReleased === true && !before.isReleased;

  // Block release if quiz is timed and a previous question's timer is still running
  if (isReleasing && before.quiz.timeLimitSeconds) {
    const activeTimed = await prisma.question.findFirst({
      where: {
        quizId: before.quizId,
        isReleased: true,
        id: { not: qid },
        releasedAt: { not: null },
      },
      orderBy: { releasedAt: 'desc' },
    });
    if (activeTimed) {
      const expireAt = new Date(activeTimed.releasedAt).getTime() + before.quiz.timeLimitSeconds * 1000;
      if (Date.now() < expireAt) {
        const secsLeft = Math.ceil((expireAt - Date.now()) / 1000);
        // Count unsubmitted non-banned teams
        const [teams, answers] = await Promise.all([
          prisma.team.count({ where: { isBanned: false } }),
          prisma.answer.count({ where: { questionId: activeTimed.id } }),
        ]);
        const pending = teams - answers;
        if (pending > 0) {
          return NextResponse.json({
            error: `Cannot release: ${pending} team${pending !== 1 ? 's' : ''} haven't submitted yet (${secsLeft}s left)`,
            blocked: true,
          }, { status: 409 });
        }
      }
    }
  }

  const data = {};
  if (body.isReleased !== undefined) data.isReleased = !!body.isReleased;
  if (isReleasing) data.releasedAt = new Date();
  if (body.isReleased === false) data.releasedAt = null;
  if (body.title !== undefined) data.title = body.title;
  if (body.content !== undefined) data.content = body.content;
  if (body.isMultiAnswer !== undefined) data.isMultiAnswer = !!body.isMultiAnswer;

  const after = await prisma.question.update({ where: { id: qid }, data });

  // Handle release → schedule auto-submit timer, notify live screen + contestants
  if (isReleasing) {
    if (before.quiz.timeLimitSeconds) {
      scheduleAutoSubmit(qid, before.quiz.timeLimitSeconds * 1000);
    }

    // Contestant SSE notification
    emitter.emit('questionReleased', { type: 'questionReleased', id: after.id, title: after.title });

  } else if (before.isReleased && !after.isReleased) {
    // Unreleasing — cancel any pending timer
    cancelAutoSubmit(qid);
    emitter.emit('questionUnreleased', { type: 'questionUnreleased', id: after.id });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const qid = parseInt(params.id);
  cancelAutoSubmit(qid);
  await prisma.question.delete({ where: { id: qid } });
  return NextResponse.json({ success: true });
}
