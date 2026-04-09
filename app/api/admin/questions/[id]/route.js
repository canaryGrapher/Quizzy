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
    include: { quiz: true, section: { select: { timeLimitSeconds: true } } },
  });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isReleasing = body.isReleased === true && !before.isReleased;

  const effectiveTimeLimit = before.timeLimitSeconds ?? before.section?.timeLimitSeconds ?? before.quiz.timeLimitSeconds ?? null;

  // Block release if timed and a previous question's timer is still running
  if (isReleasing && before.quiz.timeLimitSeconds) {
    const activeTimed = await prisma.question.findFirst({
      where: {
        quizId: before.quizId,
        isReleased: true,
        id: { not: qid },
        releasedAt: { not: null },
      },
      orderBy: { releasedAt: 'desc' },
      include: { section: { select: { timeLimitSeconds: true } } },
    });
    if (activeTimed) {
      const activeLimit = activeTimed.timeLimitSeconds ?? activeTimed.section?.timeLimitSeconds ?? before.quiz.timeLimitSeconds ?? null;
      const expireAt = new Date(activeTimed.releasedAt).getTime() + (activeLimit ?? before.quiz.timeLimitSeconds) * 1000;
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
  if (body.timeLimitSeconds !== undefined) data.timeLimitSeconds = body.timeLimitSeconds ? parseInt(body.timeLimitSeconds) : null;
  if (body.starterCode !== undefined) data.starterCode = body.starterCode ? JSON.stringify(body.starterCode) : null;
  if (body.allowedLanguages !== undefined) data.allowedLanguages = JSON.stringify(body.allowedLanguages);

  const after = await prisma.question.update({ where: { id: qid }, data });

  // Handle option and test case edits (only for unreleased questions)
  if (!before.isReleased && body.options !== undefined) {
    await prisma.option.deleteMany({ where: { questionId: qid } });
    if (body.options?.length) {
      await prisma.option.createMany({
        data: body.options.map((opt, i) => ({
          questionId: qid, content: opt.content, isCorrect: !!opt.isCorrect, optionOrder: i,
        })),
      });
    }
  }
  if (!before.isReleased && body.testCases !== undefined) {
    await prisma.testCase.deleteMany({ where: { questionId: qid } });
    if (body.testCases?.length) {
      await prisma.testCase.createMany({
        data: body.testCases.map((tc, i) => ({
          questionId: qid, input: tc.input ?? '', expectedOutput: tc.expectedOutput ?? '',
          isHidden: !!tc.isHidden, orderIndex: i,
        })),
      });
    }
  }

  // Handle release → schedule auto-submit timer, notify live screen + contestants
  if (isReleasing) {
    if (effectiveTimeLimit) {
      scheduleAutoSubmit(qid, effectiveTimeLimit * 1000);
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
