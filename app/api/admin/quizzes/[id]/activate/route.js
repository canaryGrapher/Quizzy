import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import { emitToAll, updateLiveState } from '@/lib/socket-emitter';

export async function POST(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const quizId = parseInt(params.id);

  await prisma.$transaction([
    prisma.quiz.updateMany({ data: { isActive: false } }),
    prisma.quiz.update({ where: { id: quizId }, data: { isActive: true } }),
  ]);

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  const teams = await prisma.team.findMany({
    where: { isBanned: false },
    select: { id: true, name: true },
  });

  updateLiveState({
    activeQuizId: quizId,
    activeQuizTitle: quiz.title,
    timeLimitSeconds: quiz.timeLimitSeconds,
    currentQuestion: null,
    showResults: false,
    resultStats: null,
    fastestAnswers: [],
    allTeams: teams,
    submittedTeamIds: [],
  });

  emitToAll('quiz:activated', { quizId, title: quiz.title, timeLimitSeconds: quiz.timeLimitSeconds });

  return NextResponse.json({ success: true });
}
