// 탭talk 백그라운드 — 실제 활성 탭 도메인을 읽어 업무/딴짓/중립을 판별하고
// 집중 세션 시간을 측정, 딴짓이 길어지면 단계별 알림으로 정중히 복귀를 유도한다.
// 또한 분류 상태/도메인별 시간 통계를 storage에 기록해 팝업·웹앱 대시보드가 공유한다.
// 상태는 chrome.storage.local에 저장해 팝업이 닫혀도 유지된다.

import { classify, category, hostOf } from "./classify.js";
import { TONE, HELPERS, GRACE_MS, todayKey } from "./shared.js";
import { initTabUsage } from "./tab-usage.js";

const SESSION_KEY = "session";
const STATS_KEY = "stats";
const SETTINGS_KEY = "settings";
const CLASSIFY_KEY = "classification"; // {kind, host, focused} — 브리지가 웹앱으로 전파
const DOMAIN_KEY = "domainStats";      // {date, hosts:{host:{ms,category}}}
const ASK_KEY = "ask";                 // {host} — 중립 도메인 1회 물어보기

const fresh = () => ({
  active: false,
  present: true,
  startedAt: 0,
  lastTick: 0,
  focusMs: 0,
  awaySince: 0,
  goalMin: 25,
  sessionDistractMs: 0,
  sessionDistractCount: 0,
  activeHelper: "concierge",
  activeHost: "",
  activeKind: "neutral"
});

const freshStats = () => ({
  date: todayKey(),
  focusMs: 0,
  distractMs: 0,
  distractCount: 0,
  returnCount: 0
});

const freshDomain = () => ({ date: todayKey(), hosts: {} });

async function get(key, def) {
  const o = await chrome.storage.local.get(key);
  return o[key] ?? def;
}
async function set(obj) {
  await chrome.storage.local.set(obj);
}

function runSafe(fn) {
  try {
    Promise.resolve(fn()).catch(() => {});
  } catch {}
}

async function loadSession() {
  return (await get(SESSION_KEY, null)) || fresh();
}
async function loadStats() {
  let s = await get(STATS_KEY, null);
  if (!s || s.date !== todayKey()) s = freshStats();
  return s;
}
async function loadDomain() {
  let d = await get(DOMAIN_KEY, null);
  if (!d || d.date !== todayKey()) d = freshDomain();
  return d;
}
async function loadSettings() {
  return {
    tone: "concierge",
    allowlist: [],
    blocklist: [],
    warnStyle: "nudge",
    askedHosts: [],
    ...((await get(SETTINGS_KEY, null)) || {})
  };
}

// 현재 활성 탭/포커스/분류를 한 번에 조사
// 일반 브라우저 창만 본다. 우리 경고 팝업(type:"popup")이나 사이드패널 같은
// 확장 페이지가 포커스를 가져가도 "업무 탭"으로 오인하지 않도록 한다(깜빡임 방지).
let lastNormalWinId = null;
async function probe() {
  try {
    const wins = await chrome.windows.getAll({ populate: true });
    const normals = wins.filter((w) => w.type === "normal");
    let win = normals.find((w) => w.focused);
    const focused = !!win; // 일반 창이 포커스일 때만 true (경고 팝업·타 앱 포커스는 false)
    if (!win) win = normals.find((w) => w.id === lastNormalWinId) || normals[0];
    if (win) lastNormalWinId = win.id;
    const tab = win && win.tabs ? win.tabs.find((t) => t.active) : null;
    const url = tab && tab.url ? tab.url : "";
    const settings = await loadSettings();
    const kind = url ? classify(url, settings) : "neutral";
    return { focused, host: hostOf(url), kind, url, tabId: tab && tab.id };
  } catch {
    return { focused: true, host: "", kind: "neutral", url: "", tabId: null };
  }
}

async function ensureNudgeScript(p) {
  if (!p || !p.focused || !p.tabId || !/^https?:\/\//.test(p.url || "")) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId: p.tabId }, files: ["css/content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: p.tabId }, files: ["content/content.js"] });
  } catch {}
}

// 분류 상태를 storage에 반영 (브리지가 웹앱으로 자동 전파)
async function broadcastClassification(p) {
  const prev = await get(CLASSIFY_KEY, null);
  if (prev && prev.kind === p.kind && prev.host === p.host && prev.focused === p.focused) return;
  await set({ [CLASSIFY_KEY]: { kind: p.kind, host: p.host, focused: p.focused, at: Date.now() } });
}

// 도메인별 체류시간 누적 (직전 활성 host에 귀속)
async function addDomainTime(host, kind, delta) {
  if (!host || delta <= 0 || delta > 5 * 60000) return;
  const d = await loadDomain();
  const cat = kind === "distract" ? category("https://" + host) : kind;
  const rec = d.hosts[host] || { ms: 0, category: cat };
  rec.ms += delta;
  rec.category = cat;
  d.hosts[host] = rec;
  await set({ [DOMAIN_KEY]: d });
}

// 중립 도메인이면 1회 물어보기 상태를 켜고, 아니면 끈다
async function updateAsk(p, settings, sessionActive) {
  const cur = await get(ASK_KEY, null);
  const decided =
    settings.allowlist.includes(p.host) ||
    settings.blocklist.includes(p.host) ||
    (settings.askedHosts || []).includes(p.host);
  const shouldAsk = sessionActive && p.focused && p.kind === "neutral" && p.host && !decided;
  if (shouldAsk) {
    if (!cur || cur.host !== p.host) await set({ [ASK_KEY]: { host: p.host } });
  } else if (cur) {
    await set({ [ASK_KEY]: null });
  }
}

// 누적 반영: 직전 구간(lastTick→now)을 직전 상태/직전 활성 host에 귀속시킨다.
async function accumulate(present, p) {
  const s = await loadSession();
  if (!s.active) return;
  const now = Date.now();
  const delta = s.lastTick ? now - s.lastTick : 0;
  if (delta > 0 && delta < 5 * 60000) {
    if (s.present) {
      s.focusMs += delta;
      const stats = await loadStats();
      stats.focusMs += delta;
      await set({ [STATS_KEY]: stats });
    }
    if (s.activeHost) await addDomainTime(s.activeHost, s.activeKind, delta);
  }
  s.lastTick = now;
  s.present = present;
  if (p) {
    s.activeHost = p.focused ? p.host : "";
    s.activeKind = p.kind;
  }
  await set({ [SESSION_KEY]: s });
}

async function onLeave(p) {
  const s = await loadSession();
  if (!s.active || !s.present) return;
  await accumulate(false, p);
  const s2 = await loadSession();
  s2.awaySince = Date.now();
  await set({ [SESSION_KEY]: s2 });
  scheduleEscalation();
  dispatchWarning();
}

async function onReturn(p) {
  const s = await loadSession();
  if (!s.active || s.present) return;
  const awayMs = s.awaySince ? Date.now() - s.awaySince : 0;
  s.present = true;
  s.lastTick = Date.now();
  s.awaySince = 0;
  s.activeHelper = "concierge";
  if (p) { s.activeHost = p.focused ? p.host : ""; s.activeKind = p.kind; }
  clearEscalation();
  clearWarning();
  if (awayMs >= GRACE_MS) {
    s.sessionDistractMs += awayMs;
    s.sessionDistractCount += 1;
    const stats = await loadStats();
    stats.distractMs += awayMs;
    stats.distractCount += 1;
    stats.returnCount += 1;
    await set({ [STATS_KEY]: stats });
    const settings = await loadSettings();
    const t = TONE[settings.tone] || TONE.concierge;
    notify("탭talk", t.welcome);
  }
  await set({ [SESSION_KEY]: s });
}

async function evaluate() {
  const p = await probe();
  await broadcastClassification(p);
  const settings = await loadSettings();
  const s = await loadSession();
  await updateAsk(p, settings, s.active);
  if (s.active) await ensureNudgeScript(p);
  if (!s.active) return;

  // '업무중'은 업무로 등록된 사이트(기본 업무 목록 + 사용자가 허용한 도메인)에서만 인정한다.
  // 그 외 사이트는 업무중이 아니다.
  const present = p.focused && p.kind === "work";

  // 아직 업무/딴짓으로 분류되지 않은 중립 사이트는 '업무인가요?'만 물어보고
  // 업무 시간은 멈춘다(가산 X). 이때는 단계별 경고/알림도 띄우지 않는다.
  const decided =
    settings.allowlist.includes(p.host) ||
    settings.blocklist.includes(p.host) ||
    (settings.askedHosts || []).includes(p.host);
  const asking = p.focused && p.kind === "neutral" && p.host && !decided;
  if (asking) {
    await accumulate(false, p); // 업무중 아님 — 직전 구간만 마감하고 시간 멈춤
    clearEscalation();
    clearWarning();
    return;
  }

  if (present && !s.present) await onReturn(p);
  else if (!present && s.present) await onLeave(p);
  else await accumulate(present, p);
}

// ---- 단계별 도우미 알림 (chrome.alarms) ----
function scheduleEscalation() {
  clearEscalation();
  HELPERS.filter((h) => h.afterSec > 0).forEach((h) => {
    chrome.alarms.create("esc:" + h.id, { when: Date.now() + h.afterSec * 1000 });
  });
}
function clearEscalation() {
  HELPERS.forEach((h) => chrome.alarms.clear("esc:" + h.id));
}

chrome.alarms.onAlarm.addListener((alarm) => {
  runSafe(async () => {
    if (!alarm.name.startsWith("esc:")) return;
    const id = alarm.name.slice(4);
    const s = await loadSession();
    if (!s.active || s.present) return;
    const settings = await loadSettings();
    const t = TONE[settings.tone] || TONE.concierge;
    const helper = HELPERS.find((h) => h.id === id);
    s.activeHelper = id;
    await set({ [SESSION_KEY]: s });
    notify((helper && helper.name) || "탭talk", t.helpers[id] || t.helpers.concierge);
  });
});

function notify(title, message) {
  try {
    chrome.notifications.create("tabtalk:" + Date.now(), {
      type: "basic",
      iconUrl: "/icons/icon128.png",
      title,
      message,
      priority: 1
    }, () => void chrome.runtime.lastError);
  } catch {}
}

// ---- 딴짓 경고 디스패치 (옵션: nudge | popup) ----
let warnWindowId = null;

async function dispatchWarning() {
  const settings = await loadSettings();
  const style = settings.warnStyle || "nudge";
  if (style === "popup") {
    try {
      // 이미 떠 있으면 새로 만들지 않는다 (깜빡임/중복 방지)
      if (warnWindowId != null) {
        try { await chrome.windows.get(warnWindowId); return; } catch { warnWindowId = null; }
      }
      const w = await chrome.windows.create({
        url: "warn/warn.html",
        type: "popup",
        width: 380,
        height: 260,
        top: 80,
        left: 80,
        focused: true
      });
      warnWindowId = w.id;
    } catch {}
  }
  // nudge는 content.js가 session.present 변화로 자동 처리
}

async function clearWarning() {
  if (warnWindowId != null) {
    try { await chrome.windows.remove(warnWindowId); } catch {}
    warnWindowId = null;
  }
}

chrome.windows.onRemoved.addListener((id) => {
  if (id === warnWindowId) warnWindowId = null;
});

// ---- 세션 제어 ----
async function startSession(goalMin) {
  const p = await probe();
  const s = fresh();
  s.active = true;
  s.present = true; // 시작은 업무중으로 두고, 직후 evaluate()가 실제 상태로 보정한다
  s.startedAt = Date.now();
  s.lastTick = Date.now();
  s.goalMin = goalMin || 25;
  s.activeHost = p.focused ? p.host : "";
  s.activeKind = p.kind;
  await set({ [SESSION_KEY]: s, [DOMAIN_KEY]: freshDomain() });
  await broadcastClassification(p);
  // 이후 onMessage 핸들러가 evaluate()를 호출해
  // 딴짓 사이트면 이탈 처리, 중립 사이트면 '업무인가요?' 질문으로 이어진다.
}

async function stopSession() {
  const p = await probe();
  await accumulate(p.focused && p.kind === "work", p);
  clearEscalation();
  clearWarning();
  await set({ [SESSION_KEY]: fresh(), [ASK_KEY]: null });
}

// 중립 도메인 답변 → allow/blocklist 반영, 다시 평가
async function answerClassification(host, answer) {
  if (!host) return;
  const settings = await loadSettings();
  const h = hostOf(host.includes("://") ? host : "https://" + host) || host;
  if (answer === "work") {
    settings.blocklist = settings.blocklist.filter((d) => d !== h);
    if (!settings.allowlist.includes(h)) settings.allowlist.push(h);
  } else if (answer === "distract") {
    settings.allowlist = settings.allowlist.filter((d) => d !== h);
    if (!settings.blocklist.includes(h)) settings.blocklist.push(h);
  }
  if (!settings.askedHosts) settings.askedHosts = [];
  if (!settings.askedHosts.includes(h)) settings.askedHosts.push(h);
  await set({ [SETTINGS_KEY]: settings, [ASK_KEY]: null });
  await evaluate();
}

// ---- 탭/창 이벤트 → 재평가 ----
chrome.tabs.onActivated.addListener(() => runSafe(evaluate));
chrome.tabs.onUpdated.addListener((_, info) => { if (info.url) runSafe(evaluate); });
chrome.windows.onFocusChanged.addListener(() => runSafe(evaluate));

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (!msg || typeof msg.type !== "string") return false;
  if (msg.type.startsWith("idle:")) return false; // tab-usage 담당
  (async () => {
    try {
      switch (msg.type) {
        case "start": await startSession(msg.goalMin); break;
        case "stop": await stopSession(); break;
        case "reset": await set({ [STATS_KEY]: freshStats(), [DOMAIN_KEY]: freshDomain() }); break;
        case "tone": {
          const st = await loadSettings();
          st.tone = msg.tone;
          await set({ [SETTINGS_KEY]: st });
          break;
        }
        case "classify-answer": await answerClassification(msg.host, msg.answer); break;
      }
      await evaluate();
      send({
        session: await loadSession(),
        stats: await loadStats(),
        settings: await loadSettings(),
        classification: await get(CLASSIFY_KEY, null),
        domainStats: await loadDomain(),
        ask: await get(ASK_KEY, null)
      });
    } catch (err) {
      send({
        error: (err && err.message) || String(err),
        session: fresh(),
        stats: freshStats(),
        settings: await loadSettings().catch(() => ({ tone: "concierge" })),
        classification: await get(CLASSIFY_KEY, null).catch(() => null),
        domainStats: freshDomain(),
        ask: await get(ASK_KEY, null).catch(() => null)
      });
    }
  })();
  return true; // 비동기 응답
});

chrome.runtime.onInstalled.addListener(() => {
  runSafe(async () => {
    if (!(await get(SESSION_KEY, null))) await set({ [SESSION_KEY]: fresh() });
  });
});

// 방치된 탭 추적 & 단계별 안내 모듈 시작
initTabUsage();
