import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function POST(request) {
  const { teamname, password } = await request.json();
  if (!teamname || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });

  if (teamname.toLowerCase() === 'admin') {
    const setting = await prisma.setting.findUnique({ where: { key: 'admin_password' } });
    if (setting?.value === password) {
      const session = await getSession();
      session.isAdmin = true;
      session.teamId = null;
      session.teamName = null;
      await session.save();
      return NextResponse.json({ redirect: '/admin' });
    }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const team = await prisma.team.findFirst({
    where: { name: { equals: teamname, mode: 'insensitive' } },
  });
  if (!team || team.password !== password)
    return NextResponse.json({ error: 'Invalid team name or password' }, { status: 401 });

  const session = await getSession();
  session.teamId = team.id;
  session.teamName = team.name;
  session.isAdmin = false;
  await session.save();
  return NextResponse.json({ redirect: '/contestant' });
}
