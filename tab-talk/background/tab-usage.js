// 탭talk — 방치된 탭 추적 & 단계별 안내
// 각 탭의 마지막 접속 시각을 기록하고, 미접속 기간이 길어질수록
// 집사가 1일·3일·7일("저를 잊으셨나요?")·14일·30일, 그 이후엔 매주 새롭게 안내한다.
// 도메인 호스트와 제목만 다루며 페이지 내용은 보지 않는다.

import { hostOf } from "./classify.js";

const USAGE_KEY = "tabUsage";
const SETTINGS_KEY = "settings";
const SCAN_ALARM = "tabtalk:idle-scan";

// 단계 임계값(단위 배수). 기본은 '일' 단위, 테스트 모드는 '분' 단위.
const THRESHOLDS = [1, 3, 7, 14, 30];
const WEEK = 7; // 30 이후 추가 리마인드 간격(단위 배수)

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
async function loadSettings() {
  return await get(SETTINGS_KEY, { tone: "concierge", idleReminder: true, idleTestMode: false });
}
// 단계 단위(ms): 기본 하루, 테스트 모드는 1분
function unitMs(settings) {
  return settings.idleTestMode ? 60000 : 86400000;
}

// ---- 단계별 안내 문구 (집사 톤 4종) ----
const TAB_LINES = {
  concierge: {
    1: (n) => `주인님, '${n}' 탭을 하루 동안 안 들르셨어요. 아직 곁에 두실 건가요?`,
    3: (n) => `주인님, '${n}' 탭이 사흘째 곤히 잠들어 있습니다. 깨워둘까요, 보내드릴까요?`,
    7: (n) => `주인님, 혹 저를 잊으셨나요? '${n}' 탭이 일주일째 같은 자리에서 기다립니다.`,
    14: (n) => `주인님, '${n}' 탭과 2주째 눈도 마주치지 않으셨어요. 조용히 정리해 둘까요?`,
    30: (n) => `주인님, '${n}' 탭이 한 달을 꼬박 자리만 지켰습니다. 이제는 작별도 예의겠지요.`,
    more: (n, w) => `주인님, '${n}' 탭을 잊으신 지 ${w}주가 더 흘렀습니다. 살며시 거두어 둘까요?`
  },
  secretary: {
    1: (n) => `주인님, '${n}' 탭 하루 동안 안 보셨어요. 아직 쓰실 거 맞죠?`,
    3: (n) => `주인님, '${n}' 탭이 사흘째 그대로예요. 우리 같이 정리해볼까요?`,
    7: (n) => `주인님, 저 잊으신 거 아니죠? '${n}' 탭이 일주일째 기다리고 있어요.`,
    14: (n) => `주인님, '${n}' 탭이랑 벌써 2주째예요. 이제 보내줘도 괜찮을 것 같아요.`,
    30: (n) => `주인님, '${n}' 탭, 어느새 한 달이에요. 우리 작별 인사할까요?`,
    more: (n, w) => `주인님, '${n}' 탭 잊은 지 ${w}주 더 됐어요. 제가 살짝 정리해둘게요.`
  },
  coach: {
    1: (n) => `주인님, '${n}' 탭 미접속 1일. 불필요하면 닫는 편이 효율적입니다.`,
    3: (n) => `주인님, '${n}' 탭 미접속 3일. 정리를 권장합니다.`,
    7: (n) => `주인님, '${n}' 탭 미접속 7일. 재사용 가능성이 낮습니다.`,
    14: (n) => `주인님, '${n}' 탭 미접속 14일. 닫는 것을 권장합니다.`,
    30: (n) => `주인님, '${n}' 탭 미접속 30일. 보관 가치가 낮습니다.`,
    more: (n, w) => `주인님, '${n}' 탭 미접속이 ${w}주 더 누적됐습니다. 정리를 권장합니다.`
  },
  manager: {
    1: (n) => `주인님! '${n}' 탭 하루째 방치! 안 쓰면 과감하게 닫읍시다!`,
    3: (n) => `주인님! '${n}' 탭 3일째 잠수 중! 지금이 정리각이에요!`,
    7: (n) => `주인님! 설마 저 잊으셨어요? '${n}' 탭 일주일째라구요!`,
    14: (n) => `주인님! '${n}' 탭 2주째! 미련 없이 보내주고 가볍게 가요!`,
    30: (n) => `주인님! '${n}' 탭 한 달 풀 채웠어요! 작별할 시간입니다!`,
    more: (n, w) => `주인님! '${n}' 탭 잊은 지 ${w}주 추가! 싹 정리하고 달려봅시다!`
  }
};

// 탭 이름: 제목 우선(20자 제한), 없으면 도메인
function tabName(tab) {
  const title = (tab.title || "").trim();
  if (title) return title.length > 20 ? title.slice(0, 19) + "…" : title;
  return hostOf(tab.url) || "이름 없는";
}

// 미접속 시간 → 단계(level)와 문구 키 계산
// level: 0=없음, 1~5=고정 단계, 6+=30단계 이후 매주 추가
function levelFor(idleMs, settings) {
  const u = unitMs(settings);
  const units = idleMs / u;
  let level = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) if (units >= THRESHOLDS[i]) level = i + 1;
  if (units >= 30) {
    const extraWeeks = Math.floor((units - 30) / WEEK);
    level = 5 + extraWeeks; // 매 주 단위로 단계 상승
  }
  return level;
}

function messageFor(level, tone, name, settings) {
  const pack = TAB_LINES[tone] || TAB_LINES.concierge;
  const key = THRESHOLDS[level - 1];
  if (level <= 5 && key) return pack[key](name);
  // 6단계 이상: 30단계 이후 추가 경과 주차
  const extraWeeks = level - 5;
  return pack.more(name, extraWeeks);
}

// 사람이 읽는 미접속 라벨
function idleLabel(idleMs, settings) {
  if (settings.idleTestMode) {
    const min = Math.floor(idleMs / 60000);
    return min < 1 ? "방금 전" : `${min}분 미접속`;
  }
  const days = Math.floor(idleMs / 86400000);
  if (days >= 1) return `${days}일 미접속`;
  const hours = Math.floor(idleMs / 3600000);
  if (hours >= 1) return `${hours}시간 미접속`;
  const min = Math.floor(idleMs / 60000);
  return min < 1 ? "방금 전" : `${min}분 미접속`;
}

// 사람이 읽는 "열어둔 시간" 라벨
function openLabel(openMs) {
  if (openMs < 60000) return "방금 열림";
  const min = Math.floor(openMs / 60000);
  if (min < 60) return `${min}분째 열림`;
  const hours = Math.floor(openMs / 3600000);
  if (hours < 24) return `${hours}시간째 열림`;
  const days = Math.floor(openMs / 86400000);
  return `${days}일째 열림`;
}

// http(s) 탭만, 현재 보고 있는 탭은 제외
function trackable(tab) {
  return tab && tab.url && /^https?:/.test(tab.url);
}

// 접속 기록 갱신 + 단계 초기화
async function touch(tabId) {
  const usage = await get(USAGE_KEY, {});
  const rec = usage[tabId] || {};
  if (!rec.openedAt) rec.openedAt = Date.now();
  rec.lastAccess = Date.now();
  rec.notifiedLevel = 0;
  usage[tabId] = rec;
  await set({ [USAGE_KEY]: usage });
}

// 팝업용: 열린 모든 탭 목록(미접속 시간·열어둔 시간·잠듦 상태 포함) — 알림은 보내지 않음
const HEAVY_OPEN_MS = 2 * 3600000; // 2시간 이상 켜둔 탭은 "메모리 부담" 후보

async function buildTabList() {
  const settings = await loadSettings();
  const tabs = await chrome.tabs.query({});
  const usage = await get(USAGE_KEY, {});
  const now = Date.now();
  const tone = settings.tone || "concierge";
  const list = [];
  for (const tab of tabs) {
    if (!trackable(tab)) continue;
    const rec = usage[tab.id];
    const last = (rec && rec.lastAccess) || tab.lastAccessed || now;
    const openedAt = (rec && rec.openedAt) || tab.lastAccessed || now;
    const openMs = Math.max(0, now - openedAt);
    const idleMs = tab.active ? 0 : now - last;
    const level = tab.active ? 0 : levelFor(idleMs, settings);
    list.push({
      tabId: tab.id,
      title: tabName(tab),
      domain: hostOf(tab.url),
      favIconUrl: tab.favIconUrl || "",
      idleMs,
      idleLabel: tab.active ? "보는 중" : idleLabel(idleMs, settings),
      openMs,
      openLabel: openLabel(openMs),
      heavy: !tab.discarded && openMs >= HEAVY_OPEN_MS,
      level,
      discarded: !!tab.discarded,
      active: !!tab.active,
      message: level >= 1 ? messageFor(level, tone, tabName(tab), settings) : ""
    });
  }
  // 보는 탭 먼저, 그 다음 오래 켜둔 순
  list.sort((a, b) => (b.active - a.active) || (b.openMs - a.openMs));
  return list;
}

// 열린 탭 수·열어둔 시간으로 "컴퓨터 부담" 상태를 계산 (메모리 권한 없이도 항상 동작)
function buildLoad(tabs, memory) {
  const live = tabs.filter((t) => !t.discarded).length;
  const longOpen = tabs.filter((t) => t.heavy).length;
  let ratio, level, source;
  if (memory && memory.capacity) {
    ratio = Math.min(1, 1 - memory.available / memory.capacity);
    level = ratio >= 0.85 ? "heavy" : ratio >= 0.6 ? "medium" : "light";
    source = "memory";
  } else {
    ratio = Math.min(1, (live + longOpen) / 16);
    level = live >= 13 || longOpen >= 5 ? "heavy" : live >= 6 || longOpen >= 2 ? "medium" : "light";
    source = "tabs";
  }
  const titles = { light: "쾌적해요 🟢", medium: "조금 무거워요 🟠", heavy: "느려질 수 있어요 🔴" };
  let message;
  if (level === "light") {
    message = `열린 탭 ${live}개. 지금은 가볍게 돌아가고 있어요.`;
  } else if (level === "medium") {
    message = `열린 탭 ${live}개가 메모리를 나눠 쓰는 중이에요. 안 쓰는 탭은 정리하면 더 쾌적해져요.`;
  } else {
    message = `탭 ${live}개가 열려 있어요. 오래 켜둔 탭이 컴퓨터를 느리게 만들 수 있으니 정리를 권해요.`;
  }
  if (longOpen > 0) message += ` (2시간 넘게 켜둔 탭 ${longOpen}개)`;
  return { ratio, pct: Math.round(ratio * 100), level, source, title: titles[level], message, live, longOpen };
}

// 팝업용: 탭 목록 + 잠든 탭 수 + 시스템 메모리 + 부담 상태 + 현재 탭
async function buildOverview() {
  const tabs = await buildTabList();
  const discarded = tabs.filter((t) => t.discarded).length;
  let memory = null;
  try {
    if (chrome.system && chrome.system.memory) {
      const m = await chrome.system.memory.getInfo();
      memory = { capacity: m.capacity, available: m.availableCapacity };
    }
  } catch {}
  const load = buildLoad(tabs, memory);
  const cur = tabs.find((t) => t.active) || null;
  const current = cur
    ? { title: cur.title, domain: cur.domain, openLabel: cur.openLabel, openMs: cur.openMs, heavy: cur.heavy }
    : null;
  return { tabs, total: tabs.length, discarded, memory, load, current };
}

// 모든 탭 검사 → 새 단계 도달 시 알림
async function scan() {
  const settings = await loadSettings();
  if (settings.idleReminder === false) return;
  const tabs = await chrome.tabs.query({});
  const usage = await get(USAGE_KEY, {});
  const now = Date.now();

  for (const tab of tabs) {
    if (!trackable(tab)) continue;
    if (tab.active) {
      touchInline(usage, tab.id);
      continue;
    }
    const rec = usage[tab.id] || { lastAccess: tab.lastAccessed || now, notifiedLevel: 0 };
    if (!rec.openedAt) rec.openedAt = tab.lastAccessed || now;
    const last = rec.lastAccess || tab.lastAccessed || now;
    const idleMs = now - last;
    const level = levelFor(idleMs, settings);
    if (level > (rec.notifiedLevel || 0)) {
      rec.notifiedLevel = level;
      const tone = settings.tone || "concierge";
      notifyTab(tab, messageFor(level, tone, tabName(tab), settings), idleLabel(idleMs, settings));
    }
    rec.lastAccess = last;
    usage[tab.id] = rec;
  }
  // 닫힌 탭 정리
  const open = new Set(tabs.map((t) => String(t.id)));
  for (const id of Object.keys(usage)) if (!open.has(id)) delete usage[id];
  await set({ [USAGE_KEY]: usage });
}

function touchInline(usage, tabId) {
  const rec = usage[tabId] || {};
  if (!rec.openedAt) rec.openedAt = Date.now();
  rec.lastAccess = Date.now();
  rec.notifiedLevel = 0;
  usage[tabId] = rec;
}

async function focusTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
    await touch(tabId);
  } catch {}
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    const usage = await get(USAGE_KEY, {});
    delete usage[tabId];
    await set({ [USAGE_KEY]: usage });
  } catch {}
}

// 알림: 클릭하면 해당 탭으로 이동
function notifyTab(tab, message, label) {
  const id = `idletab:${tab.id}:${Date.now()}`;
  try {
    chrome.notifications.create(id, {
      type: "basic",
      iconUrl: "/icons/icon128.png",
      title: `🔔 ${label}`,
      message,
      priority: 1
    }, () => void chrome.runtime.lastError);
  } catch {}
}

chrome.notifications.onClicked.addListener((id) => {
  if (!id.startsWith("idletab:")) return;
  const tabId = Number(id.split(":")[1]);
  if (!Number.isNaN(tabId)) focusTab(tabId);
  chrome.notifications.clear(id);
});

// ---- 리스너/알람 등록 ----
export function initTabUsage() {
  chrome.tabs.onCreated.addListener((tab) => runSafe(async () => {
    if (tab.id == null) return;
    const usage = await get(USAGE_KEY, {});
    const rec = usage[tab.id] || {};
    if (!rec.openedAt) rec.openedAt = Date.now();
    if (!rec.lastAccess) rec.lastAccess = Date.now();
    usage[tab.id] = rec;
    await set({ [USAGE_KEY]: usage });
  }));
  chrome.tabs.onActivated.addListener(({ tabId }) => runSafe(() => touch(tabId)));
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === "complete" || info.url) runSafe(() => touch(tabId));
  });
  chrome.tabs.onRemoved.addListener((tabId) => runSafe(async () => {
    const usage = await get(USAGE_KEY, {});
    if (usage[tabId]) {
      delete usage[tabId];
      await set({ [USAGE_KEY]: usage });
    }
  }));

  chrome.alarms.create(SCAN_ALARM, { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SCAN_ALARM) runSafe(scan);
  });

  // 방치 탭 관련 메시지 라우팅(다른 핸들러와 공존)
  chrome.runtime.onMessage.addListener((msg, _sender, send) => {
    if (!msg || !msg.type || !msg.type.startsWith("idle:")) return false; // 다른 핸들러 담당
    (async () => {
      try {
        switch (msg.type) {
          case "idle:list": send(await buildTabList()); break;
          case "idle:overview": send(await buildOverview()); break;
          case "idle:focus": await focusTab(msg.tabId); send(await buildOverview()); break;
          case "idle:close": await closeTab(msg.tabId); send(await buildOverview()); break;
          default: send(null);
        }
      } catch {
        send(null);
      }
    })();
    return true; // 비동기 응답
  });

  runSafe(scan); // 시작 시 한 번
}
