import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = parseInt(params.id);
  const body = await request.json();
  const data = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.isEnabled !== undefined) data.isEnabled = !!body.isEnabled;
  if (body.timeLimitSeconds !== undefined) data.timeLimitSeconds = body.timeLimitSeconds ? parseInt(body.timeLimitSeconds) : null;

  // Bulk release/unrelease all questions in section
  if (body.releaseAll !== undefined) {
    await prisma.question.updateMany({
      where: { sectionId: id },
      data: { isReleased: !!body.releaseAll, releasedAt: body.releaseAll ? new Date() : null },
    });
    return NextResponse.json({ success: true });
  }

  const section = await prisma.section.update({ where: { id }, data });
  return NextResponse.json({ id: section.id, name: section.name, isEnabled: section.isEnabled });
}

export async function DELETE(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = parseInt(params.id);
  await prisma.question.updateMany({ where: { sectionId: id }, data: { sectionId: null } });
  await prisma.section.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
