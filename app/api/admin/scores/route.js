import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const teams = await prisma.team.findMany({
    include: {
      answers: {
        select: { score: true, isCorrect: true, questionId: true },
      },
    },
  });

  const scores = teams
    .map(team => ({
      teamId: team.id,
      teamName: team.name,
      score: team.answers.reduce((sum, a) => sum + a.score, 0),
      correct: team.answers.filter(a => a.isCorrect).length,
      attempted: team.answers.length,
      answers: team.answers.map(a => ({ questionId: a.questionId, isCorrect: a.isCorrect })),
    }))
    .sort((a, b) => b.score - a.score || b.correct - a.correct || a.teamName.localeCompare(b.teamName));

  return NextResponse.json(scores);
}
