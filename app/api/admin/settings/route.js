import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.setting.findMany();
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]));

  return NextResponse.json({
    adminPassword: map.admin_password ?? '',
    contestEndTime: map.contest_end_time ?? '',
    pointsPerQuestion: map.points_per_question ?? '10',
  });
}

export async function PUT(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { adminPassword, contestEndTime, pointsPerQuestion } = await request.json();

  const upserts = [];
  if (adminPassword) upserts.push({ key: 'admin_password', value: adminPassword });
  if (contestEndTime) upserts.push({ key: 'contest_end_time', value: contestEndTime });
  if (pointsPerQuestion) upserts.push({ key: 'points_per_question', value: String(pointsPerQuestion) });

  await Promise.all(upserts.map(({ key, value }) =>
    prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
  ));

  return NextResponse.json({ success: true });
}
