/** Emit a Socket.io event to all connected clients. No-op if server not initialized. */
export function emitToAll(event, data) {
  if (global._io) global._io.emit(event, data);
}

/** Get or initialize the global live screen state. */
export function getLiveState() {
  if (!global._liveState) {
    global._liveState = {
      activeQuizId: null,
      activeQuizTitle: null,
      currentQuestion: null, // { id, title, content, isMultiAnswer, options: [{id, content}] }
      showResults: false,
      resultStats: null, // { correctOptionIds, optionStats, totalAnswered }
      fastestAnswers: [], // [{ rank, teamName, isCorrect, submittedAt }]
    };
  }
  return global._liveState;
}

/** Merge updates into the global live state. */
export function updateLiveState(updates) {
  const state = getLiveState();
  Object.assign(state, updates);
  return state;
}
