import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const qid = parseInt(params.id);
  const testCases = await prisma.testCase.findMany({
    where: { questionId: qid },
    orderBy: { orderIndex: 'asc' },
  });
  return NextResponse.json(testCases);
}

export async function POST(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const qid = parseInt(params.id);
  const { input = '', expectedOutput, isHidden = false } = await request.json();
  if (expectedOutput === undefined || expectedOutput === null) {
    return NextResponse.json({ error: 'expectedOutput required' }, { status: 400 });
  }

  const count = await prisma.testCase.count({ where: { questionId: qid } });
  const tc = await prisma.testCase.create({
    data: { questionId: qid, input, expectedOutput, isHidden, orderIndex: count },
  });
  return NextResponse.json(tc);
}
