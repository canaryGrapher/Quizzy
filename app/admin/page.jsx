'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AnswerChart from '@/components/AnswerChart';

/* ─── Markdown renderer ─── */
function renderMd(text) {
  if (!text) return '';
  return text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupolis])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

/* ─── Modal ─── */
function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-apple-xl shadow-apple-lg w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-apple-gray-2 flex-shrink-0">
          <h2 className="text-base font-bold text-apple-text">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-apple-gray hover:bg-apple-gray-2 transition-colors text-apple-text-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─── Spinner ─── */
function Spinner({ size = 5 }) {
  return (
    <svg className={`animate-spin h-${size} w-${size} text-apple-blue`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
    </svg>
  );
}

/* ─── Medal ─── */
function Medal({ rank }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-bold text-apple-text-3 w-6 text-center">{rank}</span>;
}

/* ════════════════════════════════════════
   ADD QUESTION MODAL
   ════════════════════════════════════════ */
function AddQuestionModal({ quizId, sections, onClose, onAdded }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isMultiAnswer, setIsMultiAnswer] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [options, setOptions] = useState([
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateOption = (i, field, value) => {
    setOptions(prev => {
      const next = [...prev];
      if (field === 'isCorrect' && !isMultiAnswer) {
        next.forEach((o, idx) => { next[idx] = { ...o, isCorrect: idx === i ? value : false }; });
      } else {
        next[i] = { ...next[i], [field]: value };
      }
      return next;
    });
  };

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (!content.trim()) { setError('Content is required'); return; }
    const filled = options.filter(o => o.content.trim());
    if (filled.length < 2) { setError('At least 2 options required'); return; }
    if (!filled.some(o => o.isCorrect)) { setError('At least one correct answer required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, title: title.trim(), content: content.trim(), isMultiAnswer, options: filled, sectionId: sectionId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onAdded();
      onClose();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <Modal title="Add Question" onClose={onClose} wide>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Title / Short Label</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. What is Bitcoin?" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Question Content (Markdown)</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Full question text, supports **markdown**..." className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-y font-mono" />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setIsMultiAnswer(v => !v)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMultiAnswer ? 'bg-apple-blue' : 'bg-apple-gray-3'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isMultiAnswer ? 'translate-x-6' : 'translate-x-1'}`}/>
          </button>
          <span className="text-sm text-apple-text font-medium">Multi-answer</span>
        </div>
        {sections?.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Section (optional)</label>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all">
              <option value="">No section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Options</label>
            {options.length < 8 && <button onClick={() => setOptions(p => [...p, { content: '', isCorrect: false }])} className="text-xs font-semibold text-apple-blue hover:underline">+ Add option</button>}
          </div>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className={`flex items-center gap-2 p-3 rounded-apple border transition-colors ${opt.isCorrect ? 'border-apple-green bg-green-50' : 'border-apple-gray-2 bg-white'}`}>
                <span className="w-5 h-5 rounded-full bg-apple-gray-3 flex items-center justify-center text-xs font-bold text-apple-text-2 flex-shrink-0">{String.fromCharCode(65 + i)}</span>
                <input value={opt.content} onChange={e => updateOption(i, 'content', e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="flex-1 bg-transparent text-sm text-apple-text focus:outline-none placeholder-apple-text-3" />
                <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
                  <input type={isMultiAnswer ? 'checkbox' : 'radio'} name="correct" checked={opt.isCorrect} onChange={e => updateOption(i, 'isCorrect', e.target.checked)} className="accent-apple-green" />
                  <span className="text-xs text-apple-text-2">Correct</span>
                </label>
                {options.length > 2 && (
                  <button onClick={() => setOptions(p => p.filter((_, idx) => idx !== i))} className="text-apple-text-3 hover:text-apple-red">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Creating…' : 'Create Question'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   UPLOAD QUESTIONS CSV MODAL
   ════════════════════════════════════════ */
function UploadQuestionsModal({ quizId, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const upload = async () => {
    if (!file) { setError('Please select a CSV file'); return; }
    setError(''); setUploading(true);
    const form = new FormData();
    form.append('csv', file);
    try {
      const res = await fetch(`/api/admin/questions/upload?quizId=${quizId}`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed'); setUploading(false); return; }
      setResult(data);
      onUploaded();
    } catch { setError('Network error'); }
    setUploading(false);
  };

  return (
    <Modal title="Upload Questions CSV" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        {result ? (
          <div className="bg-green-50 border border-green-200 rounded-apple p-4">
            <p className="text-apple-green font-semibold text-sm">Uploaded {result.created} question{result.created !== 1 ? 's' : ''}.</p>
            <button onClick={onClose} className="mt-3 text-sm font-semibold text-apple-blue">Done</button>
          </div>
        ) : (
          <>
            <div className="bg-apple-gray border border-apple-gray-2 rounded-apple p-4">
              <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">CSV Format</p>
              <pre className="text-xs text-apple-text font-mono overflow-x-auto">{`Section,Question,isMultiAnswer,Option1,Option2,Option3,Option4,CorrectAnswers\n"Round 1","What is BTC?",false,"Digital gold","A stock","A bond","CBDC","1"\n"Round 1","Pick all...",true,"opt1","opt2","opt3","opt4","1,3"\n,"No section Q",false,"A","B","C","D","2"`}</pre>
              <p className="text-xs text-apple-text-3 mt-1">Section column is optional — leave blank for no section.</p>
            </div>
            <input type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files[0])} className="w-full text-sm text-apple-text-2 file:mr-3 file:py-2 file:px-4 file:rounded-apple file:border-0 file:text-sm file:font-semibold file:bg-apple-blue file:text-white hover:file:bg-blue-600 cursor-pointer" />
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
              <button onClick={upload} disabled={!file || uploading} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2">
                {uploading && <Spinner size={4} />}{uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   CREATE QUIZ MODAL
   ════════════════════════════════════════ */
function CreateQuizModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsPerQuestion, setPointsPerQuestion] = useState('10');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          pointsPerQuestion: parseInt(pointsPerQuestion) || 10,
          timeLimitSeconds: timeLimitSeconds ? parseInt(timeLimitSeconds) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onCreated(data);
      onClose();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <Modal title="Create Quiz" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Quiz Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Crypto Basics Round 1" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Description (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Short description..." className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Points Per Question</label>
            <input type="number" min="1" max="1000" value={pointsPerQuestion} onChange={e => setPointsPerQuestion(e.target.value)} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Time Limit (sec, optional)</label>
            <input type="number" min="5" max="600" value={timeLimitSeconds} onChange={e => setTimeLimitSeconds(e.target.value)} placeholder="e.g. 60" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Creating…' : 'Create Quiz'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   RESPONSES MODAL
   ════════════════════════════════════════ */
function ResponsesModal({ question, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`/api/admin/questions/${question.id}/answers`).then(r => r.json()).then(setData).catch(() => {});
  }, [question.id]);

  return (
    <Modal title={`Responses: ${question.title}`} onClose={onClose} wide>
      {!data ? (
        <div className="flex justify-center py-8"><Spinner size={8} /></div>
      ) : (
        <div className="space-y-4">
          <AnswerChart
            options={data.options || []}
            optionStats={data.stats || {}}
            totalAnswered={data.total || 0}
            correctOptions={(data.options || []).filter(o => o.isCorrect).map(o => o.id)}
            selectedOptions={[]}
          />
          {data.answers?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">Team Answers ({data.total})</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data.answers.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-2 rounded-apple text-sm ${r.isCorrect ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                    <div className="flex items-center gap-2">
                      {r.rank && <span className="text-xs text-apple-text-3 font-mono">#{r.rank}</span>}
                      <span className="font-medium text-apple-text">{r.teamName}</span>
                    </div>
                    <span className={`text-xs font-bold ${r.isCorrect ? 'text-apple-green' : 'text-apple-red'}`}>
                      {r.isCorrect ? `+${r.score}` : '0'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ════════════════════════════════════════
   LIVE SCORES TAB
   ════════════════════════════════════════ */
function LiveScoresTab() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadScores = useCallback(async () => {
    try {
      const data = await fetch('/api/admin/scores').then(r => r.json());
      if (Array.isArray(data)) setScores(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadScores();
    const id = setInterval(loadScores, 5000);
    return () => clearInterval(id);
  }, [loadScores]);

  const maxScore = scores.length > 0 ? Math.max(...scores.map(s => s.score || 0), 1) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Live Scores</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">{scores.length} teams · auto-refreshes every 5s</p>
        </div>
        <button onClick={loadScores} className="p-2 text-apple-text-3 hover:text-apple-blue transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : scores.length === 0 ? (
        <div className="text-center py-16 text-apple-text-2">No teams registered yet.</div>
      ) : (
        <div className="space-y-3">
          {scores.map((team, i) => {
            const rank = i + 1;
            const barPct = maxScore > 0 ? Math.round((team.score / maxScore) * 100) : 0;
            return (
              <div key={team.teamId} className={`bg-white border rounded-apple-lg p-4 shadow-apple-sm ${rank === 1 ? 'border-yellow-300' : rank === 2 ? 'border-apple-gray-3' : rank === 3 ? 'border-amber-300' : 'border-apple-gray-2'}`}>
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-8 flex items-center justify-center"><Medal rank={rank} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-apple-text truncate">{team.teamName}</p>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-xs text-apple-text-2">{team.correct}/{team.attempted} correct</span>
                        <span className="text-lg font-bold font-mono text-apple-blue">{team.score}</span>
                        <span className="text-xs text-apple-text-3">pts</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-apple-gray-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${barPct}%`, background: rank === 1 ? '#FF9500' : rank === 2 ? '#8E8E93' : rank === 3 ? '#C17F24' : '#007AFF' }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   MANAGE SECTIONS MODAL
   ════════════════════════════════════════ */
function ManageSectionsModal({ quizId, sections, onClose, onChange }) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [busy, setBusy] = useState({});

  const addSection = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await fetch('/api/admin/sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId, name: newName.trim() }) });
      setNewName('');
      onChange();
    } catch {}
    setAdding(false);
  };

  const renameSection = async (id) => {
    if (!renamingValue.trim()) return;
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/admin/sections/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renamingValue.trim() }) });
      setRenamingId(null);
      onChange();
    } catch {}
    setBusy(prev => ({ ...prev, [id]: false }));
  };

  const deleteSection = async (id, name) => {
    if (!confirm(`Delete section "${name}"? Questions in it will become unsectioned.`)) return;
    setBusy(prev => ({ ...prev, [`del-${id}`]: true }));
    try {
      await fetch(`/api/admin/sections/${id}`, { method: 'DELETE' });
      onChange();
    } catch {}
    setBusy(prev => ({ ...prev, [`del-${id}`]: false }));
  };

  return (
    <Modal title="Manage Sections" onClose={onClose}>
      <div className="space-y-4">
        {sections.length === 0 ? (
          <p className="text-sm text-apple-text-2 text-center py-4">No sections yet. Add one below.</p>
        ) : (
          <div className="space-y-2">
            {sections.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-3 border border-apple-gray-2 rounded-apple bg-white">
                {renamingId === s.id ? (
                  <>
                    <input autoFocus value={renamingValue} onChange={e => setRenamingValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') renameSection(s.id); if (e.key === 'Escape') setRenamingId(null); }} className="flex-1 text-sm px-2 py-1 border border-apple-gray-3 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue" />
                    <button onClick={() => renameSection(s.id)} disabled={busy[s.id]} className="text-xs font-semibold text-apple-blue hover:underline">Save</button>
                    <button onClick={() => setRenamingId(null)} className="text-xs text-apple-text-3 hover:text-apple-text">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-apple-text">{s.name}</span>
                    <span className="text-xs text-apple-text-3">{s.questionCount} q</span>
                    <button onClick={() => { setRenamingId(s.id); setRenamingValue(s.name); }} className="p-1 text-apple-text-3 hover:text-apple-blue transition-colors" title="Rename">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={() => deleteSection(s.id, s.name)} disabled={busy[`del-${s.id}`]} className="p-1 text-apple-text-3 hover:text-apple-red transition-colors" title="Delete section">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-2 border-t border-apple-gray-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSection()} placeholder="New section name…" className="flex-1 px-3 py-2 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          <button onClick={addSection} disabled={!newName.trim() || adding} className="px-4 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {adding && <Spinner size={3} />}Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════
   QUESTIONS LIST (inside a quiz)
   ════════════════════════════════════════ */
function QuizQuestionsPanel({ quiz, onBack }) {
  const [questions, setQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [toggling, setToggling] = useState({});
  const [deleting, setDeleting] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const [responsesQ, setResponsesQ] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [qdata, sdata] = await Promise.all([
        fetch(`/api/admin/questions?quizId=${quiz.id}`).then(r => r.json()),
        fetch(`/api/admin/sections?quizId=${quiz.id}`).then(r => r.json()),
      ]);
      if (Array.isArray(qdata)) setQuestions(qdata);
      if (Array.isArray(sdata)) setSections(sdata);
    } catch {}
    setLoading(false);
  }, [quiz.id]);

  const loadQuestions = loadAll;

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleRelease = async (q) => {
    setToggling(prev => ({ ...prev, [q.id]: true }));
    try {
      await fetch(`/api/admin/questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReleased: !q.isReleased }),
      });
      loadQuestions();
    } catch {}
    setToggling(prev => ({ ...prev, [q.id]: false }));
  };

  const deleteQuestion = async (q) => {
    if (!confirm(`Delete "${q.title}"?`)) return;
    setDeleting(prev => ({ ...prev, [q.id]: true }));
    try {
      await fetch(`/api/admin/questions/${q.id}`, { method: 'DELETE' });
      loadQuestions();
    } catch {}
    setDeleting(prev => ({ ...prev, [q.id]: false }));
  };

  return (
    <div>
      {showAdd && <AddQuestionModal quizId={quiz.id} sections={sections} onClose={() => setShowAdd(false)} onAdded={loadAll} />}
      {showUpload && <UploadQuestionsModal quizId={quiz.id} onClose={() => setShowUpload(false)} onUploaded={loadAll} />}
      {showSections && <ManageSectionsModal quizId={quiz.id} sections={sections} onClose={() => setShowSections(false)} onChange={loadAll} />}
      {responsesQ && <ResponsesModal question={responsesQ} onClose={() => setResponsesQ(null)} />}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="text-sm text-apple-blue hover:underline font-semibold flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Quizzes
        </button>
        <span className="text-apple-text-3">/</span>
        <span className="text-sm font-semibold text-apple-text">{quiz.title}</span>
        {quiz.isActive && <span className="text-xs font-semibold text-apple-green bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Active</span>}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Questions</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">{questions.length} total · {questions.filter(q => q.isReleased).length} released{sections.length > 0 ? ` · ${sections.length} section${sections.length !== 1 ? 's' : ''}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSections(true)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h7"/></svg>
            Sections
          </button>
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Upload CSV
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-blue px-4 py-2 rounded-apple hover:bg-blue-600 transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add Question
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-apple-text-2 mb-4">No questions yet.</p>
          <button onClick={() => setShowAdd(true)} className="text-apple-blue font-semibold text-sm hover:underline">Add your first question →</button>
        </div>
      ) : (() => {
        // Group questions by section
        const hasSections = questions.some(q => q.sectionId !== null);
        const groups = hasSections ? (() => {
          const g = [];
          const seen = {};
          for (const q of questions) {
            const key = q.sectionId ?? 'none';
            if (!seen[key]) {
              seen[key] = { sectionId: q.sectionId, sectionName: q.sectionName, questions: [] };
              g.push(seen[key]);
            }
            seen[key].questions.push(q);
          }
          return g;
        })() : [{ sectionId: null, sectionName: null, questions }];

        const renderQuestion = (q, i) => {
          const isOpen = expanded === q.id;
          return (
            <div key={q.id} className={`bg-white border rounded-apple-lg shadow-apple-sm overflow-hidden ${q.isReleased ? 'border-apple-green/40' : 'border-apple-gray-2'}`}>
              <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-apple-gray/40 transition-colors" onClick={() => setExpanded(isOpen ? null : q.id)}>
                <span className="w-6 h-6 rounded-full bg-apple-gray-2 flex items-center justify-center text-xs font-bold text-apple-text-2 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-apple-text truncate">{q.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {q.isReleased ? <span className="text-xs font-semibold text-apple-green">Released</span> : <span className="text-xs text-apple-text-3">Unreleased</span>}
                    {q.isMultiAnswer && <span className="text-xs bg-purple-100 text-purple-600 font-semibold px-1.5 py-0.5 rounded-full">Multi</span>}
                    <span className="text-xs text-apple-text-3">{q.stats?.attempted || 0} responses</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => toggleRelease(q)} disabled={toggling[q.id]} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${q.isReleased ? 'bg-apple-green' : 'bg-apple-gray-3'} ${toggling[q.id] ? 'opacity-50' : ''}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${q.isReleased ? 'translate-x-4' : 'translate-x-0.5'}`}/>
                  </button>
                  <button onClick={() => setResponsesQ(q)} className="p-1.5 text-apple-text-3 hover:text-apple-blue transition-colors" title="View responses">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                  </button>
                  <button onClick={() => deleteQuestion(q)} disabled={deleting[q.id]} className="p-1.5 text-apple-text-3 hover:text-apple-red transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
                <svg className={`w-4 h-4 text-apple-text-3 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
              </div>
              {isOpen && (
                <div className="border-t border-apple-gray-2 px-5 py-4 space-y-4 bg-apple-gray/20">
                  <div>
                    <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">Content</p>
                    <div className="bg-white border border-apple-gray-2 rounded-apple p-4 md-content text-sm text-apple-text" dangerouslySetInnerHTML={{ __html: renderMd(q.content) }} />
                  </div>
                  {q.options?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">Options</p>
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <div key={opt.id} className={`flex items-start gap-3 rounded-apple p-3 border text-sm ${opt.isCorrect ? 'border-apple-green bg-green-50' : 'border-apple-gray-2 bg-white'}`}>
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${opt.isCorrect ? 'bg-apple-green' : 'bg-apple-gray-4'}`}>{String.fromCharCode(65 + oi)}</span>
                            <span className={opt.isCorrect ? 'text-green-800 font-medium' : 'text-apple-text'}>{opt.content}</span>
                            {opt.isCorrect && <span className="ml-auto text-xs font-semibold text-apple-green flex-shrink-0">✓ Correct</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {groups.map(group => (
              <div key={group.sectionId ?? 'none'}>
                {hasSections && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold text-apple-text-2 uppercase tracking-widest">
                      {group.sectionName ?? 'No Section'}
                    </span>
                    <span className="text-xs text-apple-text-3">{group.questions.length} question{group.questions.length !== 1 ? 's' : ''}</span>
                    <div className="flex-1 h-px bg-apple-gray-2" />
                  </div>
                )}
                <div className="space-y-3">
                  {group.questions.map((q, i) => renderQuestion(q, i))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

/* ════════════════════════════════════════
   QUIZZES TAB
   ════════════════════════════════════════ */
function QuizzesTab() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activating, setActivating] = useState({});
  const [deleting, setDeleting] = useState({});
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  const loadQuizzes = useCallback(async () => {
    try {
      const data = await fetch('/api/admin/quizzes').then(r => r.json());
      if (Array.isArray(data)) setQuizzes(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadQuizzes(); }, [loadQuizzes]);

  const activateQuiz = async (quiz) => {
    if (!confirm(`Set "${quiz.title}" as the active quiz? Contestants will see its released questions.`)) return;
    setActivating(prev => ({ ...prev, [quiz.id]: true }));
    try {
      await fetch(`/api/admin/quizzes/${quiz.id}/activate`, { method: 'POST' });
      loadQuizzes();
    } catch {}
    setActivating(prev => ({ ...prev, [quiz.id]: false }));
  };

  const deleteQuiz = async (quiz) => {
    if (!confirm(`Delete quiz "${quiz.title}" and ALL its questions? This cannot be undone.`)) return;
    setDeleting(prev => ({ ...prev, [quiz.id]: true }));
    try {
      await fetch(`/api/admin/quizzes/${quiz.id}`, { method: 'DELETE' });
      loadQuizzes();
    } catch {}
    setDeleting(prev => ({ ...prev, [quiz.id]: false }));
  };

  if (selectedQuiz) {
    return (
      <QuizQuestionsPanel
        quiz={selectedQuiz}
        onBack={() => { setSelectedQuiz(null); loadQuizzes(); }}
      />
    );
  }

  return (
    <div>
      {showCreate && <CreateQuizModal onClose={() => setShowCreate(false)} onCreated={loadQuizzes} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Quizzes</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">{quizzes.length} quizzes · only one can be active at a time</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-blue px-4 py-2 rounded-apple hover:bg-blue-600 transition-colors shadow-apple-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Create Quiz
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-apple-text-2 mb-4">No quizzes yet.</p>
          <button onClick={() => setShowCreate(true)} className="text-apple-blue font-semibold text-sm hover:underline">Create your first quiz →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map(quiz => (
            <div key={quiz.id} className={`bg-white border rounded-apple-lg p-5 shadow-apple-sm ${quiz.isActive ? 'border-apple-green/50 bg-green-50/30' : 'border-apple-gray-2'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-apple-text">{quiz.title}</h3>
                    {quiz.isActive && <span className="text-xs font-semibold text-apple-green bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">Active</span>}
                  </div>
                  {quiz.description && <p className="text-sm text-apple-text-2 mb-2">{quiz.description}</p>}
                  <p className="text-xs text-apple-text-3">{quiz.questionCount} question{quiz.questionCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setSelectedQuiz(quiz)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-2 px-3 py-1.5 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Manage
                  </button>
                  {!quiz.isActive && (
                    <button onClick={() => activateQuiz(quiz)} disabled={activating[quiz.id]} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-green px-3 py-1.5 rounded-apple hover:bg-green-600 transition-colors disabled:opacity-50">
                      {activating[quiz.id] ? <Spinner size={3} /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                      Activate
                    </button>
                  )}
                  <button onClick={() => deleteQuiz(quiz)} disabled={deleting[quiz.id]} className="p-1.5 text-apple-text-3 hover:text-apple-red transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   TEAMS TAB
   ════════════════════════════════════════ */
function CreateTeamModal({ onClose, onCreated }) {
  const [teamname, setTeamname] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!teamname.trim()) { setError('Team name is required'); return; }
    if (!password.trim()) { setError('Password is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: teamname.trim(), password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); setSaving(false); return; }
      onCreated();
      onClose();
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <Modal title="Create Team" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Team Name</label>
          <input value={teamname} onChange={e => setTeamname(e.target.value)} placeholder="e.g. TeamAlpha" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Password</label>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Team login password" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Spinner size={4} />}{saving ? 'Creating…' : 'Create Team'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function UploadTeamsModal({ onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const upload = async () => {
    if (!file) { setError('Please select a CSV file'); return; }
    setError(''); setUploading(true);
    const form = new FormData();
    form.append('csv', file);
    try {
      const res = await fetch('/api/admin/teams/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed'); setUploading(false); return; }
      setResult(data);
      onUploaded();
    } catch { setError('Network error'); }
    setUploading(false);
  };

  return (
    <Modal title="Upload Teams CSV" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        {result ? (
          <div className="bg-green-50 border border-green-200 rounded-apple p-4">
            <p className="text-apple-green font-semibold text-sm">Imported {result.created} team{result.created !== 1 ? 's' : ''}.</p>
            {result.errors?.length > 0 && result.errors.map((e, i) => <p key={i} className="text-xs text-apple-red mt-1">{e}</p>)}
            <button onClick={onClose} className="mt-3 text-sm font-semibold text-apple-blue">Done</button>
          </div>
        ) : (
          <>
            <div className="bg-apple-gray border border-apple-gray-2 rounded-apple p-4">
              <p className="text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-2">CSV Format</p>
              <pre className="text-xs text-apple-text font-mono">{`name,password\nTeamAlpha,pass123\nTeamBeta,securepass`}</pre>
            </div>
            <input type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files[0])} className="w-full text-sm text-apple-text-2 file:mr-3 file:py-2 file:px-4 file:rounded-apple file:border-0 file:text-sm file:font-semibold file:bg-apple-blue file:text-white hover:file:bg-blue-600 cursor-pointer" />
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-3 rounded-apple hover:bg-apple-gray-2 transition-colors">Cancel</button>
              <button onClick={upload} disabled={!file || uploading} className="px-5 py-2 text-sm font-semibold text-white bg-apple-blue rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2">
                {uploading && <Spinner size={4} />}{uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function TeamsTab() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [banning, setBanning] = useState({});

  const loadTeams = useCallback(async () => {
    try {
      const data = await fetch('/api/admin/teams').then(r => r.json());
      if (Array.isArray(data)) setTeams(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const deleteTeam = async (team) => {
    if (!confirm(`Delete team "${team.name}"?`)) return;
    setDeleting(prev => ({ ...prev, [team.id]: true }));
    try {
      await fetch('/api/admin/teams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: team.id }) });
      loadTeams();
    } catch {}
    setDeleting(prev => ({ ...prev, [team.id]: false }));
  };

  const toggleBan = async (team) => {
    const action = team.isBanned ? 'unban' : 'ban';
    if (!confirm(`${action === 'ban' ? 'Ban' : 'Unban'} team "${team.name}"?`)) return;
    setBanning(prev => ({ ...prev, [team.id]: true }));
    try {
      await fetch(`/api/admin/teams/${team.id}/ban`, { method: 'POST' });
      loadTeams();
    } catch {}
    setBanning(prev => ({ ...prev, [team.id]: false }));
  };

  return (
    <div>
      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} onCreated={loadTeams} />}
      {showUpload && <UploadTeamsModal onClose={() => setShowUpload(false)} onUploaded={loadTeams} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Teams</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">{teams.length} registered</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Upload CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-blue px-4 py-2 rounded-apple hover:bg-blue-600 transition-colors shadow-apple-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Create Team
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : teams.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-apple-text-2 mb-4">No teams yet.</p>
          <button onClick={() => setShowCreate(true)} className="text-apple-blue font-semibold text-sm hover:underline">Create your first team →</button>
        </div>
      ) : (
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg shadow-apple-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-apple-gray border-b border-apple-gray-2">
                <th className="text-left px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Team Name</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Score</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden sm:table-cell">Correct</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden sm:table-cell">Attempted</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide hidden sm:table-cell">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-apple-text-2 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apple-gray-2">
              {teams.map(team => (
                <tr key={team.id} className="hover:bg-apple-gray/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-apple-text">{team.name}</p>
                    <p className="text-xs text-apple-text-3 font-mono">#{team.id}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right"><span className="text-sm font-bold font-mono text-apple-blue">{team.total_score || 0}</span></td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell"><span className="text-sm text-apple-green font-semibold">{team.correct_count || 0}</span></td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell"><span className="text-sm text-apple-text-2">{team.attempted_count || 0}</span></td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                    {team.isBanned
                      ? <span className="text-xs font-semibold text-apple-red bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Banned</span>
                      : <span className="text-xs text-apple-text-3">Active</span>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleBan(team)} disabled={banning[team.id]} title={team.isBanned ? 'Unban' : 'Ban'} className={`p-1.5 transition-colors ${team.isBanned ? 'text-apple-green hover:text-green-600' : 'text-orange-400 hover:text-orange-600'}`}>
                        {team.isBanned
                          ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                          : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                        }
                      </button>
                      <button onClick={() => deleteTeam(team)} disabled={deleting[team.id]} className="p-1.5 text-apple-text-3 hover:text-apple-red transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   SETTINGS TAB
   ════════════════════════════════════════ */
function SettingsTab() {
  const [config, setConfig] = useState({ contestEndTime: '', pointsPerQuestion: 10 });
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      setConfig({
        contestEndTime: d.contestEndTime ? new Date(d.contestEndTime).toISOString().slice(0, 16) : '',
        pointsPerQuestion: d.pointsPerQuestion || 10,
      });
    }).catch(() => {});
    setLoading(false);
  }, []);

  const save = async () => {
    setError(''); setSaving(true); setSaved(false);
    try {
      const body = {
        contestEndTime: config.contestEndTime ? new Date(config.contestEndTime).toISOString() : null,
        pointsPerQuestion: parseInt(config.pointsPerQuestion) || 10,
      };
      if (adminPassword) body.adminPassword = adminPassword;
      const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return; }
      setSaved(true);
      setAdminPassword('');
      setTimeout(() => setSaved(false), 3000);
    } catch { setError('Network error'); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size={8} /></div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-apple-text tracking-tight">Settings</h2>
        <p className="text-sm text-apple-text-2 mt-0.5">Configure contest parameters</p>
      </div>
      <div className="max-w-lg space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-apple px-4 py-2.5">{error}</div>}
        {saved && <div className="bg-green-50 border border-green-200 text-apple-green text-sm rounded-apple px-4 py-2.5 font-semibold">Settings saved.</div>}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Contest End Time</label>
            <input type="datetime-local" value={config.contestEndTime} onChange={e => setConfig(prev => ({ ...prev, contestEndTime: e.target.value }))} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">Points Per Question</label>
            <input type="number" min="1" max="1000" value={config.pointsPerQuestion} onChange={e => setConfig(prev => ({ ...prev, pointsPerQuestion: e.target.value }))} className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
          </div>
        </div>
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm">
          <label className="block text-xs font-semibold text-apple-text-2 uppercase tracking-wide mb-1.5">New Admin Password</label>
          <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Leave blank to keep current" className="w-full px-4 py-2.5 bg-apple-gray border border-apple-gray-3 rounded-apple text-apple-text text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent transition-all" />
        </div>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-apple-blue text-white font-semibold px-6 py-2.5 rounded-apple text-sm hover:bg-blue-600 transition-colors disabled:opacity-50">
          {saving && <Spinner size={4} />}{saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   LIVE CONTROL TAB
   ════════════════════════════════════════ */
function LiveControlTab() {
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [liveState, setLiveState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const feedRef = useRef(null);

  const loadAll = useCallback(async () => {
    try {
      const [qdata, ldata] = await Promise.all([
        fetch('/api/admin/quizzes').then(r => r.json()),
        fetch('/api/admin/live').then(r => r.json()),
      ]);
      if (Array.isArray(qdata)) {
        const active = qdata.find(q => q.isActive);
        setActiveQuiz(active || null);
        if (active) {
          const [qs, secs] = await Promise.all([
            fetch(`/api/admin/questions?quizId=${active.id}`).then(r => r.json()),
            fetch(`/api/admin/sections?quizId=${active.id}`).then(r => r.json()),
          ]);
          if (Array.isArray(qs)) setQuestions(qs);
          if (Array.isArray(secs)) setSections(secs);
        }
      }
      setLiveState(ldata);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    const id = setInterval(() => {
      fetch('/api/admin/live').then(r => r.json()).then(setLiveState).catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [loadAll]);

  const control = async (action, questionId) => {
    const key = `${action}-${questionId || ''}`;
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      await fetch('/api/admin/live/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, questionId }),
      });
      const data = await fetch('/api/admin/live').then(r => r.json());
      setLiveState(data);
    } catch {}
    setBusy(prev => ({ ...prev, [key]: false }));
  };

  const controlSection = async (action, sectionId) => {
    const key = `${action}-${sectionId}`;
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      await fetch('/api/admin/live/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sectionId }),
      });
      await loadAll();
    } catch {}
    setBusy(prev => ({ ...prev, [key]: false }));
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size={8} /></div>;

  const currentQId = liveState?.currentQuestion?.id;
  const fastestAnswers = liveState?.fastestAnswers || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-apple-text tracking-tight">Live Control</h2>
          <p className="text-sm text-apple-text-2 mt-0.5">
            Control the projector screen at{' '}
            <a href="/live" target="_blank" className="text-apple-blue hover:underline font-semibold">/live ↗</a>
          </p>
        </div>
        <button onClick={loadAll} className="p-2 text-apple-text-3 hover:text-apple-blue transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>

      {!activeQuiz ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-apple-lg p-5 mb-6">
          <p className="text-sm font-semibold text-yellow-700">No active quiz. Activate a quiz from the Quizzes tab first.</p>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-apple-text-2">Active quiz:</span>
          <span className="text-sm font-bold text-apple-text">{activeQuiz.title}</span>
          <span className="text-xs font-semibold text-apple-green bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Live</span>
        </div>
      )}

      {sections.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-apple-text-2 uppercase tracking-wide mb-3">Sections</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.map(s => {
              const enableKey = `enableSection-${s.id}`;
              const disableKey = `disableSection-${s.id}`;
              const isBusy = busy[enableKey] || busy[disableKey];
              return (
                <div key={s.id} className={`bg-white border rounded-apple-lg p-4 shadow-apple-sm flex items-center gap-3 ${s.isEnabled ? 'border-apple-green/40' : 'border-apple-gray-2 opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-apple-text truncate">{s.name}</p>
                    <p className="text-xs text-apple-text-3">{s.questionCount} question{s.questionCount !== 1 ? 's' : ''} · {s.isEnabled ? <span className="text-apple-green font-semibold">Visible to teams</span> : <span>Hidden from teams</span>}</p>
                  </div>
                  <button
                    onClick={() => controlSection(s.isEnabled ? 'disableSection' : 'enableSection', s.id)}
                    disabled={isBusy}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${s.isEnabled ? 'bg-apple-green' : 'bg-apple-gray-3'} ${isBusy ? 'opacity-50' : ''}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${s.isEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}/>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Questions control */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-apple-text-2 uppercase tracking-wide">Questions</h3>
            {currentQId && (
              <button onClick={() => control('hideQuestion')} className="text-xs font-semibold text-apple-red hover:underline">
                Clear Screen
              </button>
            )}
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-apple-text-2 py-4 text-center">{activeQuiz ? 'No questions in this quiz.' : 'Select an active quiz first.'}</p>
          ) : (
            questions.map((q, i) => {
              const isShowing = currentQId === q.id;
              const isShowingResults = isShowing && liveState?.showResults;
              return (
                <div key={q.id} className={`bg-white border rounded-apple-lg p-4 shadow-apple-sm ${isShowing ? 'border-apple-blue/50 bg-blue-50/30' : 'border-apple-gray-2'}`}>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-apple-gray-2 flex items-center justify-center text-xs font-bold text-apple-text-2 flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-apple-text truncate">{q.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {q.isReleased ? <span className="text-xs text-apple-green font-semibold">Released to contestants</span> : <span className="text-xs text-apple-text-3">Not released</span>}
                        {isShowing && <span className="text-xs font-semibold text-apple-blue bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">On screen</span>}
                        {q.sectionName && <span className="text-xs text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-full">{q.sectionName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isShowing ? (
                        <>
                          {!isShowingResults ? (
                            <button
                              onClick={() => control('showResults', q.id)}
                              disabled={busy[`showResults-${q.id}`]}
                              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-purple-500 px-3 py-1.5 rounded-apple hover:bg-purple-600 transition-colors disabled:opacity-50"
                            >
                              {busy[`showResults-${q.id}`] ? <Spinner size={3} /> : null}
                              Show Results
                            </button>
                          ) : (
                            <button
                              onClick={() => control('hideResults')}
                              className="flex items-center gap-1.5 text-xs font-semibold text-apple-text-2 bg-apple-gray border border-apple-gray-2 px-3 py-1.5 rounded-apple hover:bg-apple-gray-2 transition-colors"
                            >
                              Hide Results
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => control('showQuestion', q.id)}
                          disabled={busy[`showQuestion-${q.id}`]}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-apple-blue px-3 py-1.5 rounded-apple hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                          {busy[`showQuestion-${q.id}`] ? <Spinner size={3} /> : null}
                          Show on Screen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Fastest Fingers Feed */}
        <div className="bg-white border border-apple-gray-2 rounded-apple-lg shadow-apple-sm overflow-hidden flex flex-col" style={{ maxHeight: '500px' }}>
          <div className="px-4 py-3 border-b border-apple-gray-2 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-sm font-bold text-apple-text">Fastest Fingers</h3>
              <p className="text-xs text-apple-text-3">{fastestAnswers.length} answered</p>
            </div>
            {fastestAnswers.length > 0 && (
              <button onClick={() => control('resetFeed')} className="text-xs font-semibold text-apple-red hover:underline">Reset</button>
            )}
          </div>
          <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {fastestAnswers.length === 0 ? (
              <p className="text-xs text-apple-text-3 text-center py-6">No answers yet for current question.</p>
            ) : (
              fastestAnswers.map((a, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-apple border text-sm ${a.isCorrect ? 'border-apple-green/40 bg-green-50' : 'border-apple-gray-2 bg-apple-gray/30'}`}>
                  <span className="font-bold text-apple-text-3 w-6 text-center flex-shrink-0">
                    {a.rank === 1 ? '🥇' : a.rank === 2 ? '🥈' : a.rank === 3 ? '🥉' : `#${a.rank}`}
                  </span>
                  <span className="font-semibold text-apple-text flex-1 truncate">{a.teamName}</span>
                  <span className={`flex-shrink-0 ${a.isCorrect ? 'text-apple-green' : 'text-apple-red'}`}>
                    {a.isCorrect ? '✓' : '✗'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN ADMIN PAGE
   ════════════════════════════════════════ */
export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState('scores');
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.type !== 'admin') { router.replace('/'); return; }
      setMe(d);
    }).catch(() => router.replace('/'));
  }, []);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  const TABS = [
    { key: 'scores', label: 'Live Scores', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
    { key: 'quizzes', label: 'Quizzes', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg> },
    { key: 'teams', label: 'Teams', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
    { key: 'settings', label: 'Settings', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
    { key: 'live', label: 'Live', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> },
  ];

  return (
    <div className="min-h-screen bg-apple-gray">
      <header className="bg-white/80 backdrop-blur-md border-b border-apple-gray-2 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-apple-text tracking-tight">Quizzy</span>
            <span className="text-xs font-semibold text-apple-blue bg-blue-50 px-2 py-0.5 rounded-full">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            {me && <span className="text-sm text-apple-text-2 hidden sm:block">{me.username || 'Admin'}</span>}
            <a href="/live" target="_blank" className="text-sm text-apple-text-2 hover:text-apple-blue transition-colors font-medium hidden sm:block">Live Screen ↗</a>
            <button onClick={logout} className="text-sm text-apple-text-2 hover:text-apple-blue transition-colors font-medium">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 py-6">
        <div className="flex items-center gap-1 bg-white border border-apple-gray-2 rounded-apple-lg p-1 shadow-apple-sm mb-7 w-fit overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-apple text-sm font-semibold transition-all whitespace-nowrap ${tab === t.key ? 'bg-apple-blue text-white shadow-apple-sm' : 'text-apple-text-2 hover:text-apple-text hover:bg-apple-gray'}`}>
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {tab === 'scores' && <LiveScoresTab />}
        {tab === 'quizzes' && <QuizzesTab />}
        {tab === 'teams' && <TeamsTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'live' && <LiveControlTab />}
      </div>
    </div>
  );
}
