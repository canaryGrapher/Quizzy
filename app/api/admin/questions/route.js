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
      section: { select: { id: true, name: true } },
      _count: { select: { answers: true } },
    },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
  });

  const questionIds = questions.map(q => q.id);
  const allAnswers = await prisma.answer.findMany({
    where: { questionId: { in: questionIds } },
    select: { questionId: true, isCorrect: true },
  });

  const answersByQuestion = {};
  for (const a of allAnswers) {
    if (!answersByQuestion[a.questionId]) answersByQuestion[a.questionId] = [];
    answersByQuestion[a.questionId].push(a);
  }

  const withStats = questions.map((q) => {
    const answers = answersByQuestion[q.id] ?? [];
    return {
      id: q.id,
      quizId: q.quizId,
      sectionId: q.sectionId,
      sectionName: q.section?.name ?? null,
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
  });

  return NextResponse.json(withStats);
}

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { quizId, title, content, isMultiAnswer, options, sectionId } = await request.json();
  if (!quizId) return NextResponse.json({ error: 'quizId required' }, { status: 400 });
  if (!title || !content) return NextResponse.json({ error: 'Title and content required' }, { status: 400 });

  const question = await prisma.question.create({
    data: {
      quizId: parseInt(quizId),
      sectionId: sectionId ? parseInt(sectionId) : null,
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
