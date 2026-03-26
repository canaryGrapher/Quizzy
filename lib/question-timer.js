/**
 * Server-side auto-submit timer for timed questions.
 * When a timed question's countdown expires, all teams that haven't
 * answered receive a blank (score=0) answer automatically.
 */
import prisma from './prisma.js';
import { emitToAll, getLiveState, updateLiveState } from './socket-emitter.js';

/** Schedule auto-submit for a question after `delayMs` milliseconds. */
export function scheduleAutoSubmit(questionId, delayMs) {
  if (!global._questionTimers) global._questionTimers = {};

  // Cancel any existing timer for this question
  if (global._questionTimers[questionId]) {
    clearTimeout(global._questionTimers[questionId]);
  }

  global._questionTimers[questionId] = setTimeout(async () => {
    try {
      await performAutoSubmit(questionId);
    } catch (err) {
      console.error(`Auto-submit failed for question ${questionId}:`, err);
    } finally {
      delete global._questionTimers[questionId];
    }
  }, delayMs);
}

/** Cancel a pending auto-submit timer. */
export function cancelAutoSubmit(questionId) {
  if (!global._questionTimers) return;
  if (global._questionTimers[questionId]) {
    clearTimeout(global._questionTimers[questionId]);
    delete global._questionTimers[questionId];
  }
}

async function performAutoSubmit(questionId) {
  // Find all non-banned teams that haven't answered yet
  const [allTeams, existingAnswers] = await Promise.all([
    prisma.team.findMany({ where: { isBanned: false }, select: { id: true, name: true } }),
    prisma.answer.findMany({ where: { questionId }, select: { teamId: true } }),
  ]);

  const submittedIds = new Set(existingAnswers.map(a => a.teamId));
  const unsubmitted = allTeams.filter(t => !submittedIds.has(t.id));

  let nextRank = existingAnswers.length + 1;
  for (const team of unsubmitted) {
    await prisma.answer.upsert({
      where: { teamId_questionId: { teamId: team.id, questionId } },
      create: {
        teamId: team.id,
        questionId,
        selectedOptions: '[]',
        isCorrect: false,
        score: 0,
        answerRank: nextRank++,
      },
      update: {},
    });
  }

  // Update live state: everyone is now submitted
  const state = getLiveState();
  if (state.currentQuestion?.id === questionId) {
    updateLiveState({
      submittedTeamIds: allTeams.map(t => t.id),
    });
  }

  // Broadcast: timer expired, all answers locked in
  emitToAll('question:timer-expired', {
    questionId,
    autoSubmitted: unsubmitted.map(t => t.name),
  });
}
