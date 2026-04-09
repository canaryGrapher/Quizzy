import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get('quizId') ? parseInt(searchParams.get('quizId')) : null;
  if (!quizId) return NextResponse.json({ error: 'quizId required' }, { status: 400 });

  const sections = await prisma.section.findMany({
    where: { quizId },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
    include: { _count: { select: { questions: true } } },
  });

  return NextResponse.json(sections.map(s => ({
    id: s.id,
    quizId: s.quizId,
    name: s.name,
    isEnabled: s.isEnabled,
    orderIndex: s.orderIndex,
    timeLimitSeconds: s.timeLimitSeconds,
    questionCount: s._count.questions,
  })));
}

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { quizId, name } = await request.json();
  if (!quizId || !name?.trim()) return NextResponse.json({ error: 'quizId and name required' }, { status: 400 });

  const count = await prisma.section.count({ where: { quizId } });
  const section = await prisma.section.create({
    data: { quizId, name: name.trim(), orderIndex: count },
  });

  return NextResponse.json({ id: section.id, name: section.name, isEnabled: section.isEnabled, orderIndex: section.orderIndex, questionCount: 0 });
}
