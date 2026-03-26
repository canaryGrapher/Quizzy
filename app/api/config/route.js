import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { key: 'contest_end_time' } });
  return NextResponse.json({ contestEndTime: setting?.value ?? null });
}
