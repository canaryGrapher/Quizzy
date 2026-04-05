import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

const sessionOptions = {
  password: process.env.SESSION_SECRET || 'quizzy-session-secret-must-be-32-chars!!',
  cookieName: 'quizzy_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'lax',
  },
};

export async function getSession() {
  return getIronSession(cookies(), sessionOptions);
}

export async function requireTeam() {
  const session = await getSession();
  if (!session.teamId) return null;
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session.isAdmin) return null;
  return session;
}
