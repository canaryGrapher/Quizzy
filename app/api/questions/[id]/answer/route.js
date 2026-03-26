import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/session';
import prisma from '@/lib/prisma';
import { emitToAll, getLiveState, updateLiveState } from '@/lib/socket-emitter';

export async function POST(request, { params }) {
  const session = await requireTeam();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check ban status
  const team = await prisma.team.findUnique({ where: { id: session.teamId } });
  if (!team || team.isBanned) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const { selectedOptions } = await request.json();
  const qid = parseInt(params.id);

  const question = await prisma.question.findUnique({ where: { id: qid }, include: { quiz: true } });
  if (!question || !question.isReleased) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check if timer already expired (server-enforced)
  if (question.quiz.timeLimitSeconds && question.releasedAt) {
    const expireAt = new Date(question.releasedAt).getTime() + question.quiz.timeLimitSeconds * 1000;
    if (Date.now() > expireAt) {
      return NextResponse.json({ error: 'Time has expired for this question' }, { status: 400 });
    }
  }

  const existing = await prisma.answer.findUnique({
    where: { teamId_questionId: { teamId: session.teamId, questionId: qid } },
  });
  if (existing) return NextResponse.json({ error: 'Already answered' }, { status: 400 });

  const selected = (Array.isArray(selectedOptions) ? selectedOptions : [selectedOptions])
    .map(Number).filter(Boolean);
  if (!selected.length) return NextResponse.json({ error: 'No option selected' }, { status: 400 });

  const correctOptions = await prisma.option.findMany({ where: { questionId: qid, isCorrect: true } });
  const correct = correctOptions.map(o => o.id);
  const isCorrect =
    correct.length === selected.length &&
    correct.every(id => selected.includes(id)) &&
    selected.every(id => correct.includes(id));

  const score = isCorrect ? question.quiz.pointsPerQuestion : 0;

  // Atomic rank assignment
  const answer = await prisma.$transaction(async (tx) => {
    const rank = await tx.answer.count({ where: { questionId: qid } }) + 1;
    return tx.answer.create({
      data: {
        teamId: session.teamId,
        questionId: qid,
        selectedOptions: JSON.stringify(selected),
        isCorrect,
        score,
        answerRank: rank,
      },
    });
  });

  // Update live state submission tracking
  const liveState = getLiveState();
  if (liveState.currentQuestion?.id === qid) {
    const updatedSubmitted = [...(liveState.submittedTeamIds || []), session.teamId];
    updateLiveState({
      fastestAnswers: [
        ...liveState.fastestAnswers,
        { rank: answer.answerRank, teamName: session.teamName, isCorrect, submittedAt: answer.submittedAt },
      ].sort((a, b) => a.rank - b.rank),
      submittedTeamIds: updatedSubmitted,
    });
  }

  // Emit real-time event to live screen
  emitToAll('answer:submitted', {
    questionId: qid,
    teamId: session.teamId,
    teamName: session.teamName,
    isCorrect,
    rank: answer.answerRank,
    submittedAt: answer.submittedAt,
  });

  // Stats for response
  const allAnswers = await prisma.answer.findMany({ where: { questionId: qid } });
  const countMap = {};
  for (const a of allAnswers) {
    try { for (const id of JSON.parse(a.selectedOptions)) countMap[id] = (countMap[id] || 0) + 1; } catch {}
  }

  return NextResponse.json({
    isCorrect,
    score,
    correctOptions: correct,
    optionStats: countMap,
    totalAnswered: allAnswers.length,
  });
}
