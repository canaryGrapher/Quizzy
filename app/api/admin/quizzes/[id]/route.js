import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, description, pointsPerQuestion, timeLimitSeconds } = await request.json();
  const data = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (pointsPerQuestion !== undefined) data.pointsPerQuestion = parseInt(pointsPerQuestion) || 10;
  if (timeLimitSeconds !== undefined) {
    data.timeLimitSeconds = timeLimitSeconds ? parseInt(timeLimitSeconds) : null;
  }

  await prisma.quiz.update({ where: { id: parseInt(params.id) }, data });
  return NextResponse.json({ success: true });
}

export async function DELETE(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.quiz.delete({ where: { id: parseInt(params.id) } });
  return NextResponse.json({ success: true });
}
