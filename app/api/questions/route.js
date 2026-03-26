import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await requireTeam();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const activeQuiz = await prisma.quiz.findFirst({ where: { isActive: true } });
  if (!activeQuiz) return NextResponse.json([]);

  const questions = await prisma.question.findMany({
    where: { quizId: activeQuiz.id, isReleased: true },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
  });

  const answers = await prisma.answer.findMany({ where: { teamId: session.teamId } });
  const answerMap = Object.fromEntries(answers.map(a => [a.questionId, a]));

  return NextResponse.json(questions.map(q => ({
    id: q.id,
    title: q.title,
    isMultiAnswer: q.isMultiAnswer,
    answered: !!answerMap[q.id],
    isCorrect: answerMap[q.id] ? answerMap[q.id].isCorrect : null,
    score: answerMap[q.id] ? answerMap[q.id].score : null,
  })));
}
