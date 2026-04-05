import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { parse } from 'csv-parse/sync';
import prisma from '@/lib/prisma';

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('csv');
  if (!file || !(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 });

  try {
    const text = await file.text();
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
    const created = [];
    const errors = [];

    for (const record of records) {
      const name = record['name'] || record['Name'] || record['TeamName'] || record['team_name'];
      const password = record['password'] || record['Password'];
      if (!name || !password) { errors.push('Skipped row: missing name or password'); continue; }
      try {
        const team = await prisma.team.create({ data: { name: name.trim(), password: password.trim() } });
        created.push({ id: team.id, name });
      } catch {
        errors.push(`Team "${name}" already exists`);
      }
    }

    return NextResponse.json({ created: created.length, errors });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
