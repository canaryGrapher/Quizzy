import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import emitter from '@/lib/notifications';
import { emitToAll, getLiveState, updateLiveState } from '@/lib/socket-emitter';
import { scheduleAutoSubmit, cancelAutoSubmit } from '@/lib/question-timer';

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, questionId, sectionId } = await request.json();

  // ─── Release a question (DB + live screen) ─────────────────────────────────
  if (action === 'releaseQuestion') {
    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 });
    const qid = parseInt(questionId);

    const q = await prisma.question.findUnique({ where: { id: qid }, include: { quiz: true, section: { select: { name: true } } } });
    if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Block if previous timed question is still open
    if (q.quiz.timeLimitSeconds) {
      const activeTimed = await prisma.question.findFirst({
        where: { quizId: q.quizId, isReleased: true, id: { not: qid }, releasedAt: { not: null } },
        orderBy: { releasedAt: 'desc' },
      });
      if (activeTimed) {
        const expireAt = new Date(activeTimed.releasedAt).getTime() + q.quiz.timeLimitSeconds * 1000;
        if (Date.now() < expireAt) {
          const [teams, answers] = await Promise.all([
            prisma.team.count({ where: { isBanned: false } }),
            prisma.answer.count({ where: { questionId: activeTimed.id } }),
          ]);
          const pending = teams - answers;
          if (pending > 0) {
            const secsLeft = Math.ceil((expireAt - Date.now()) / 1000);
            return NextResponse.json({ error: `${pending} team${pending !== 1 ? 's' : ''} haven't submitted (${secsLeft}s left)`, blocked: true }, { status: 409 });
          }
        }
      }
    }

    const now = new Date();
    await prisma.question.update({ where: { id: qid }, data: { isReleased: true, releasedAt: now } });

    if (q.quiz.timeLimitSeconds) {
      scheduleAutoSubmit(qid, q.quiz.timeLimitSeconds * 1000);
    }

    // Contestant SSE notification
    emitter.emit('questionReleased', { type: 'questionReleased', id: qid, title: q.title });

    // Build live question payload
    const options = await prisma.option.findMany({ where: { questionId: qid }, orderBy: { optionOrder: 'asc' } });
    const existingAnswers = await prisma.answer.findMany({
      where: { questionId: qid },
      include: { team: { select: { name: true } } },
      orderBy: { answerRank: 'asc' },
    });
    const allTeams = await prisma.team.findMany({ where: { isBanned: false }, select: { id: true, name: true } });

    const questionData = {
      id: qid,
      title: q.title,
      content: q.content,
      isMultiAnswer: q.isMultiAnswer,
      sectionName: q.section?.name ?? null,
      releasedAt: now.toISOString(),
      timeLimitSeconds: q.quiz.timeLimitSeconds,
      options: options.map(o => ({ id: o.id, content: o.content })),
    };

    const fastestAnswers = existingAnswers.map(a => ({
      rank: a.answerRank,
      teamName: a.team.name,
      isCorrect: a.isCorrect,
      submittedAt: a.submittedAt,
    }));

    updateLiveState({
      currentQuestion: questionData,
      showResults: false,
      resultStats: null,
      fastestAnswers,
      allTeams,
      submittedTeamIds: existingAnswers.map(a => a.teamId),
    });

    emitToAll('question:show', { question: questionData, fastestAnswers, allTeams, submittedTeamIds: existingAnswers.map(a => a.teamId) });
    return NextResponse.json({ success: true });

  // ─── Unrelease a question ──────────────────────────────────────────────────
  } else if (action === 'unreleaseQuestion') {
    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 });
    const qid = parseInt(questionId);
    cancelAutoSubmit(qid);
    await prisma.question.update({ where: { id: qid }, data: { isReleased: false, releasedAt: null } });
    emitter.emit('questionUnreleased', { type: 'questionUnreleased', id: qid });

    const state = getLiveState();
    if (state.currentQuestion?.id === qid) {
      updateLiveState({ currentQuestion: null, showResults: false, resultStats: null, fastestAnswers: [], submittedTeamIds: [] });
      emitToAll('question:hide', {});
    }
    return NextResponse.json({ success: true });

  // ─── Show question on live screen (without DB release) ───────────────────
  } else if (action === 'showQuestion') {
    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 });
    const qid = parseInt(questionId);
    const question = await prisma.question.findUnique({ where: { id: qid }, include: { options: { orderBy: { optionOrder: 'asc' } }, quiz: true, section: { select: { name: true } } } });
    if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existingAnswers = await prisma.answer.findMany({
      where: { questionId: qid },
      include: { team: { select: { name: true } } },
      orderBy: { answerRank: 'asc' },
    });
    const allTeams = await prisma.team.findMany({ where: { isBanned: false }, select: { id: true, name: true } });

    const questionData = {
      id: qid,
      title: question.title,
      content: question.content,
      isMultiAnswer: question.isMultiAnswer,
      sectionName: question.section?.name ?? null,
      releasedAt: question.releasedAt?.toISOString() ?? null,
      timeLimitSeconds: question.quiz.timeLimitSeconds,
      options: question.options.map(o => ({ id: o.id, content: o.content })),
    };

    updateLiveState({
      currentQuestion: questionData,
      showResults: false,
      resultStats: null,
      fastestAnswers: existingAnswers.map(a => ({ rank: a.answerRank, teamName: a.team.name, isCorrect: a.isCorrect, submittedAt: a.submittedAt })),
      allTeams,
      submittedTeamIds: existingAnswers.map(a => a.teamId),
    });

    emitToAll('question:show', {
      question: questionData,
      fastestAnswers: getLiveState().fastestAnswers,
      allTeams,
      submittedTeamIds: existingAnswers.map(a => a.teamId),
    });
    return NextResponse.json({ success: true });

  // ─── Hide question from live screen ──────────────────────────────────────
  } else if (action === 'hideQuestion') {
    updateLiveState({ currentQuestion: null, showResults: false, resultStats: null, fastestAnswers: [], submittedTeamIds: [] });
    emitToAll('question:hide', {});
    return NextResponse.json({ success: true });

  // ─── Show answer results ──────────────────────────────────────────────────
  } else if (action === 'showResults') {
    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 });
    const qid = parseInt(questionId);
    const [options, allAnswers] = await Promise.all([
      prisma.option.findMany({ where: { questionId: qid }, orderBy: { optionOrder: 'asc' } }),
      prisma.answer.findMany({ where: { questionId: qid } }),
    ]);
    const countMap = {};
    for (const a of allAnswers) {
      try { for (const id of JSON.parse(a.selectedOptions)) countMap[id] = (countMap[id] || 0) + 1; } catch {}
    }
    const resultStats = {
      correctOptionIds: options.filter(o => o.isCorrect).map(o => o.id),
      options: options.map(o => ({ id: o.id, content: o.content, isCorrect: o.isCorrect })),
      optionStats: countMap,
      totalAnswered: allAnswers.length,
    };
    updateLiveState({ showResults: true, resultStats });
    emitToAll('results:show', resultStats);
    return NextResponse.json({ success: true });

  // ─── Hide results ─────────────────────────────────────────────────────────
  } else if (action === 'hideResults') {
    updateLiveState({ showResults: false, resultStats: null });
    emitToAll('results:hide', {});
    return NextResponse.json({ success: true });

  // ─── Reset fastest answers feed ───────────────────────────────────────────
  } else if (action === 'resetFeed') {
    updateLiveState({ fastestAnswers: [] });
    emitToAll('feed:reset', {});
    return NextResponse.json({ success: true });

  // ─── Enable / disable a section ───────────────────────────────────────────
  } else if (action === 'enableSection' || action === 'disableSection') {
    if (!sectionId) return NextResponse.json({ error: 'sectionId required' }, { status: 400 });
    const sid = parseInt(sectionId);
    const isEnabled = action === 'enableSection';
    const section = await prisma.section.update({ where: { id: sid }, data: { isEnabled } });
    emitToAll('section:toggled', { sectionId: sid, isEnabled });
    return NextResponse.json({ success: true, id: section.id, isEnabled: section.isEnabled });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
