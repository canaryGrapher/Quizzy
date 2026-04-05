import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const qid = parseInt(params.id);

  const [answers, options] = await Promise.all([
    prisma.answer.findMany({
      where: { questionId: qid },
      include: { team: { select: { name: true } } },
      orderBy: [{ answerRank: 'asc' }, { submittedAt: 'asc' }],
    }),
    prisma.option.findMany({
      where: { questionId: qid },
      orderBy: { optionOrder: 'asc' },
    }),
  ]);

  const countMap = {};
  for (const a of answers) {
    try {
      for (const id of JSON.parse(a.selectedOptions)) {
        countMap[id] = (countMap[id] || 0) + 1;
      }
    } catch {}
  }

  return NextResponse.json({
    answers: answers.map(a => ({
      teamName: a.team.name,
      isCorrect: a.isCorrect,
      score: a.score,
      submittedAt: a.submittedAt,
      selectedOptions: JSON.parse(a.selectedOptions),
      rank: a.answerRank,
    })),
    options: options.map(o => ({
      id: o.id,
      content: o.content,
      isCorrect: o.isCorrect,
    })),
    stats: countMap,
    total: answers.length,
  });
}
