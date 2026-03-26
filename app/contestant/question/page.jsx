'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Countdown from '@/components/Countdown';
import NotificationBanner from '@/components/NotificationBanner';
import AnswerChart from '@/components/AnswerChart';

function renderMd(text) {
  if (typeof window === 'undefined') return text;
  return text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupolis])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

function QuestionContent() {
  const searchParams = useSearchParams();
  const qid = searchParams.get('id');

  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const autoSubmittedRef = useRef(false);

  const loadQuestion = useCallback(async () => {
    if (!qid) return;
    try {
      const data = await fetch(`/api/questions/${qid}`).then(r => r.json());
      if (data.error) { setError(data.error); return; }
      setQuestion(data);
      if (data.submitted) {
        setSelected(data.selectedOptions || []);
        setResult({ isCorrect: data.isCorrect, score: data.score, correctOptions: data.correctOptions, optionStats: data.optionStats, totalAnswered: data.totalAnswered });
      }
    } catch { setError('Failed to load question'); }
    setLoading(false);
  }, [qid]);

  useEffect(() => {
    loadQuestion();
  }, [qid]);

  // Countdown timer
  useEffect(() => {
    if (!question?.timeLimitSeconds || !question?.releasedAt || result) {
      setTimeLeft(null);
      return;
    }
    const calc = () => {
      const elapsed = Math.floor((Date.now() - new Date(question.releasedAt).getTime()) / 1000);
      return Math.max(0, question.timeLimitSeconds - elapsed);
    };
    setTimeLeft(calc());
    const id = setInterval(() => {
      const rem = calc();
      setTimeLeft(rem);
      if (rem <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [question?.id, question?.releasedAt, result]);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && !result && !submitting && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      // Submit with whatever is selected (empty = blank answer will be rejected, so only auto-submit if something selected)
      if (selected.length > 0) {
        submit();
      }
      // If nothing selected, the server's auto-submit will handle it via question-timer.js
    }
  }, [timeLeft]);

  const toggleOption = (optId) => {
    if (result) return;
    if (question?.isMultiAnswer) {
      setSelected(prev => prev.includes(optId) ? prev.filter(id => id !== optId) : [...prev, optId]);
    } else {
      setSelected([optId]);
    }
  };

  const submit = async (forceSelected) => {
    const opts = forceSelected !== undefined ? forceSelected : selected;
    if (!opts.length || submitting || result) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/questions/${qid}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedOptions: opts }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitting(false); return; }
      setResult(data);
      loadQuestion();
    } catch {}
    setSubmitting(false);
  };

  const timerColor = timeLeft === null ? null
    : timeLeft > (question?.timeLimitSeconds || 0) * 0.5 ? 'text-apple-green'
    : timeLeft > (question?.timeLimitSeconds || 0) * 0.25 ? 'text-orange-500'
    : 'text-apple-red';

  if (loading) return (
    <div className="flex justify-center py-24">
      <svg className="animate-spin h-8 w-8 text-apple-blue" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>
    </div>
  );

  if (error) return (
    <div className="text-center py-24">
      <p className="text-apple-red font-semibold">{error}</p>
      <a href="/contestant" className="text-apple-blue text-sm mt-4 inline-block">← Back to Questions</a>
    </div>
  );

  const isSubmitted = !!result;
  const optionStats = result?.optionStats || question?.optionStats;
  const totalAnswered = result?.totalAnswered ?? question?.totalAnswered ?? 0;
  const correctOptions = result?.correctOptions || question?.correctOptions || [];

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      {/* Back + breadcrumb */}
      <div className="flex items-center justify-between mb-6">
        <a href="/contestant" className="flex items-center gap-1.5 text-sm text-apple-text-2 hover:text-apple-blue transition-colors font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back to Questions
        </a>
        <div className="flex items-center gap-4">
          {/* Countdown timer */}
          {timeLeft !== null && !isSubmitted && (
            <div className={`flex items-center gap-1.5 font-bold tabular-nums ${timerColor}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span className="text-lg">{timeLeft}s</span>
              {timeLeft === 0 && <span className="text-xs font-semibold ml-1">Time&apos;s up!</span>}
            </div>
          )}
          {question && (
            <span className="text-xs text-apple-text-3 font-medium">
              {question.questionNumber} / {question.totalQuestions}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Question */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold text-apple-text-3 uppercase tracking-wide">
              Question {question?.questionNumber}
            </span>
            {question?.isMultiAnswer && (
              <span className="text-xs bg-purple-100 text-purple-600 font-semibold px-2.5 py-0.5 rounded-full">
                Select all that apply
              </span>
            )}
            {isSubmitted && (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${result.isCorrect ? 'bg-green-100 text-apple-green' : 'bg-red-100 text-apple-red'}`}>
                {result.isCorrect ? `✓ Correct · +${result.score} pts` : '✗ Incorrect · 0 pts'}
              </span>
            )}
            {/* Timer bar */}
            {timeLeft !== null && !isSubmitted && question?.timeLimitSeconds && (
              <div className="w-full mt-2 h-1.5 bg-apple-gray-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 linear ${
                    timeLeft > question.timeLimitSeconds * 0.5 ? 'bg-apple-green'
                    : timeLeft > question.timeLimitSeconds * 0.25 ? 'bg-orange-400'
                    : 'bg-apple-red'
                  }`}
                  style={{ width: `${Math.max(0, (timeLeft / question.timeLimitSeconds) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Question content */}
          <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-6 mb-5 shadow-apple-sm">
            <div className="md-content text-apple-text text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMd(question?.content || '') }}
            />
          </div>

          {/* Options */}
          <div className="space-y-2.5 mb-6">
            {question?.options?.map((opt, i) => {
              const isSelected = selected.includes(opt.id);
              const isCorrect = correctOptions.includes(opt.id);
              const isWrong = isSubmitted && isSelected && !isCorrect;
              const letter = String.fromCharCode(65 + i);

              let classes = 'border border-apple-gray-2 bg-white';
              if (isSubmitted) {
                if (isCorrect) classes = 'border-apple-green bg-green-50';
                else if (isWrong) classes = 'border-apple-red bg-red-50';
                else if (isSelected) classes = 'border-apple-gray-3 bg-apple-gray';
              } else {
                if (isSelected) classes = 'border-apple-blue bg-blue-50';
                else classes = 'border-apple-gray-2 bg-white hover:border-apple-blue hover:bg-blue-50/50 cursor-pointer';
              }

              return (
                <div key={opt.id}
                  className={`flex items-start gap-3 rounded-apple-md p-4 transition-all ${classes}`}
                  onClick={() => !isSubmitted && toggleOption(opt.id)}
                >
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isSubmitted
                      ? isCorrect ? 'bg-apple-green text-white' : isWrong ? 'bg-apple-red text-white' : 'bg-apple-gray-3 text-apple-text-2'
                      : isSelected ? 'bg-apple-blue text-white' : 'bg-apple-gray-2 text-apple-text-2'
                  }`}>
                    {letter}
                  </div>
                  <div className={`flex-1 text-sm leading-relaxed md-content ${
                    isSubmitted && isCorrect ? 'text-green-800 font-medium' : isWrong ? 'text-red-800' : 'text-apple-text'
                  }`}
                    dangerouslySetInnerHTML={{ __html: renderMd(opt.content) }}
                  />
                  {isSubmitted && isCorrect && <svg className="w-5 h-5 text-apple-green flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                  {isWrong && <svg className="w-5 h-5 text-apple-red flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>}
                </div>
              );
            })}
          </div>

          {/* Submit / Nav */}
          <div className="flex items-center gap-3 flex-wrap">
            {!isSubmitted ? (
              <button
                onClick={() => submit()}
                disabled={!selected.length || submitting || timeLeft === 0}
                className="bg-apple-blue text-white font-semibold px-6 py-2.5 rounded-apple text-sm hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Submitting…</>
                ) : 'Submit Answer'}
              </button>
            ) : null}
            {question?.prevId && (
              <a href={`/contestant/question?id=${question.prevId}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-apple-text-2 bg-white border border-apple-gray-2 px-4 py-2.5 rounded-apple hover:border-apple-blue hover:text-apple-blue transition-colors shadow-apple-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                Previous
              </a>
            )}
            {question?.nextId && (
              <a href={`/contestant/question?id=${question.nextId}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-apple-blue px-4 py-2.5 rounded-apple hover:bg-blue-600 transition-colors shadow-apple-sm ml-auto">
                Next Question
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </a>
            )}
          </div>
        </div>

        {/* Right: Chart (shown after submission) */}
        {isSubmitted && question?.options && (
          <div className="lg:w-72 flex-shrink-0">
            <div className="bg-white border border-apple-gray-2 rounded-apple-lg p-5 shadow-apple-sm sticky top-20">
              <AnswerChart
                options={question.options}
                optionStats={optionStats}
                totalAnswered={totalAnswered}
                correctOptions={correctOptions}
                selectedOptions={selected}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Admin message toast ─── */
function MessageToast({ messages, onDismiss }) {
  if (!messages.length) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-md px-4">
      {messages.map(m => (
        <div key={m.id} className="notify-in bg-white border border-apple-gray-2 rounded-apple-md shadow-apple-lg px-4 py-3 flex items-start gap-3 pointer-events-auto">
          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-apple-blue uppercase tracking-wide">Admin Message</p>
            <p className="text-sm text-apple-text mt-0.5 break-words">{m.content}</p>
          </div>
          <button onClick={() => onDismiss(m.id)} className="text-apple-text-3 hover:text-apple-text flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default function QuestionPage() {
  const [me, setMe] = useState(null);
  const [endTime, setEndTime] = useState('');
  const [messages, setMessages] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.type !== 'team') router.replace('/');
      else setMe(d);
    }).catch(() => router.replace('/'));
    fetch('/api/config').then(r => r.json()).then(d => setEndTime(d.contestEndTime));
  }, []);

  // Socket.io for messages and banish
  useEffect(() => {
    if (!me) return;
    let socket;
    import('socket.io-client').then(({ io }) => {
      socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
      socket.on('connect', () => {
        socket.emit('team:join', { teamId: me.teamId });
      });
      socket.on('message:received', (data) => {
        const id = Date.now();
        setMessages(prev => [...prev, { id, content: data.content }]);
        setTimeout(() => setMessages(prev => prev.filter(m => m.id !== id)), 10000);
      });
      socket.on('quiz:banished', () => {
        router.replace('/?banished=1');
      });
    });
    return () => socket?.disconnect();
  }, [me?.teamId]);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  return (
    <>
      <NotificationBanner />
      <MessageToast messages={messages} onDismiss={id => setMessages(prev => prev.filter(m => m.id !== id))} />
      <header className="bg-white/80 backdrop-blur-md border-b border-apple-gray-2 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-apple-text tracking-tight">Quizzy</span>
          <div className="flex items-center gap-3">
            {me && <span className="text-sm text-apple-text-2 hidden sm:block">{me.teamName}</span>}
            {endTime && <Countdown endTime={endTime} />}
            <button onClick={logout} className="text-sm text-apple-text-2 hover:text-apple-blue transition-colors font-medium">Sign Out</button>
          </div>
        </div>
      </header>
      <Suspense fallback={
        <div className="flex justify-center py-24">
          <svg className="animate-spin h-8 w-8 text-apple-blue" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>
        </div>
      }>
        <QuestionContent />
      </Suspense>
    </>
  );
}
