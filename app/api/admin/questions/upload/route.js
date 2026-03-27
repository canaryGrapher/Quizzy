import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { parse } from 'csv-parse/sync';
import prisma from '@/lib/prisma';

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get('quizId') ? parseInt(searchParams.get('quizId')) : null;
  if (!quizId) return NextResponse.json({ error: 'quizId query param required' }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get('csv');
  if (!file || !(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 });

  try {
    const text = await file.text();
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
    const created = [];
    const sectionCache = {};

    for (const record of records) {
      const question = record['Question'];
      if (!question) continue;

      // Resolve section
      let sectionId = null;
      const sectionName = record['Section']?.trim();
      if (sectionName) {
        if (!sectionCache[sectionName]) {
          let section = await prisma.section.findFirst({ where: { quizId, name: sectionName } });
          if (!section) {
            const count = await prisma.section.count({ where: { quizId } });
            section = await prisma.section.create({
              data: { quizId, name: sectionName, orderIndex: count },
            });
          }
          sectionCache[sectionName] = section;
        }
        sectionId = sectionCache[sectionName].id;
      }

      const correctIndices = new Set(
        (record['CorrectAnswers'] || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0)
      );
      const options = [];
      let i = 1;
      while (record[`Option${i}`] !== undefined && record[`Option${i}`] !== '') {
        options.push({ content: record[`Option${i}`], isCorrect: correctIndices.has(i) });
        i++;
      }

      const isMulti = ['true', '1', 'yes'].includes((record['isMultiAnswer'] || '').toLowerCase());
      const title = question.replace(/[#*`_]/g, '').trim().substring(0, 80);

      const q = await prisma.question.create({
        data: {
          quizId,
          sectionId,
          title,
          content: question,
          isMultiAnswer: isMulti,
          options: {
            create: options.map((opt, idx) => ({
              content: opt.content,
              isCorrect: opt.isCorrect,
              optionOrder: idx,
            })),
          },
        },
      });
      created.push(q.id);
    }

    return NextResponse.json({ created: created.length, ids: created });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
