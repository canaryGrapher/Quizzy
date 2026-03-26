import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get('quizId') ? parseInt(searchParams.get('quizId')) : undefined;

  const questions = await prisma.question.findMany({
    where: quizId ? { quizId } : undefined,
    include: {
      options: { orderBy: { optionOrder: 'asc' } },
      _count: { select: { answers: true } },
    },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
  });

  const withStats = await Promise.all(questions.map(async (q) => {
    const answers = await prisma.answer.findMany({
      where: { questionId: q.id },
      select: { isCorrect: true },
    });
    return {
      id: q.id,
      quizId: q.quizId,
      title: q.title,
      content: q.content,
      isMultiAnswer: q.isMultiAnswer,
      isReleased: q.isReleased,
      orderIndex: q.orderIndex,
      options: q.options.map(o => ({
        id: o.id,
        content: o.content,
        isCorrect: o.isCorrect,
        optionOrder: o.optionOrder,
      })),
      stats: {
        attempted: answers.length,
        correct: answers.filter(a => a.isCorrect).length,
      },
    };
  }));

  return NextResponse.json(withStats);
}

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { quizId, title, content, isMultiAnswer, options } = await request.json();
  if (!quizId) return NextResponse.json({ error: 'quizId required' }, { status: 400 });
  if (!title || !content) return NextResponse.json({ error: 'Title and content required' }, { status: 400 });

  const question = await prisma.question.create({
    data: {
      quizId: parseInt(quizId),
      title,
      content,
      isMultiAnswer: !!isMultiAnswer,
    },
  });

  if (options?.length) {
    await prisma.option.createMany({
      data: options.map((opt, i) => ({
        questionId: question.id,
        content: opt.content,
        isCorrect: !!opt.isCorrect,
        optionOrder: i,
      })),
    });
  }

  return NextResponse.json({ id: question.id });
}
