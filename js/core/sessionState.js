/** Session state for the current check run */

export const sessionState = {
  tests: {},
};

export function saveTestResult(testId, result) {
  sessionState.tests[testId] = { ...result, timestamp: Date.now() };
}

export function getTestResult(testId) {
  return sessionState.tests[testId];
}

export function getAllResults() {
  return sessionState.tests;
}

export function resetSession() {
  sessionState.tests = {};
}

export function exportSessionData() {
  return {
    tests: { ...sessionState.tests },
    exportedAt: Date.now(),
  };
}
