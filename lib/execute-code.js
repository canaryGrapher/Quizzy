const PISTON_BASE = process.env.PISTON_URL || 'http://localhost:2000';
const PISTON_URL = `${PISTON_BASE}/api/v2/execute`;

const LANG_MAP = {
  javascript: { language: 'javascript', version: '18.15.0' },
  python: { language: 'python', version: '3.10.0' },
};

/**
 * Execute code via Piston API.
 * Returns { stdout, stderr, exitCode }
 */
export async function executeCode(language, code, stdin = '') {
  const lang = LANG_MAP[language];
  if (!lang) throw new Error(`Unsupported language: ${language}`);

  const res = await fetch(PISTON_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: lang.language,
      version: lang.version,
      files: [{ content: code }],
      stdin,
      run_timeout: 3000,
      compile_timeout: 10000,
    }),
  });

  if (!res.ok) {
    console.error('Piston API error:', await res.text());
    throw new Error(`Piston API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    stdout: data.run?.stdout ?? '',
    stderr: data.run?.stderr ?? '',
    exitCode: data.run?.code ?? -1,
  };
}

/**
 * Run code against an array of test cases.
 * Returns array of { passed, input, expectedOutput, actualOutput, stderr }
 */
export async function runTestCases(language, code, testCases) {
  const results = await Promise.all(
    testCases.map(async (tc) => {
      try {
        const { stdout, stderr, exitCode } = await executeCode(language, code, tc.input);
        const actual = stdout.trimEnd();
        const expected = tc.expectedOutput.trimEnd();
        return {
          passed: exitCode === 0 && actual === expected,
          input: tc.input,
          expectedOutput: expected,
          actualOutput: actual,
          stderr: stderr.slice(0, 500),
        };
      } catch (err) {
        return {
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput.trimEnd(),
          actualOutput: '',
          stderr: err.message,
        };
      }
    })
  );
  return results;
}
