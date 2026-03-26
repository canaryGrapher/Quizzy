import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  const session = await requireTeam();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if team is banned
  const team = await prisma.team.findUnique({ where: { id: session.teamId } });
  if (!team || team.isBanned) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const qid = parseInt(params.id);
  const question = await prisma.question.findUnique({
    where: { id: qid },
    include: { quiz: true },
  });
  if (!question || !question.isReleased) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const options = await prisma.option.findMany({
    where: { questionId: qid },
    orderBy: { optionOrder: 'asc' },
  });
  const answer = await prisma.answer.findUnique({
    where: { teamId_questionId: { teamId: session.teamId, questionId: qid } },
  });

  const correctOptionIds = answer ? options.filter(o => o.isCorrect).map(o => o.id) : null;

  let optionStats = null;
  let totalAnswered = 0;
  if (answer) {
    const allAnswers = await prisma.answer.findMany({ where: { questionId: qid } });
    const countMap = {};
    for (const a of allAnswers) {
      try { for (const id of JSON.parse(a.selectedOptions)) countMap[id] = (countMap[id] || 0) + 1; } catch {}
    }
    optionStats = countMap;
    totalAnswered = allAnswers.length;
  }

  const allReleased = await prisma.question.findMany({
    where: { quizId: question.quizId, isReleased: true },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
  });
  const idx = allReleased.findIndex(q => q.id === question.id);

  // Compute time remaining (null if no timer or already expired)
  let timeRemaining = null;
  if (question.quiz.timeLimitSeconds && question.releasedAt && !answer) {
    const elapsed = Math.floor((Date.now() - new Date(question.releasedAt).getTime()) / 1000);
    timeRemaining = Math.max(0, question.quiz.timeLimitSeconds - elapsed);
  }

  return NextResponse.json({
    id: question.id,
    title: question.title,
    content: question.content,
    isMultiAnswer: question.isMultiAnswer,
    options: options.map(o => ({ id: o.id, content: o.content })),
    submitted: !!answer,
    selectedOptions: answer ? JSON.parse(answer.selectedOptions) : null,
    isCorrect: answer ? answer.isCorrect : null,
    correctOptions: correctOptionIds,
    score: answer ? answer.score : null,
    optionStats,
    totalAnswered,
    prevId: idx > 0 ? allReleased[idx - 1].id : null,
    nextId: idx < allReleased.length - 1 ? allReleased[idx + 1].id : null,
    questionNumber: idx + 1,
    totalQuestions: allReleased.length,
    // Timer info
    timeLimitSeconds: question.quiz.timeLimitSeconds,
    releasedAt: question.releasedAt?.toISOString() ?? null,
    timeRemaining,
  });
}
