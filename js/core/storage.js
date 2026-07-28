const STORAGE_KEY = 'mouse-calibration-sessions';
const CONFIG_KEY = 'mouse-calibration-config';

export function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
  } catch { return {}; }
}

export function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...loadConfig(), ...config }));
}

export function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

export function saveSession(session) {
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 50)));
  return session;
}

export function deleteSession(id) {
  const sessions = loadSessions().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function renameSession(id, name) {
  const sessions = loadSessions();
  const s = sessions.find(s => s.id === id);
  if (s) { s.name = name; localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); }
}

export function createSession(name, data) {
  return saveSession({
    id: crypto.randomUUID(),
    name: name || `Session ${new Date().toLocaleString()}`,
    createdAt: Date.now(),
    data,
  });
}

export function getAggregateStats(sessions) {
  const agg = {
    totalDistance: 0,
    avgSpeed: 0,
    maxSpeed: 0,
    avgFlickLength: 0,
    mouseCounts: 0,
    swipeCount: 0,
    totalTime: 0,
    speedSamples: [],
    flickSamples: [],
  };
  for (const s of sessions) {
    const d = s.data?.aggregate || s.data || {};
    agg.totalDistance += d.totalDistance || 0;
    agg.mouseCounts += d.mouseCounts || 0;
    agg.swipeCount += d.swipeCount || 0;
    agg.totalTime += d.totalTime || 0;
    if (d.maxSpeed) agg.maxSpeed = Math.max(agg.maxSpeed, d.maxSpeed);
    if (d.avgSpeed) agg.speedSamples.push(d.avgSpeed);
    if (d.avgFlickLength) agg.flickSamples.push(d.avgFlickLength);
  }
  if (agg.speedSamples.length) agg.avgSpeed = agg.speedSamples.reduce((a, b) => a + b, 0) / agg.speedSamples.length;
  if (agg.flickSamples.length) agg.avgFlickLength = agg.flickSamples.reduce((a, b) => a + b, 0) / agg.flickSamples.length;
  return agg;
}
