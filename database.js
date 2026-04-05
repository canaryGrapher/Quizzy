const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'quizzy.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_multi_answer INTEGER NOT NULL DEFAULT 0,
    is_released INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0,
    option_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_options TEXT NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT OR IGNORE INTO settings VALUES ('admin_password', 'admin123');
  INSERT OR IGNORE INTO settings VALUES ('contest_end_time', '2026-03-25T18:00:00');
  INSERT OR IGNORE INTO settings VALUES ('points_per_question', '10');
`);

module.exports = {
  getSetting: (key) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },
  setSetting: (key, value) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  },

  getTeamByName: (name) => db.prepare('SELECT * FROM teams WHERE name = ? COLLATE NOCASE').get(name),
  getAllTeams: () => db.prepare(`
    SELECT t.id, t.name, t.created_at,
      COALESCE(SUM(a.score), 0) as total_score,
      COUNT(CASE WHEN a.is_correct = 1 THEN 1 END) as correct_count,
      COUNT(a.id) as attempted_count
    FROM teams t LEFT JOIN answers a ON t.id = a.team_id
    GROUP BY t.id ORDER BY total_score DESC, t.name
  `).all(),
  createTeam: (name, password) => {
    const result = db.prepare('INSERT INTO teams (name, password) VALUES (?, ?)').run(name, password);
    return result.lastInsertRowid;
  },
  deleteTeam: (id) => db.prepare('DELETE FROM teams WHERE id = ?').run(id),

  getAllQuestions: () => db.prepare('SELECT * FROM questions ORDER BY order_index, id').all(),
  getReleasedQuestions: () => db.prepare('SELECT * FROM questions WHERE is_released = 1 ORDER BY order_index, id').all(),
  getQuestion: (id) => db.prepare('SELECT * FROM questions WHERE id = ?').get(id),
  createQuestion: (title, content, isMultiAnswer) => {
    const r = db.prepare('INSERT INTO questions (title, content, is_multi_answer) VALUES (?, ?, ?)').run(title, content, isMultiAnswer ? 1 : 0);
    return r.lastInsertRowid;
  },
  updateQuestion: (id, fields) => {
    const parts = [], vals = [];
    if (fields.is_released !== undefined) { parts.push('is_released = ?'); vals.push(fields.is_released ? 1 : 0); }
    if (fields.title !== undefined) { parts.push('title = ?'); vals.push(fields.title); }
    if (fields.content !== undefined) { parts.push('content = ?'); vals.push(fields.content); }
    if (fields.is_multi_answer !== undefined) { parts.push('is_multi_answer = ?'); vals.push(fields.is_multi_answer ? 1 : 0); }
    if (!parts.length) return;
    db.prepare(`UPDATE questions SET ${parts.join(', ')} WHERE id = ?`).run(...vals, id);
  },
  deleteQuestion: (id) => db.prepare('DELETE FROM questions WHERE id = ?').run(id),

  getQuestionOptions: (qid) => db.prepare('SELECT * FROM options WHERE question_id = ? ORDER BY option_order').all(qid),
  getCorrectOptions: (qid) => db.prepare('SELECT * FROM options WHERE question_id = ? AND is_correct = 1').all(qid),
  createOption: (qid, content, isCorrect, order) =>
    db.prepare('INSERT INTO options (question_id, content, is_correct, option_order) VALUES (?, ?, ?, ?)').run(qid, content, isCorrect ? 1 : 0, order),

  getTeamAnswers: (teamId) => db.prepare('SELECT * FROM answers WHERE team_id = ?').all(teamId),
  getTeamAnswer: (teamId, qid) => db.prepare('SELECT * FROM answers WHERE team_id = ? AND question_id = ?').get(teamId, qid),
  submitAnswer: (teamId, qid, selectedOptions, isCorrect, score) =>
    db.prepare('INSERT INTO answers (team_id, question_id, selected_options, is_correct, score) VALUES (?, ?, ?, ?, ?)').run(teamId, qid, selectedOptions, isCorrect ? 1 : 0, score),

  getLiveScores: () => db.prepare(`
    SELECT t.id, t.name,
      COALESCE(SUM(a.score), 0) as total_score,
      COUNT(CASE WHEN a.is_correct = 1 THEN 1 END) as correct_count,
      COUNT(a.id) as attempted_count
    FROM teams t LEFT JOIN answers a ON t.id = a.team_id
    GROUP BY t.id ORDER BY total_score DESC, correct_count DESC, t.name
  `).all(),

  getQuestionAnswerDetail: (qid) => db.prepare(`
    SELECT t.name as team_name, a.is_correct, a.score, a.submitted_at, a.selected_options
    FROM answers a JOIN teams t ON a.team_id = t.id
    WHERE a.question_id = ?
    ORDER BY a.submitted_at
  `).all(qid),

  getAllOptionStats: (qid) => {
    const answers = db.prepare('SELECT selected_options FROM answers WHERE question_id = ?').all(qid);
    const countMap = {};
    for (const a of answers) {
      try {
        const opts = JSON.parse(a.selected_options);
        for (const id of opts) { countMap[id] = (countMap[id] || 0) + 1; }
      } catch {}
    }
    return countMap;
  },
  getTotalAnswerCount: (qid) =>
    db.prepare('SELECT COUNT(*) as c FROM answers WHERE question_id = ?').get(qid).c,
};
