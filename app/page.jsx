'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [teamname, setTeamname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.type === 'admin') router.replace('/admin');
      else if (d.type === 'team') router.replace('/contestant');
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamname: teamname.trim(), password }),
      });
      const data = await res.json();
      if (res.ok) { router.push(data.redirect); return; }
      setError(data.error || 'Invalid credentials');
    } catch {
      setError('Connection error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-apple-gray flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-apple-blue rounded-apple-xl flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold shadow-apple-md">
            ₿
          </div>
          <h1 className="text-3xl font-bold text-apple-text tracking-tight">Quizzy</h1>
          <p className="text-apple-text-2 text-sm mt-1">Cryptocurrency Knowledge Challenge</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-apple-xl shadow-apple-md p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Team Name</label>
              <input
                type="text"
                value={teamname}
                onChange={e => setTeamname(e.target.value)}
                placeholder="e.g. TeamAlpha"
                required
                className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent placeholder-apple-text-3 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent placeholder-apple-text-3 transition-all"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-apple-blue text-white font-semibold py-3 rounded-apple text-sm hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>
                  Authenticating…
                </>
              ) : 'Enter Arena'}
            </button>
          </form>
          <div className="mt-5 pt-5 border-t border-apple-gray-2 text-center">
            <a href="/admin" className="text-xs text-apple-text-3 hover:text-apple-blue transition-colors">Admin Portal →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
