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
    return `${min}분 미접속`;
  }
  const days = Math.floor(idleMs / 86400000);
  if (days >= 1) return `${days}일 미접속`;
  const hours = Math.floor(idleMs / 3600000);
  return `${hours}시간 미접속`;
}

// http(s) 탭만, 현재 보고 있는 탭은 제외
function trackable(tab) {
  return tab && tab.url && /^https?:/.test(tab.url);
}

// 접속 기록 갱신 + 단계 초기화
async function touch(tabId) {
  const usage = await get(USAGE_KEY, {});
  const rec = usage[tabId] || {};
  rec.lastAccess = Date.now();
  rec.notifiedLevel = 0;
  usage[tabId] = rec;
  await set({ [USAGE_KEY]: usage });
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
  rec.lastAccess = Date.now();
  rec.notifiedLevel = 0;
  usage[tabId] = rec;
}

// 팝업용: 방치 탭 목록(1단계 이상) — 알림은 보내지 않음
async function buildIdleList() {
  const settings = await loadSettings();
  const tabs = await chrome.tabs.query({});
  const usage = await get(USAGE_KEY, {});
  const now = Date.now();
  const tone = settings.tone || "concierge";
  const list = [];
  for (const tab of tabs) {
    if (!trackable(tab)) continue;
    if (tab.active) continue;
    const rec = usage[tab.id];
    const last = (rec && rec.lastAccess) || tab.lastAccessed || now;
    const idleMs = now - last;
    const level = levelFor(idleMs, settings);
    if (level < 1) continue;
    list.push({
      tabId: tab.id,
      title: tabName(tab),
      domain: hostOf(tab.url),
      favIconUrl: tab.favIconUrl || "",
      idleMs,
      idleLabel: idleLabel(idleMs, settings),
      level,
      message: messageFor(level, tone, tabName(tab), settings)
    });
  }
  list.sort((a, b) => b.idleMs - a.idleMs);
  return list;
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
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "/icons/icon128.png",
    title: `🔔 ${label}`,
    message,
    priority: 1
  });
}

chrome.notifications.onClicked.addListener((id) => {
  if (!id.startsWith("idletab:")) return;
  const tabId = Number(id.split(":")[1]);
  if (!Number.isNaN(tabId)) focusTab(tabId);
  chrome.notifications.clear(id);
});

// ---- 리스너/알람 등록 ----
export function initTabUsage() {
  chrome.tabs.onActivated.addListener(({ tabId }) => touch(tabId));
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === "complete" || info.url) touch(tabId);
  });
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const usage = await get(USAGE_KEY, {});
    if (usage[tabId]) {
      delete usage[tabId];
      await set({ [USAGE_KEY]: usage });
    }
  });

  chrome.alarms.create(SCAN_ALARM, { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SCAN_ALARM) scan();
  });

  // 방치 탭 관련 메시지 라우팅(다른 핸들러와 공존)
  chrome.runtime.onMessage.addListener((msg, _sender, send) => {
    if (!msg || !msg.type || !msg.type.startsWith("idle:")) return; // 다른 핸들러 담당
    (async () => {
      switch (msg.type) {
        case "idle:list": send(await buildIdleList()); break;
        case "idle:focus": await focusTab(msg.tabId); send(await buildIdleList()); break;
        case "idle:close": await closeTab(msg.tabId); send(await buildIdleList()); break;
        default: send(null);
      }
    })();
    return true; // 비동기 응답
  });

  scan(); // 시작 시 한 번
}
