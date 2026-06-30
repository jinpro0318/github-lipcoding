// 탭talk 프론트엔드 — Toss 스타일 + 백엔드 API 연동
// 집중 추적은 Page Visibility API로 수행하고, 통계는 서버에 동기화합니다.
// 서버 연결이 끊겨도 localStorage 폴백으로 계속 동작합니다.

const API = {
  stats: "/api/stats/today",
  event: "/api/session/event",
  reset: "/api/stats/reset",
  coach: "/api/coach",
  forecast: "/api/forecast",
  health: "/api/health"
};

const TONE_KEY = "tabtalk.tone";
const LOCAL_KEY = "tabtalk.local";
const HISTORY_KEY = "tabtalk.history"; // 세션 단위 기록 (오프라인 예측용)
const GOAL_KEY = "tabtalk.goal"; // 세션 목표 시간(분)
const GAZE_KEY = "tabtalk.gaze"; // 오늘 카메라 눈맞춤 집계

// ---- 도우미 ----
const HELPERS = [
  { id: "concierge", icon: "concierge-bell", name: "탭talk 집사", afterSec: 0 },
  { id: "noljima", icon: "hand", name: "놀지마AI", afterSec: 60 },
  { id: "teacher", icon: "glasses", name: "탭선생", afterSec: 180 },
  { id: "alarm", icon: "siren", name: "딴짓경보기", afterSec: 300 },
  { id: "pleader", icon: "heart-handshake", name: "집중호소인", afterSec: 600 }
];

// ---- 톤별 멘트 ----
const TONE = {
  concierge: {
    idle: "주인님, 환영합니다. 준비되시면 집중 세션을 시작해 드릴게요.",
    focus: "주인님, 지금 흐름이 아주 좋으십니다. 그대로 모시겠습니다.",
    helpers: {
      concierge: "주인님, 잠시 다른 곳에 머무르고 계시네요. 원하실 때 모셔다 드릴게요.",
      noljima: "주인님, 1분이 지났어요. 슬슬 자리로 다시 모실까요?",
      teacher: "주인님, 3분째 머무셨어요. 집중 자리로 정중히 안내해 드릴게요.",
      alarm: "주인님, 5분이 지났습니다. 오늘 목표가 주인님을 기다리고 있어요.",
      pleader: "주인님, 충분히 쉬셨다면 이제 멋진 집중을 보여주실 시간이에요."
    },
    welcome: "주인님, 돌아와 주셔서 감사합니다. 바로 집중 자리로 모실게요."
  },
  secretary: {
    idle: "오셨어요? 준비되면 바로 시작할게요. 천천히 하셔도 돼요.",
    focus: "오, 지금 집중력 정말 좋아요. 이대로 쭉 가요!",
    helpers: {
      concierge: "잠깐 한눈파셨네요. 괜찮아요, 같이 돌아가요.",
      noljima: "1분 지났어요. 이제 슬슬 돌아올까요?",
      teacher: "벌써 3분이에요. 우리 다시 집중해봐요, 응?",
      alarm: "5분 지났어요! 할 일이 기다리고 있어요.",
      pleader: "이제 진짜 돌아올 시간이에요. 제가 응원할게요."
    },
    welcome: "돌아왔네요! 잘했어요. 다시 시작해봐요."
  },
  coach: {
    idle: "세션을 시작하면 집중 시간을 측정합니다.",
    focus: "집중 유지 중. 좋은 페이스입니다.",
    helpers: {
      concierge: "집중에서 벗어났습니다. 복귀를 권장합니다.",
      noljima: "1분 경과. 지금 복귀하면 흐름을 살릴 수 있습니다.",
      teacher: "3분 경과. 작업 맥락이 끊기기 시작합니다.",
      alarm: "5분 경과. 목표 진행이 지연되고 있습니다.",
      pleader: "10분 경과. 세션을 재정비할 시점입니다."
    },
    welcome: "복귀 확인. 세션을 이어갑니다."
  },
  manager: {
    idle: "자, 시작해볼까요? 오늘도 멋지게 가봅시다!",
    focus: "이야 집중력 미쳤다! 그대로 가즈아!",
    helpers: {
      concierge: "어이쿠 잠깐 새셨네요! 다시 가봅시다!",
      noljima: "1분 컷! 자 돌아와요, 할 수 있어요!",
      teacher: "3분이나! 괜찮아요, 지금부터 다시 달리면 돼요!",
      alarm: "5분 경보! 목표가 손짓하고 있어요, 가즈아!",
      pleader: "10분이면 충분히 쉬었어요! 이제 폭발할 시간!"
    },
    welcome: "돌아왔다! 역시 해낼 줄 알았어요. 가봅시다!"
  }
};

// ---- 집사 스타일 이름 (4종 모두 '집사') ----
const TONE_LABELS = {
  concierge: "정중한 집사",
  secretary: "다정한 집사",
  coach: "차분한 집사",
  manager: "열정 집사"
};

// ---- 집사별 캐릭터 디자인 (스타일마다 다른 마스코트 SVG) ----
const MASCOTS = {
  // 정중한 집사 — 네이비/블루 + 벨보이 모자 + 컨시어지 벨
  concierge: `<svg class="mascot-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="정중한 집사 탭이">
    <defs>
      <linearGradient id="bodyConcierge" x1="60" y1="34" x2="60" y2="108" gradientUnits="userSpaceOnUse"><stop stop-color="#5aa0ff"/><stop offset="1" stop-color="#3182f6"/></linearGradient>
      <linearGradient id="capConcierge" x1="60" y1="22" x2="60" y2="42" gradientUnits="userSpaceOnUse"><stop stop-color="#ff6b76"/><stop offset="1" stop-color="#f04452"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="111" rx="27" ry="5" fill="#191f28" opacity="0.07"/>
    <rect x="25" y="42" width="70" height="65" rx="32" fill="url(#bodyConcierge)"/>
    <ellipse cx="60" cy="80" rx="21" ry="19" fill="#ffffff" opacity="0.14"/>
    <rect x="35" y="38" width="50" height="9" rx="4.5" fill="#1b64da"/>
    <rect x="39" y="25" width="42" height="16" rx="8" fill="url(#capConcierge)"/>
    <rect x="39" y="34" width="42" height="3" rx="1.5" fill="#ffd23f" opacity="0.92"/>
    <circle cx="60" cy="21" r="3.8" fill="#ffd23f"/>
    <circle cx="49" cy="68" r="6.4" fill="#fff"/><circle cx="71" cy="68" r="6.4" fill="#fff"/>
    <circle class="mascot-pupil" cx="50" cy="69" r="3.3" fill="#191f28"/><circle class="mascot-pupil" cx="72" cy="69" r="3.3" fill="#191f28"/>
    <circle cx="51.3" cy="67.6" r="1" fill="#fff"/><circle cx="73.3" cy="67.6" r="1" fill="#fff"/>
    <circle cx="41" cy="78" r="3.8" fill="#ff8a3d" opacity="0.32"/><circle cx="79" cy="78" r="3.8" fill="#ff8a3d" opacity="0.32"/>
    <path d="M53 82 Q60 89 67 82" stroke="#191f28" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 97 L51 92 L51 102 Z" fill="#fff"/><path d="M60 97 L69 92 L69 102 Z" fill="#fff"/><circle cx="60" cy="97" r="2.4" fill="#dbe4ee"/>
    <g transform="translate(85 92)"><rect x="-9" y="8" width="18" height="3" rx="1.5" fill="#e0a800"/><path d="M-8 8 a8 7 0 0 1 16 0 Z" fill="#ffd23f"/><circle cx="0" cy="-1" r="1.8" fill="#ffe487"/></g>
  </svg>`,
  // 다정한 집사 — 민트/그린 + 앞머리 + 하트 안테나 + 커피잔, 웃는 눈(^^)
  secretary: `<svg class="mascot-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="다정한 집사 탭이">
    <defs>
      <linearGradient id="bodySecretary" x1="60" y1="34" x2="60" y2="108" gradientUnits="userSpaceOnUse"><stop stop-color="#4fd49a"/><stop offset="1" stop-color="#00c73c"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="111" rx="27" ry="5" fill="#191f28" opacity="0.07"/>
    <rect x="25" y="42" width="70" height="65" rx="32" fill="url(#bodySecretary)"/>
    <ellipse cx="60" cy="80" rx="21" ry="19" fill="#ffffff" opacity="0.14"/>
    <path d="M30 52 Q40 38 60 38 Q80 38 90 52 Q78 46 60 46 Q42 46 30 52 Z" fill="#00a831"/>
    <circle cx="60" cy="35" r="3.2" fill="#ff8fae"/>
    <path d="M43 70 Q49 64 55 70" stroke="#191f28" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M65 70 Q71 64 77 70" stroke="#191f28" stroke-width="3" stroke-linecap="round" fill="none"/>
    <circle cx="42" cy="80" r="4.4" fill="#ff8fae" opacity="0.45"/><circle cx="78" cy="80" r="4.4" fill="#ff8fae" opacity="0.45"/>
    <path d="M52 82 Q60 90 68 82" stroke="#191f28" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 98 L51 93 L51 103 Z" fill="#fff"/><path d="M60 98 L69 93 L69 103 Z" fill="#fff"/><circle cx="60" cy="98" r="2.4" fill="#dbe4ee"/>
    <g transform="translate(83 92)"><rect x="-7" y="-4" width="14" height="11" rx="2" fill="#fff"/><rect x="-7" y="-4" width="14" height="4" rx="2" fill="#c98a5a"/><path d="M7 -1 q5 0 5 4 q0 4 -5 4" stroke="#fff" stroke-width="2" fill="none"/><path d="M-2 -9 q2 -3 0 -5 M3 -9 q2 -3 0 -5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/></g>
  </svg>`,
  // 차분한 집사 — 바이올렛/퍼플 + 둥근 안경 + 클립보드, 단정한 입
  coach: `<svg class="mascot-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="차분한 집사 탭이">
    <defs>
      <linearGradient id="bodyCoach" x1="60" y1="34" x2="60" y2="108" gradientUnits="userSpaceOnUse"><stop stop-color="#a78bfa"/><stop offset="1" stop-color="#7c5cff"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="111" rx="27" ry="5" fill="#191f28" opacity="0.07"/>
    <rect x="25" y="42" width="70" height="65" rx="32" fill="url(#bodyCoach)"/>
    <ellipse cx="60" cy="80" rx="21" ry="19" fill="#ffffff" opacity="0.16"/>
    <path d="M32 51 Q42 38 60 38 Q78 38 88 51 Q60 43 32 51 Z" fill="#5b3ec9"/>
    <circle cx="49" cy="68" r="6" fill="#fff"/><circle cx="71" cy="68" r="6" fill="#fff"/>
    <circle class="mascot-pupil" cx="50" cy="69" r="3" fill="#191f28"/><circle class="mascot-pupil" cx="72" cy="69" r="3" fill="#191f28"/>
    <circle cx="49" cy="68" r="9" fill="none" stroke="#2d1b69" stroke-width="2.4"/>
    <circle cx="71" cy="68" r="9" fill="none" stroke="#2d1b69" stroke-width="2.4"/>
    <line x1="58" y1="67" x2="62" y2="67" stroke="#2d1b69" stroke-width="2.4"/>
    <circle cx="42" cy="79" r="3.6" fill="#ff8fae" opacity="0.3"/><circle cx="78" cy="79" r="3.6" fill="#ff8fae" opacity="0.3"/>
    <path d="M54 84 Q60 87 66 84" stroke="#191f28" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 98 L51 93 L51 103 Z" fill="#fff"/><path d="M60 98 L69 93 L69 103 Z" fill="#fff"/><circle cx="60" cy="98" r="2.4" fill="#e7dcff"/>
    <g transform="translate(84 90)"><rect x="-8" y="-9" width="16" height="20" rx="2" fill="#fff"/><rect x="-4" y="-12" width="8" height="4" rx="1.5" fill="#b8a6ff"/><line x1="-4" y1="-3" x2="4" y2="-3" stroke="#cfc2f5" stroke-width="1.6"/><line x1="-4" y1="2" x2="4" y2="2" stroke="#cfc2f5" stroke-width="1.6"/><line x1="-4" y1="7" x2="2" y2="7" stroke="#cfc2f5" stroke-width="1.6"/></g>
  </svg>`,
  // 열정 집사 — 오렌지/레드 + 머리띠 + 불꽃, 활짝 웃는 입
  manager: `<svg class="mascot-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="열정 집사 탭이">
    <defs>
      <linearGradient id="bodyManager" x1="60" y1="34" x2="60" y2="108" gradientUnits="userSpaceOnUse"><stop stop-color="#ffb15a"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="111" rx="27" ry="5" fill="#191f28" opacity="0.07"/>
    <rect x="25" y="42" width="70" height="65" rx="32" fill="url(#bodyManager)"/>
    <ellipse cx="60" cy="80" rx="21" ry="19" fill="#ffffff" opacity="0.14"/>
    <rect x="33" y="44" width="54" height="8" rx="4" fill="#f04452"/>
    <path d="M87 47 l11 -3 -3 6 8 2 -10 3 z" fill="#f04452"/>
    <path d="M43 60 l10 3" stroke="#191f28" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M77 60 l-10 3" stroke="#191f28" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="49" cy="69" r="6.4" fill="#fff"/><circle cx="71" cy="69" r="6.4" fill="#fff"/>
    <circle class="mascot-pupil" cx="50" cy="70" r="3.3" fill="#191f28"/><circle class="mascot-pupil" cx="72" cy="70" r="3.3" fill="#191f28"/>
    <circle cx="51.3" cy="68.6" r="1" fill="#fff"/><circle cx="73.3" cy="68.6" r="1" fill="#fff"/>
    <path d="M50 81 Q60 93 70 81 Z" fill="#191f28"/>
    <path d="M56 86 q4 4 8 0 Z" fill="#ff5b6b"/>
    <path d="M60 99 L51 94 L51 104 Z" fill="#fff"/><path d="M60 99 L69 94 L69 104 Z" fill="#fff"/><circle cx="60" cy="99" r="2.4" fill="#ffe1cf"/>
    <g transform="translate(84 90)"><path d="M0 -11 Q6 -3 3 4 Q9 2 7 -3 Q13 5 6 12 Q0 16 -6 12 Q-13 5 -6 -3 Q-7 2 -3 4 Q-6 -3 0 -11 Z" fill="#ff8a3d"/><path d="M0 -2 Q3 2 1 7 Q-3 7 -2 1 Q-2 -1 0 -2 Z" fill="#ffd23f"/></g>
  </svg>`
};

// 선택한 집사 캐릭터로 마스코트 SVG 교체 (스파크는 유지)
function setMascot(toneId) {
  const m = el("mascot");
  if (!m) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = MASCOTS[toneId] || MASCOTS.concierge;
  const next = tmp.querySelector(".mascot-svg");
  if (!next) return;
  const cur = m.querySelector(".mascot-svg");
  if (cur) cur.replaceWith(next);
  else m.appendChild(next);
  // PiP 창이 열려 있으면 거기 캐릭터도 갱신
  if (typeof pipWindow !== "undefined" && pipWindow && !pipWindow.closed) {
    const pm = pipWindow.document.getElementById("pm");
    if (pm) pm.innerHTML = next.outerHTML;
  }
}

function paintToneFaces() {
  document.querySelectorAll(".tone-face").forEach((host) => {
    host.innerHTML = MASCOTS[host.dataset.toneFace] || MASCOTS.concierge;
  });
}

const TITLES = [
  { min: 0.9, label: "몰입의 신" },
  { min: 0.7, label: "집중 장인" },
  { min: 0.5, label: "균형 마스터" },
  { min: 0.3, label: "흔들리는 갈대" },
  { min: 0, label: "유혹의 탐험가" }
];

// 오늘 집중 비율로 정하는 플레이풀 '뇌 상태' 라벨
const BRAIN_STATES = [
  { min: 0.7, label: "몰입 상태 ⚡" },
  { min: 0.4, label: "혼돈의 카오스 🌪️" },
  { min: 0, label: "완전 딴짓 모드 🎠" }
];

// ---- 상태 ----
let tone = localStorage.getItem(TONE_KEY) || "concierge";
let online = false;
let sessionActive = false;
let present = true;
let focusMs = 0;
let lastTick = null;
let awaySince = null;
let loopId = null;
let escalationTimers = [];
let activeHelperId = "concierge";
let stats = { focusMs: 0, distractMs: 0, distractCount: 0, returnCount: 0 };
let sessionDistractMs = 0; // 이번 세션 딴짓 시간
let sessionDistractCount = 0; // 이번 세션 딴짓 횟수
let GOAL_MS = (parseInt(localStorage.getItem(GOAL_KEY), 10) || 25) * 60000; // 한 세션 목표(기본 25분)
let growthStage = 0; // 5분단위 캐릭터 성장 단계
let sessionGazeFocusMs = 0; // 이번 세션 화면 응시 시간
let sessionGazeAwayCount = 0; // 이번 세션 시선 이탈 횟수
let camLastFrameTs = 0; // 응시 시간 누적용 직전 프레임 시각
const GRACE_MS = 10000; // 이 시간 미만의 짧은 전환은 딴짓으로 안 셉 (참고 탭 확인 등)
let lastMilestone = 0; // 마지막 달성 마일스톤(분)
let toastTimer = null;

const el = (id) => document.getElementById(id);

// Lucide 아이콘을 특정 요소에 주입
function setIcon(id, name) {
  const node = el(id);
  if (!node) return;
  node.innerHTML = `<i data-lucide="${name}"></i>`;
  if (window.lucide) window.lucide.createIcons();
}

// ---- API helper (실패 시 폴백) ----
async function apiPost(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (_) {
    online = false;
    setConn();
    return null;
  }
}

async function apiGet(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (_) {
    online = false;
    setConn();
    return null;
  }
}

// ---- 로컬 폴백 저장 ----
function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ date: today(), ...stats }));
}
function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY));
    if (raw && raw.date === today()) {
      stats = {
        focusMs: raw.focusMs || 0,
        distractMs: raw.distractMs || 0,
        distractCount: raw.distractCount || 0,
        returnCount: raw.returnCount || 0
      };
    }
  } catch (_) {}
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---- 세션 히스토리 (예측의 근거 데이터) ----
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (_) {
    return [];
  }
}
function pushHistory(rec) {
  const h = loadHistory();
  h.unshift(rec); // 최근을 앞에
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50)));
}
// ---- 예측 계산 (서버와 동일 알고리즘, 오프라인에서도 동작) ----
function computeForecast(records) {
  const valid = (records || []).filter((r) => (r.focusMs || 0) + (r.distractMs || 0) > 0);
  const n = valid.length;
  if (n === 0) return { hasData: false, count: 0, confidence: "측정중" };

  let wSum = 0;
  let ratioSum = 0;
  let distractSum = 0;
  valid.forEach((r, i) => {
    const w = 1 / (i + 1); // 최근일수록 가중치↑
    const total = (r.focusMs || 0) + (r.distractMs || 0);
    ratioSum += w * ((r.focusMs || 0) / total);
    distractSum += w * (r.distractMs || 0);
    wSum += w;
  });

  return {
    hasData: true,
    count: n,
    focusRatio: Math.round((ratioSum / wSum) * 100),
    distractMin: Math.round(distractSum / wSum / 60000),
    confidence: n >= 6 ? "높음" : n >= 3 ? "보통" : "낮음"
  };
}

// 브리핑 카드 렌더
function renderBriefing(f) {
  el("briefingCard").hidden = false;
  if (!f || !f.hasData) {
    el("fcFocus").innerHTML = "--<small>%</small>";
    el("fcDistract").innerHTML = "--<small>분</small>";
    el("fcConf").textContent = "측정중";
    el("briefingBasis").textContent = `데이터 ${(f && f.count) || 0}/2`;
    el("briefingNote").textContent =
      "세션을 2회 이상 마치면 예상 몰입 비율과 딴짓 시간을 알려드려요. 지금은 패턴을 모으는 중이에요.";
    return;
  }
  el("fcFocus").innerHTML = `${f.focusRatio}<small>%</small>`;
  el("fcDistract").innerHTML = `${f.distractMin}<small>분</small>`;
  el("fcConf").textContent = f.confidence;
  el("briefingBasis").textContent = `최근 ${f.count}회 기반`;
  el("briefingNote").textContent = `최근 패턴으로 보면 이번 세션은 약 ${f.focusRatio}% 몰입, 딴짓 ${f.distractMin}분 정도가 예상돼요.`;
}

// 브리핑 갱신: 로컬 세션 히스토리 우선(오프라인 OK), 없으면 서버 예측 시도
async function showBriefing() {
  const local = computeForecast(loadHistory());
  if (local.hasData) {
    renderBriefing(local);
    return;
  }
  const remote = await apiGet(API.forecast);
  renderBriefing(remote && remote.hasData ? remote : local);
}

// 서버 응답을 로컬 stats로 반영
function applyServer(day) {
  if (!day) return;
  stats = {
    focusMs: day.focusMs || 0,
    distractMs: day.distractMs || 0,
    distractCount: day.distractCount || 0,
    returnCount: day.returnCount || 0
  };
  saveLocal();
  renderStats();
}

async function sendEvent(payload) {
  // 로컬 즉시 반영
  if (payload.type === "leave") stats.distractCount += 1;
  if (payload.type === "return") {
    stats.returnCount += 1;
    if (payload.awayMs) stats.distractMs += payload.awayMs;
  }
  if (payload.type === "focus-tick" && payload.deltaMs) stats.focusMs += payload.deltaMs;
  saveLocal();
  renderStats();
  // 서버 동기화
  const day = await apiPost(API.event, payload);
  if (day) applyServer(day);
}

// ---- 포맷 ----
function fmtMinNum(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}<small>분</small>`;
  return `${Math.floor(min / 60)}<small>시간</small>${min % 60}<small>분</small>`;
}
function fmtClock(ms) {
  const t = Math.floor(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

// ---- 동적 진행 표현 ----
// 토스트(화면 상단 알림)
function toast(text) {  const node = el("toast");
  if (!node) return;
  node.textContent = text;
  node.hidden = false;
  // 리플로우를 위해 다음 프레임에 show 클래스 추가
  requestAnimationFrame(() => node.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.classList.remove("show");
    setTimeout(() => (node.hidden = true), 250);
  }, 2200);
}

// 현재 목표(분)
function goalMin() {
  return Math.round(GOAL_MS / 60000);
}

// 목표 시간 변경 (칩 클릭)
function setGoal(min) {
  GOAL_MS = min * 60000;
  localStorage.setItem(GOAL_KEY, String(min));
  document.querySelectorAll(".goal-chip").forEach((c) => {
    c.classList.toggle("is-active", Number(c.dataset.goal) === min);
  });
  const gp = el("goalPreview");
  if (gp) gp.textContent = `목표 ${min}분 · 5분마다 탭이가 성장해요`;
  if (sessionActive) updateSessionProgress();
}

// 세션 진행 링/바 업데이트 + 마일스톤 체크
function updateSessionProgress() {
  const gm = goalMin();
  const pct = Math.min(100, (focusMs / GOAL_MS) * 100);
  el("heroRing").style.setProperty("--p", pct.toFixed(1));
  el("sessionFill").style.width = `${pct}%`;
  const mins = Math.floor(focusMs / 60000);
  const remainMin = Math.max(0, Math.ceil((GOAL_MS - focusMs) / 60000));
  el("sessionCap").textContent =
    pct >= 100
      ? `${gm}분 목표 달성! 멋지게 몰입하셨어요`
      : `${gm}분 목표까지 ${remainMin}분 남았어요`;
  // 5분마다 캐릭터가 한 뼘씩 자라는 연출(조용히 동기화)
  applyMascotGrowth(Math.floor(mins / 5), pct >= 100);
  checkMilestone(mins);
}

// 5분 단위 돌파 + 목표 도달 시 축하 + 레벨업 연출
function checkMilestone(mins) {
  const gm = goalMin();
  const marks = [];
  for (let m = 5; m < gm; m += 5) marks.push(m);
  marks.push(gm); // 마지막은 항상 목표
  for (const m of marks) {
    if (mins >= m && lastMilestone < m) {
      lastMilestone = m;
      const atGoal = m >= gm;
      const ring = el("heroRing");
      ring.classList.add("pop");
      setTimeout(() => ring.classList.remove("pop"), 600);
      celebrateMascot();
      toast(atGoal ? `🎉 ${gm}분 목표 달성! 최고예요, 주인님` : milestoneMsg(m, gm));
      break;
    }
  }
}

// 5분 돌파 메시지 (목표 대비 진행 표현)
function milestoneMsg(m, gm) {
  const left = gm - m;
  if (left <= 5) return `${m}분 돌파! 거의 다 왔어요`;
  if (m / gm >= 0.5) return `${m}분 돌파! 절반을 넘겼어요`;
  return `${m}분 돌파! 탭이가 한 단계 성장했어요 ✨`;
}

// 마스코트가 5분마다 한 뼘씩 자라는 연출 (레벨 숫자 대신 '성장' 느낌)
// stage: 5분단위 경과 수(0,1,2…), atGoal: 목표 달성 여부(만개 연출)
function applyMascotGrowth(stage, atGoal) {
  const m = el("mascot");
  if (!m) return;
  const s = Math.max(0, stage);
  const capped = Math.min(s, 6); // 6단계(30분)에서 크기 상한
  const scale = (1 + capped * 0.045).toFixed(3); // 5분마다 점점 커짐
  m.style.setProperty("--grow", scale);
  m.dataset.grow = String(capped); // 글로우 강도 단계(CSS)
  m.classList.toggle("bloom", !!atGoal); // 목표 달성 시 만개
  growthStage = s;
}

// 목표 달성 시 마스코트 축하 (점프 + 반짝이)
function celebrateMascot() {
  const m = el("mascot");
  if (!m) return;
  m.classList.remove("celebrate");
  void m.offsetWidth; // 리플로우로 애니메이션 재시작
  m.classList.add("celebrate");
  setTimeout(() => m.classList.remove("celebrate"), 1400);
}

// ---- 렌더 ----
function t() {
  return TONE[tone] || TONE.concierge;
}

function setHero(message) {
  el("heroMessage").textContent = message;
}

function highlightHelper(id) {
  document.querySelectorAll(".helper-row").forEach((li) => {
    li.classList.toggle("is-active", li.dataset.helper === id);
  });
  activeHelperId = id;
}

function setConn() {
  const node = el("connState");
  if (online) {
    node.textContent = "● 서버 연결됨";
    node.className = "conn-state online";
  } else {
    node.textContent = "● 오프라인 모드 (로컬 저장)";
    node.className = "conn-state offline";
  }
}

function renderStats() {
  el("statFocus").innerHTML = fmtMinNum(stats.focusMs);
  el("statDistract").innerHTML = fmtMinNum(stats.distractMs);
  const total = stats.focusMs + stats.distractMs;
  const ratio = total === 0 ? 1 : stats.focusMs / total;
  el("statReturn").innerHTML = `${Math.round(ratio * 100)}<small>%</small>`;
  el("focusBar").style.width = `${Math.round(ratio * 100)}%`;

  const title = TITLES.find((x) => ratio >= x.min) || TITLES[TITLES.length - 1];
  el("titleBadge").textContent = title.label;

  // 플레이풀 뇌 상태 라벨 (기록 있을 때만 노출)
  const brain = BRAIN_STATES.find((x) => ratio >= x.min) || BRAIN_STATES[BRAIN_STATES.length - 1];
  const bs = el("brainState");
  if (bs) {
    bs.hidden = total === 0;
    bs.textContent = brain.label;
  }
  const shareBtn = el("shareBtn");
  if (shareBtn) shareBtn.hidden = total === 0;

  const gaze = loadGazeToday();
  let gazeNote = "";
  if (gaze.focusMs > 0 || gaze.awayCount > 0) {
    gazeNote = ` · 👀 눈맞춤 ${Math.round(gaze.focusMs / 60000)}분·이탈 ${gaze.awayCount}회`;
  }
  el("focusCaption").textContent =
    total === 0
      ? "아직 기록이 없어요. 첫 세션을 시작해볼까요?"
      : `오늘 집중 ${Math.round(ratio * 100)}% · 딴짓 ${Math.round((1 - ratio) * 100)}%${gazeNote}`;
}

// 오늘 날짜 키
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// 오늘 눈맞춤 집계 로드 ({date, focusMs, awayCount})
function loadGazeToday() {
  try {
    const raw = JSON.parse(localStorage.getItem(GAZE_KEY) || "null");
    if (raw && raw.date === todayKey()) return raw;
  } catch {}
  return { date: todayKey(), focusMs: 0, awayCount: 0 };
}

// 이번 세션 눈맞춤 데이터를 오늘 집계에 더해 저장 + 화면 반영
function saveGazeToday() {
  if (sessionGazeFocusMs <= 0 && sessionGazeAwayCount <= 0) return;
  const g = loadGazeToday();
  g.focusMs += sessionGazeFocusMs;
  g.awayCount += sessionGazeAwayCount;
  localStorage.setItem(GAZE_KEY, JSON.stringify(g));
  renderStats();
}

// ---- 세션 ----
function tick() {
  if (!sessionActive) return;
  const now = Date.now();
  if (present && lastTick != null) {
    // 몰입 중: 몰입 시간 누적 + 몰입 타이머 표시
    const delta = now - lastTick;
    lastTick = now;
    focusMs += delta;
    stats.focusMs += delta;
    el("statusTimer").textContent = fmtClock(focusMs);
    updateSessionProgress();
    renderStats();
    saveLocal();
  } else if (!present && awaySince != null) {
    // 딴짓 중: 타이머를 딴짓 경과 시간으로 전환해 "얼마나 놀고 있는지" 보여줌
    el("statusTimer").textContent = fmtClock(now - awaySince);
  }
  updatePip();
}

let tickAccum = 0;
function startSession() {
  sessionActive = true;
  present = !document.hidden;
  lastTick = Date.now();
  focusMs = 0;
  tickAccum = 0;
  awaySince = null;
  sessionDistractMs = 0;
  sessionDistractCount = 0;
  lastMilestone = 0;
  sessionGazeFocusMs = 0;
  sessionGazeAwayCount = 0;
  camLastFrameTs = 0;
  gazeAwaySince = null;
  camNudged = false;
  applyMascotGrowth(0, false);

  el("heroCard").classList.add("is-focus");
  el("heroCard").classList.remove("is-distract");
  el("heroRing").classList.add("is-active");
  el("heroRing").style.setProperty("--p", "0");
  el("sessionFill").style.width = "0%";
  el("sessionProgress").hidden = false;
  el("sessionCap").textContent = `${goalMin()}분 목표까지 ${goalMin()}분 남았어요`;
  el("statusChip").textContent = "몰입 중";
  setHero(t().focus);
  highlightHelper("concierge");

  el("startBtn").disabled = true;
  el("stopBtn").disabled = false;

  showBriefing();

  clearInterval(loopId);
  loopId = setInterval(() => {
    tick();
    // 5초마다 서버에 몰입 시간 동기화
    tickAccum += 1;
    if (tickAccum >= 5 && present) {
      const delta = 5000;
      tickAccum = 0;
      apiPost(API.event, { type: "focus-tick", deltaMs: delta }).then((day) => {
        if (day) {
          online = true;
          setConn();
        }
      });
    }
  }, 1000);

  updatePip();
  sendEvent({ type: "start" });
  if (extConnected) postToExt({ type: "start", goalMin: goalMin() });
}

function stopSession() {
  sessionActive = false;
  present = true;
  clearInterval(loopId);
  clearEscalations();

  const sessionMin = Math.floor(focusMs / 60000);
  // 이번 세션을 예측의 근거 데이터로 기록
  if (focusMs + sessionDistractMs > 0) {
    pushHistory({
      at: Date.now(),
      focusMs,
      distractMs: sessionDistractMs,
      distractCount: sessionDistractCount
    });
  }
  el("heroCard").classList.remove("is-focus", "is-distract");
  el("heroRing").classList.remove("is-active");
  el("heroRing").style.setProperty("--p", "0");
  el("sessionProgress").hidden = true;
  el("heroCard").classList.remove("gaze-away");
  applyMascotGrowth(0, false);
  saveGazeToday();
  gazeAwaySince = null;
  camNudged = false;
  el("statusChip").textContent = "대기 중";
  el("statusTimer").textContent = "00:00"; // 다음 세션을 위해 초기화
  setHero(`이번 세션 ${sessionMin}분 집중하셨어요. 수고 많으셨습니다. 준비되시면 다시 모실게요.`);
  if (sessionMin >= 1) toast(`이번 세션 ${sessionMin}분 완료! 수고하셨어요`);
  // 카메라를 사용한 세션이면 눈맞춤 요약을 알려줌
  if (sessionGazeFocusMs > 0 || sessionGazeAwayCount > 0) {
    const gazeMin = Math.round(sessionGazeFocusMs / 60000);
    toast(`👀 이번 세션 눈맞춤 집중 ${gazeMin}분 · 시선 이탈 ${sessionGazeAwayCount}회`);
  }
  // 목표 달성 시 마스코트가 축하
  if (focusMs >= GOAL_MS) celebrateMascot();
  updatePip();

  el("startBtn").disabled = false;
  el("stopBtn").disabled = true;
  apiPost(API.event, { type: "stop" });
  if (extConnected) postToExt({ type: "stop" });
}

function clearEscalations() {
  escalationTimers.forEach((x) => clearTimeout(x));
  escalationTimers = [];
}

function scheduleEscalation() {
  clearEscalations();
  HELPERS.forEach((h) => {
    if (h.afterSec === 0) return;
    const id = setTimeout(() => {
      if (!present && sessionActive) {
        highlightHelper(h.id);
        setHero(t().helpers[h.id]);
        notify(h.name, t().helpers[h.id]);
      }
    }, h.afterSec * 1000);
    escalationTimers.push(id);
  });
  highlightHelper("concierge");
  setHero(t().helpers.concierge);
}

function onLeave() {
  if (!sessionActive || !present) return;
  present = false;
  awaySince = Date.now();
  el("heroCard").classList.remove("is-focus");
  el("heroCard").classList.add("is-distract");
  el("statusChip").textContent = "자리 비움";
  el("statusTimer").textContent = "00:00"; // 자리 비움 경과 시간 카운트 시작
  scheduleEscalation();
  updatePip();
  // 딴짓으로 셀지는 복귀 시 분류로 결정 (다른 탭이 업무일 수도 있으므로)
}

// 배열에서 무작위 항목 선택 (집사 멘트에 변주를 주기 위함)
function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 떠나 있던 시간에 맞춘 복귀 멘트 (흐름 연속성 + 캐릭터 변주)
const RETURN_LINES = [
  (dur) => `주인님, ${dur} 자리를 비우셨어요. 돌아와 주셔서 감사해요.`,
  (dur) => `${dur} 다녀오셨네요, 주인님. 다시 집중 자리로 모시겠습니다.`,
  (dur) => `주인님, ${dur} 만에 돌아오셨군요. 흐름 이어가 보실까요?`,
  (dur) => `어서 오세요, 주인님. ${dur} 비우신 만큼만 살짝 기록해 둘게요.`
];
function welcomeMessageFor(awayMs) {
  const min = Math.floor(awayMs / 60000);
  const sec = Math.round(awayMs / 1000);
  const dur = min >= 1 ? `${min}분` : `${sec}초`;
  return randItem(RETURN_LINES)(dur);
}

function onReturn() {
  if (!sessionActive || present) return;
  present = true;
  lastTick = Date.now();
  const awayMs = awaySince ? Date.now() - awaySince : 0;
  awaySince = null;
  clearEscalations();

  // 복귀 UI 복원
  el("heroCard").classList.add("is-focus");
  el("heroCard").classList.remove("is-distract");
  el("statusChip").textContent = "몰입 중";
  el("statusTimer").textContent = fmtClock(focusMs); // 몰입 타이머로 복귀
  highlightHelper("concierge");

  // 짧은 전환(10초 미만)은 참고 탭 확인으로 보고 이탈 집계에서 제외
  if (awayMs < GRACE_MS) {
    setHero(t().focus);
    toast("잠깐 다녀오셨네요 · 이탈로 안 셀게요");
    updatePip();
    return;
  }

  // 객관적 자동 집계: 자기 신고("업무였어요/딴짓했어요")는 부정확하므로 제거하고,
  // 측정 가능한 '집중 세션 중 자리를 비운 시간'만 그대로 이탈로 기록한다.
  sessionDistractMs += awayMs;
  sessionDistractCount += 1;
  sendEvent({ type: "leave" });
  sendEvent({ type: "return", awayMs });
  setHero(welcomeMessageFor(awayMs));
  const mins = Math.floor(awayMs / 60000);
  const dur = mins >= 1 ? `${mins}분` : `${Math.round(awayMs / 1000)}초`;
  toast(`자리 비움 ${dur} · 이탈로 자동 기록했어요`);
  updatePip();
}

// ---- 알림 ----
function notify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") new Notification(title, { body });
}

// ---- 다른 탭 위에 떠 있는 마스코트 (Document Picture-in-Picture) ----
let pipWindow = null;
const PIP_CSS = `
  * { margin: 0; box-sizing: border-box; font-family: -apple-system, "Pretendard", system-ui, sans-serif; }
  body { background: #f2f4f6; color: #191f28; height: 100vh; display: flex; flex-direction: column;
         align-items: center; justify-content: center; gap: 6px; padding: 10px; text-align: center; transition: background .3s; }
  body.away { background: #fff1e6; }
  body.gaze { background: #fff1e6; }
  .pip-status { font-size: 12px; font-weight: 800; color: #6b7684; background: #fff; padding: 4px 12px; border-radius: 999px; }
  body.focus .pip-status { color: #3182f6; }
  body.away .pip-status { color: #ff8a3d; }
  body.gaze .pip-status { color: #ff8a3d; }
  .pip-mascot { width: 92px; height: 92px; }
  .pip-mascot svg { width: 100%; height: 100%; }
  body.away .pip-mascot { animation: pipWiggle .9s ease-in-out infinite; }
  body.gaze .pip-mascot { animation: pipWiggle .9s ease-in-out infinite; }
  @keyframes pipWiggle { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-7deg)} 75%{transform:rotate(7deg)} }
  .pip-timer { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .pip-msg { font-size: 12px; font-weight: 600; color: #4e5968; line-height: 1.35; }
`;

async function togglePip() {
  if (!("documentPictureInPicture" in window)) {
    toast("이 브라우저는 '다른 탭 위 표시'를 지원하지 않아요 (크롬/엣지 권장)");
    return;
  }
  if (pipWindow) {
    pipWindow.close();
    return;
  }
  try {
    pipWindow = await documentPictureInPicture.requestWindow({ width: 200, height: 230 });
  } catch (_) {
    return; // 사용자가 취소
  }
  const d = pipWindow.document;
  const style = d.createElement("style");
  style.textContent = PIP_CSS;
  d.head.appendChild(style);
  const svg = el("mascot").querySelector(".mascot-svg").outerHTML;
  d.body.innerHTML = `
    <div class="pip-status" id="ps">대기 중</div>
    <div class="pip-mascot" id="pm">${svg}</div>
    <div class="pip-timer" id="pt">00:00</div>
    <div class="pip-msg" id="pmsg">준비되면 시작해요</div>`;
  el("pipBtn").classList.add("is-on");
  el("pipBtn").querySelector("span").textContent = "다른 탭 표시 끄기";
  pipWindow.addEventListener("pagehide", () => {
    pipWindow = null;
    const b = el("pipBtn");
    b.classList.remove("is-on");
    b.querySelector("span").textContent = "다른 탭에서도 띄우기";
  });
  updatePip();
}

// PiP 창 상태 동기화 (몰입/자리 비움/대기)
function updatePip() {
  if (!pipWindow || pipWindow.closed) return;
  const d = pipWindow.document;
  const ps = d.getElementById("ps");
  const pt = d.getElementById("pt");
  const pmsg = d.getElementById("pmsg");
  if (!ps) return;
  d.body.classList.remove("focus", "away", "gaze");
  if (!sessionActive) {
    ps.textContent = "대기 중";
    pt.textContent = "00:00";
    pmsg.textContent = "준비되면 시작해요";
  } else if (present) {
    // 카메라가 켜져 있고 시선이 화면을 벗어난 상태면 PiP에도 경고 표시
    if (cameraOn && camPipKind === "warn") {
      d.body.classList.add("gaze");
      ps.textContent = "시선 확인";
      pt.textContent = fmtClock(focusMs);
      pmsg.textContent = camPipText || "화면을 보고 계신가요?";
    } else {
      d.body.classList.add("focus");
      ps.textContent = cameraOn && camPipKind === "ok" ? "눈맞춤 좋아요 👀" : "몰입 중";
      pt.textContent = fmtClock(focusMs);
      pmsg.textContent = "잘하고 계세요, 주인님";
    }
  } else {
    d.body.classList.add("away");
    ps.textContent = "자리 비움";
    pt.textContent = awaySince ? fmtClock(Date.now() - awaySince) : "00:00";
    pmsg.textContent = "주인님, 다시 모실까요?";
  }
}

// ---- 카메라 집중 감지 (아이컨택) — 온디바이스, 영상은 서버로 안 보냄 ----
let cameraOn = false;
let faceLandmarker = null;
let camStream = null;
let camLoopId = null;
let camLoading = false;
let gazeAwaySince = null; // 시선 이탈 시작 시각
let camNudged = false; // 이번 이탈에 대해 안내했는지
let camLastTs = 0;
let camPipKind = "idle"; // PiP에 표시할 카메라 시선 상태: idle|ok|warn
let camPipText = ""; // PiP에 표시할 카메라 안내 문구
const GAZE_AWAY_MS = 7000; // 이만큼 시선 이탈하면 마스코트가 넛지

const MP_VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";
const MP_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MP_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

async function loadFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;
  const vision = await import(MP_VISION);
  const fileset = await vision.FilesetResolver.forVisionTasks(MP_WASM);
  faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MP_MODEL, delegate: "GPU" },
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });
  return faceLandmarker;
}

async function toggleCamera() {
  if (cameraOn) {
    stopCamera();
    return;
  }
  await startCamera();
}

async function startCamera() {
  if (camLoading) return;
  camLoading = true;
  setCamState("loading", "카메라 준비 중…");
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: "user" },
      audio: false
    });
  } catch (_) {
    camLoading = false;
    toast("카메라 권한이 필요해요. 브라우저에서 허용해 주세요.");
    setCamState("off", "");
    return;
  }
  const video = el("camVideo");
  el("camPreview").hidden = false;
  video.srcObject = camStream;
  await video.play().catch(() => {});
  try {
    await loadFaceLandmarker();
  } catch (_) {
    camLoading = false;
    stopTracks();
    el("camPreview").hidden = true;
    toast("집중 감지 모델을 불러오지 못했어요 (네트워크 확인).");
    setCamState("off", "");
    return;
  }
  cameraOn = true;
  camLoading = false;
  gazeAwaySince = null;
  camNudged = false;
  el("camBtn").classList.add("is-on");
  const span = el("camBtn").querySelector("span");
  if (span) span.textContent = "카메라 끄기";
  setCamState("idle", "눈맞춤 확인 중…");
  camLoop();
}

function stopTracks() {
  if (camStream) {
    camStream.getTracks().forEach((t) => t.stop());
    camStream = null;
  }
  const v = el("camVideo");
  if (v) v.srcObject = null;
}

function stopCamera() {
  cameraOn = false;
  if (camLoopId) {
    cancelAnimationFrame(camLoopId);
    camLoopId = null;
  }
  stopTracks();
  el("camPreview").hidden = true;
  el("camBtn").classList.remove("is-on");
  const span = el("camBtn").querySelector("span");
  if (span) span.textContent = "카메라로 집중 감지";
  el("heroCard").classList.remove("gaze-away");
  gazeAwaySince = null;
  camNudged = false;
  camPipKind = "idle";
  camPipText = "";
  updatePip(); // PiP를 정상 상태로 복구
}

function camLoop() {
  if (!cameraOn) return;
  camLoopId = requestAnimationFrame(camLoop);
  const video = el("camVideo");
  if (!video || video.readyState < 2 || !faceLandmarker) return;
  const ts = performance.now();
  if (ts - camLastTs < 120) return; // ~8fps로 제한 (CPU 절약)
  camLastTs = ts;
  let res;
  try {
    res = faceLandmarker.detectForVideo(video, ts);
  } catch (_) {
    return;
  }
  const faceFound = !!(res && res.faceLandmarks && res.faceLandmarks.length > 0);
  const looking = faceFound ? isLookingAtScreen(res) : false;
  handleAttention(faceFound, looking);
}

// 머리 방향 + 눈동자 시선으로 "화면 응시 중"인지 추정 (휴리스틱)
function isLookingAtScreen(res) {
  const mtx = res.facialTransformationMatrixes && res.facialTransformationMatrixes[0];
  if (mtx && mtx.data) {
    const m = mtx.data; // column-major 4x4
    const yaw = (Math.atan2(-m[8], Math.hypot(m[9], m[10])) * 180) / Math.PI;
    const pitch = (Math.atan2(m[9], m[10]) * 180) / Math.PI;
    if (Math.abs(yaw) > 25 || Math.abs(pitch) > 25) return false;
  }
  const bs = res.faceBlendshapes && res.faceBlendshapes[0];
  if (bs && bs.categories) {
    const g = (n) => {
      const c = bs.categories.find((x) => x.categoryName === n);
      return c ? c.score : 0;
    };
    const horiz = Math.max(g("eyeLookOutLeft"), g("eyeLookInLeft"), g("eyeLookOutRight"), g("eyeLookInRight"));
    const vert = Math.max(g("eyeLookUpLeft"), g("eyeLookDownLeft"), g("eyeLookUpRight"), g("eyeLookDownRight"));
    if (horiz > 0.65 || vert > 0.7) return false;
  }
  return true;
}

function handleAttention(faceFound, looking) {
  // 세션 중 + 작업 탭에 있을 때만 의미 있음 (탭을 떠난 상태는 기존 로직이 처리)
  if (!sessionActive || !present) {
    setCamState("idle", cameraOn ? "대기 중" : "");
    camPipKind = "idle";
    camPipText = "";
    camLastFrameTs = 0;
    updatePip();
    return;
  }
  const focused = faceFound && looking;
  const nowTs = Date.now();
  // 화면을 응시하는 동안의 시간을 누적(오늘의 집중·코치에 반영)
  if (focused && camLastFrameTs) {
    const dt = nowTs - camLastFrameTs;
    if (dt > 0 && dt < 2000) sessionGazeFocusMs += dt;
  }
  camLastFrameTs = nowTs;
  if (focused) {
    if (gazeAwaySince) {
      gazeAwaySince = null;
      camNudged = false;
      el("heroCard").classList.remove("gaze-away");
      setHero(t().focus);
    }
    setCamState("ok", "눈맞춤 좋아요 👀");
    camPipKind = "ok";
    camPipText = "눈맞춤 좋아요 👀";
    updatePip();
    return;
  }
  // 시선 이탈 또는 얼굴 사라짐
  if (!gazeAwaySince) gazeAwaySince = Date.now();
  const awayFor = Date.now() - gazeAwaySince;
  const warnText = faceFound ? "화면을 보고 계신가요?" : "주인님이 안 보여요";
  setCamState("warn", warnText);
  camPipKind = "warn";
  camPipText = warnText;
  updatePip(); // 다른 탭 표시(PiP)에도 즉시 반영
  if (awayFor >= GAZE_AWAY_MS && !camNudged) {
    camNudged = true;
    sessionGazeAwayCount += 1; // 시선 이탈 횟수 기록
    el("heroCard").classList.add("gaze-away");
    const msg = faceFound
      ? "주인님, 화면에서 눈이 떠나셨어요. 다시 집중을 모실까요?"
      : "주인님, 자리에 안 계신가요? 돌아오시면 이어서 모실게요.";
    setHero(msg);
    toast("👀 시선이 화면을 벗어났어요");
    notify("탭talk 집사", msg);
  }
}

function setCamState(kind, text) {
  const dot = el("camDot");
  const st = el("camState");
  if (!dot || !st) return;
  dot.className = "cam-dot " + kind;
  st.textContent = text || "";
}

// ---- 내 집중 구조 공유 (PNG 카드) ----
// 오늘 요약을 캔버스에 그려 PNG로 저장 + 클립보드 복사 (외부 라이브러리 없이)
async function shareSummaryCard() {
  const total = stats.focusMs + stats.distractMs;
  if (total === 0) {
    toast("아직 공유할 기록이 없어요. 먼저 집중해 볼까요?");
    return;
  }
  const ratio = stats.focusMs / total;
  const brain = (BRAIN_STATES.find((x) => ratio >= x.min) || BRAIN_STATES[BRAIN_STATES.length - 1]).label;
  const title = (TITLES.find((x) => ratio >= x.min) || TITLES[TITLES.length - 1]).label;
  const focusPct = Math.round(ratio * 100);
  const focusMin = Math.round(stats.focusMs / 60000);
  const distractMin = Math.round(stats.distractMs / 60000);

  const W = 800;
  const H = 1000;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const font = "Pretendard, -apple-system, system-ui, sans-serif";

  // 배경
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#e8f3ff");
  bg.addColorStop(1, "#ffffff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 카드
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#e5e8eb";
  ctx.lineWidth = 2;
  roundRect(ctx, 56, 96, W - 112, H - 200, 36);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";

  // 헤더
  ctx.fillStyle = "#6b7684";
  ctx.font = `600 30px ${font}`;
  ctx.fillText("오늘 내 집중 구조", W / 2, 180);

  // 뇌 상태 (대표 라벨)
  ctx.fillStyle = "#191f28";
  ctx.font = `800 64px ${font}`;
  ctx.fillText(brain, W / 2, 270);

  // 칭호
  ctx.fillStyle = "#3182f6";
  ctx.font = `700 34px ${font}`;
  ctx.fillText(`“${title}”`, W / 2, 330);

  // 몰입 비율 도넛 게이지
  const cx = W / 2;
  const cy = 500;
  const r = 110;
  ctx.lineWidth = 26;
  ctx.strokeStyle = "#e5e8eb";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#3182f6";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
  ctx.stroke();
  ctx.fillStyle = "#191f28";
  ctx.font = `800 70px ${font}`;
  ctx.fillText(`${Math.round(ratio * 100)}%`, cx, cy + 8);
  ctx.fillStyle = "#8b95a1";
  ctx.font = `600 24px ${font}`;
  ctx.fillText("몰입 비율", cx, cy + 48);

  // 통계 3종
  const items = [
    ["몰입", `${focusMin}분`, "#191f28"],
    ["딴짓", `${distractMin}분`, "#ff8a3d"],
    ["집중률", `${focusPct}%`, "#3182f6"]
  ];
  const colW = (W - 160) / 3;
  items.forEach((it, i) => {
    const x = 80 + colW * i + colW / 2;
    ctx.fillStyle = it[2];
    ctx.font = `800 46px ${font}`;
    ctx.fillText(it[1], x, 720);
    ctx.fillStyle = "#8b95a1";
    ctx.font = `600 24px ${font}`;
    ctx.fillText(it[0], x, 760);
  });

  // 푸터 워터마크
  ctx.fillStyle = "#3182f6";
  ctx.font = `800 36px ${font}`;
  ctx.fillText("탭talk", W / 2, 868);
  ctx.fillStyle = "#8b95a1";
  ctx.font = `600 22px ${font}`;
  ctx.fillText("집중 집사가 지켜본 오늘", W / 2, 900);

  c.toBlob(async (blob) => {
    if (!blob) {
      toast("이미지를 만들지 못했어요.");
      return;
    }
    // 다운로드
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `탭talk-집중구조-${todayKey()}.png`;
    a.click();
    URL.revokeObjectURL(url);
    // 클립보드 복사 (지원 브라우저)
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast("내 집중 구조를 저장하고 클립보드에 복사했어요 📸");
    } catch (_) {
      toast("내 집중 구조 카드를 저장했어요 📸");
    }
  }, "image/png");
}

// 캔버스 둥근 사각형 헬퍼
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- AI 코치 ----
async function loadCoaching() {
  const body = el("coachBody");
  body.classList.add("is-loading");
  el("coachHeadline").textContent = "오늘의 집중을 분석하고 있어요...";
  el("coachAdvice").textContent = "";
  const data = await apiGet(API.coach);
  body.classList.remove("is-loading");
  if (!data) {
    el("coachHeadline").textContent = "서버에 연결되어야 코칭을 받을 수 있어요.";
    return;
  }
  online = true;
  setConn();
  el("coachHeadline").textContent = data.headline || "";
  let advice = data.advice || "";
  // 카메라 눈맞춤 데이터를 코칭에 반영
  const gaze = loadGazeToday();
  if (gaze.focusMs > 0 || gaze.awayCount > 0) {
    const gazeMin = Math.round(gaze.focusMs / 60000);
    advice += advice ? "\n\n" : "";
    advice +=
      gaze.awayCount >= 5
        ? `👀 카메라 기준 오늘 눈맞춤 집중은 ${gazeMin}분이지만 시선 이탈이 ${gaze.awayCount}회로 잦았어요. 화면 응시를 조금만 더 유지해 보실까요?`
        : `👀 카메라 기준 오늘 눈맞춤 집중은 ${gazeMin}분, 시선 이탈은 ${gaze.awayCount}회로 안정적이에요. 좋은 집중 자세예요.`;
  }
  el("coachAdvice").textContent = advice;
}

// ---- 확장(센서) 브리지 연동 ----
// 확장이 있으면 '활성 탭 도메인'으로 업무/딴짓을 판별해 present를 구동한다.
// 확장이 없으면 아래 Page Visibility 폴백이 그대로 동작한다.
let extConnected = false;
let extPresent = true;
let extClassification = null;
let lastTabOverview = null;
const CAT_ICON = { work: "💼", video: "🎬", shopping: "🛍️", sns: "📸", community: "🔄", game: "🎮", news_portal: "📰", webtoon: "📖", neutral: "🌐", etc: "🌐" };

function setExtBadge() {
  const b = el("extBadge");
  if (!b) return;
  b.dataset.on = extConnected ? "true" : "false";
  b.textContent = extConnected ? "확장 연결됨" : "확장 미연결";
}

function postToExt(payload) {
  window.postMessage({ source: "tabtalk-page", type: payload.type, payload }, window.location.origin);
}

// 확장이 보낸 분류/통계를 반영
function applyExtState(payload) {
  if (payload.classification) {
    extClassification = payload.classification;
    // '업무중'은 업무로 등록된 사이트에서만 인정한다. (중립/딴짓은 업무중 아님)
    extPresent = !!payload.classification.focused && payload.classification.kind === "work";
    if (sessionActive) {
      if (extPresent && !present) onReturn();
      else if (!extPresent && present) onLeave();
    }
  }
  if (payload.domainStats) renderDomainCard(payload.domainStats);
  if (payload.tabOverview) renderTabHealthCard(payload.tabOverview);
}

// 오늘 사이트별 시간 카드 (확장 데이터 기반)
function renderDomainCard(d) {
  const card = el("domainCard");
  if (!card) return;
  card.hidden = false;
  const hosts = (d && d.hosts) || {};
  const rows = Object.entries(hosts)
    .map(([host, r]) => ({ host, ms: r.ms || 0, category: r.category || "etc" }))
    .filter((r) => r.ms >= 1000)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 6);
  const total = Object.values(hosts).reduce((s, r) => s + (r.ms || 0), 0);
  el("domainTotal").textContent = `${Math.round(total / 60000)}분`;
  el("domainEmpty").hidden = rows.length > 0;
  const ul = el("domainList");
  ul.innerHTML = "";
  const max = rows.length ? rows[0].ms : 1;
  rows.forEach((r) => {
    const li = document.createElement("li");
    li.className = "domain-item";
    const min = Math.max(1, Math.round(r.ms / 60000));
    li.innerHTML =
      `<span class="domain-ico">${CAT_ICON[r.category] || "🌐"}</span>` +
      `<div class="domain-main"><span class="domain-host">${r.host}</span>` +
      `<div class="domain-track"><div class="domain-fill" style="width:${Math.round((r.ms / max) * 100)}%"></div></div></div>` +
      `<span class="domain-min">${min}분</span>`;
    ul.appendChild(li);
  });
}

function fmtGB(bytes) {
  return (bytes / 1073741824).toFixed(1);
}

function siteName(domain) {
  const host = String(domain || "").toLowerCase().replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length === 0) return "tab";
  if (parts.length >= 3 && ["co", "com", "net", "or"].includes(parts[parts.length - 2])) return parts[parts.length - 3];
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

function guidanceTabs(tabs) {
  return [...tabs]
    .filter((it) => !it.active && (it.discarded || it.heavy || (it.level || 0) >= 2))
    .sort((a, b) => Number(!!b.heavy) - Number(!!a.heavy) || (b.level || 0) - (a.level || 0))
    .slice(0, 3);
}

function tabGuidanceCopy(candidates, liveTabs) {
  const names = candidates.map((it) => siteName(it.domain));
  const first = names[0];
  if (!first) {
    if (tone === "secretary") return `열린 탭 ${liveTabs}개는 아직 괜찮아 보여요. 집중할 때는 새 탭만 조금 조심해봐요.`;
    if (tone === "coach") return `열린 탭 ${liveTabs}개. 현재 장기 미사용 후보는 뚜렷하지 않습니다. 목표와 관련된 탭만 유지하세요.`;
    if (tone === "manager") return `열린 탭 ${liveTabs}개! 지금은 괜찮아요. 집중할 때 새 탭만 막아봅시다!`;
    return `열린 탭 ${liveTabs}개입니다. 지금은 집중 흐름을 크게 방해하는 후보가 보이지 않습니다.`;
  }
  const rest = names.length > 1 ? ` 외 ${names.length - 1}개` : "";
  if (tone === "secretary") return `${first}${rest} 탭이 오래 쉬고 있어요. 지금 할 일과 상관없다면 잠시 의식만 해두셔도 좋아요.`;
  if (tone === "coach") return `${first}${rest} 탭이 장시간 사용되지 않았습니다. 현재 세션과 관련 없는지 확인하세요.`;
  if (tone === "manager") return `${first}${rest} 오래 켜져 있어요! 지금 집중할 거면 시야 밖으로 치워두고 갑시다!`;
  return `${first}${rest} 탭이 오래 머물러 있습니다. 주인님의 집중 흐름을 위해 잠시 정돈 후보로 기억해 두겠습니다.`;
}

function stableIndex(seed, length) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % length;
}

function tabButlerLine(tab) {
  const name = siteName(tab.domain);
  const old = tab.discarded || tab.heavy || (tab.level || 0) >= 2;
  const seed = `${tab.tabId || ""}:${tab.domain || ""}:${tab.openLabel || ""}:${tone}`;
  const copies = {
    concierge: old
      ? [
        `주인님, ${name} 탭을 잊으신 건가요? 컴퓨터 메모리를 위해 잠시 쉬게 해두셔도 좋겠습니다.`,
        `${name} 탭이 오래 기다리고 있습니다. 집중 모드를 위해 지금 필요한 탭인지 살펴보겠습니다.`,
        `주인님, ${name} 탭이 조용히 남아 있습니다. 쓰지 않으신다면 메모리 여유를 위해 잠시 내려두셔도 좋습니다.`
      ]
      : [
        `${name} 탭은 아직 가볍게 지켜보겠습니다.`,
        `${name} 탭은 현재 집중 흐름 안에서 대기 중입니다.`
      ],
    secretary: old
      ? [
        `${name} 탭, 혹시 잊고 계셨나요? 지금 안 쓰면 컴퓨터가 편해지도록 잠깐 쉬게 해도 좋아요.`,
        `${name}가 오래 열려 있어요. 집중 중이라면 나중에 다시 봐도 괜찮아요.`,
        `${name} 탭이 기다리는 중이에요. 지금 할 일과 다르면 살짝 덮어둘까요?`
      ]
      : [
        `${name} 탭은 아직 괜찮아 보여요.`,
        `${name} 탭은 조용히 보고 있을게요.`
      ],
    coach: old
      ? [
        `${name} 탭 장기 유지 중. 현재 목표와 무관하다면 메모리 관리를 위해 잠시 종료를 권장합니다.`,
        `${name} 탭이 오래 사용되지 않았습니다. 집중 세션 관련성을 확인하세요.`,
        `${name} 탭은 주의 분산 후보입니다. 지금 필요한 탭인지 판단하세요.`
      ]
      : [
        `${name} 탭은 현재 부담 낮음.`,
        `${name} 탭은 관찰 중입니다.`
      ],
    manager: old
      ? [
        `${name} 탭, 저를 잊으신 건가요? 지금 안 쓰면 메모리 위해 잠깐 꺼두고 갑시다!`,
        `${name} 오래 켜져 있어요! 집중 모드라면 시야 밖으로 치워봅시다!`,
        `${name} 탭이 버티는 중! 지금 목표랑 다르면 과감히 쉬게 합시다!`
      ]
      : [
        `${name} 탭은 아직 괜찮아요!`,
        `${name} 탭은 대기, 집중은 계속 갑시다!`
      ]
  };
  const picked = copies[tone] || copies.concierge;
  return picked[stableIndex(seed, picked.length)];
}

function renderTabHealthCard(ov) {
  const card = el("tabHealthCard");
  if (!card) return;
  lastTabOverview = ov;
  card.hidden = false;
  const tabs = (ov && ov.tabs) || [];
  const load = (ov && ov.load) || { level: "light", pct: 0, title: "쾌적해요", message: "확장에서 탭 사용량을 확인하고 있어요.", source: "tabs" };
  const liveTabs = tabs.filter((it) => !it.discarded).length;
  const heavyTabs = tabs.filter((it) => it.heavy).length;
  const candidates = guidanceTabs(tabs);

  el("webTabCount").textContent = `${(ov && ov.total) || tabs.length}개`;
  el("webLiveTabCount").textContent = String(liveTabs);
  el("webSleepingTabCount").textContent = String((ov && ov.discarded) || 0);
  el("webHeavyTabCount").textContent = String(heavyTabs);
  el("webMemBox").dataset.level = load.level || "light";
  const summary = tabHealthSummary(load, liveTabs, candidates);
  el("webMemStatusTitle").textContent = summary.title;
  el("webMemStatusMsg").textContent = summary.message;
  el("webMemFill").style.width = `${load.pct || 0}%`;
  el("webMemLabel").textContent = load.source === "memory" ? "메모리" : "부담";
  el("webMemVal").textContent = `${load.pct || 0}%`;

  el("webMemCaption").textContent = tabHealthCaption(ov, load);
  const guide = el("webTabGuide");
  guide.hidden = tabs.length === 0;
  el("webTabGuideCopy").textContent = tabGuidanceCopy(candidates, liveTabs);
  const guideSites = el("webTabGuideSites");
  guideSites.innerHTML = "";
  (candidates.length ? candidates : tabs.filter((it) => !it.active).slice(0, 3)).forEach((it) => {
    const chip = document.createElement("span");
    chip.textContent = siteName(it.domain);
    guideSites.appendChild(chip);
  });

  const visibleTabs = tabs;
  el("webSleepEmpty").hidden = tabs.length > 0;
  el("webTabDetail").hidden = tabs.length === 0;
  const ul = el("webSleepList");
  ul.innerHTML = "";
  visibleTabs.forEach((it) => {
    const li = document.createElement("li");
    li.className = `sleep-item lv${it.level || 0}${it.active ? " is-live" : ""}${it.discarded ? " is-sleep" : ""}${it.heavy ? " is-heavy" : ""}`;
    const fav = it.favIconUrl
      ? `<img class="sleep-fav" src="${it.favIconUrl}" alt="" />`
      : `<span class="sleep-fav ph"><i data-lucide="panel-top"></i></span>`;
    const status = it.active ? "보는 중" : it.discarded ? "잠듦" : it.heavy ? "오래 켜둠" : "";
    const name = siteName(it.domain);
    const line = tabButlerLine(it);
    li.innerHTML =
      fav +
      `<div class="sleep-main"><p class="sleep-msg" title="${line}">${line}</p>` +
      `<span class="sleep-meta">${it.domain} · ${it.openLabel}${it.active ? "" : ` · ${it.idleLabel}`}${status ? ` · ${status}` : ""}</span></div>` +
      `<div class="sleep-actions"><button class="sleep-open" title="이 탭 열기">열기</button>` +
      `${it.active ? "" : `<button class="sleep-close" title="이 탭 닫기">닫기</button>`}</div>`;
    li.querySelector(".sleep-open").onclick = () => postToExt({ type: "idle:focus", tabId: it.tabId });
    const closeBtn = li.querySelector(".sleep-close");
    if (closeBtn) closeBtn.onclick = () => postToExt({ type: "idle:close", tabId: it.tabId });
    ul.appendChild(li);
  });
  if (window.lucide) window.lucide.createIcons();
}

function tabHealthCaption(ov, load) {
  const current = ov && ov.current;
  if (load.source === "memory" && ov.memory && ov.memory.capacity) {
    const used = fmtGB(ov.memory.capacity - ov.memory.available);
    const total = fmtGB(ov.memory.capacity);
    if (tone === "secretary") return `시스템 메모리 ${used}/${total}GB 사용 중이에요. 지금은 집중에 필요한 탭만 남기는 느낌으로 살펴봐요.`;
    if (tone === "coach") return `시스템 메모리 ${used}/${total}GB 사용 중. 세션과 무관한 장기 탭만 후보로 확인하세요.`;
    if (tone === "manager") return `메모리 ${used}/${total}GB 사용 중! 지금 집중할 탭만 딱 보고 갑시다!`;
    return `시스템 메모리 ${used}/${total}GB 사용 중입니다. 집중에 덜 필요한 탭만 조용히 후보로 보겠습니다.`;
  }
  if (!current) {
    if (tone === "secretary") return "열린 탭을 살펴보고 있어요. 오래 안 본 탭이 있으면 조용히 알려드릴게요.";
    if (tone === "coach") return "열린 탭 상태를 점검 중입니다. 장기 미사용 후보만 안내합니다.";
    if (tone === "manager") return "열린 탭 점검 중! 집중 방해 후보만 빠르게 잡아볼게요!";
    return "열린 탭 상태를 확인하고 있습니다. 집중 흐름에 방해될 후보만 살펴보겠습니다.";
  }
  if (current.heavy) {
    if (tone === "secretary") return `지금 보는 ${current.domain} 탭이 ${current.openLabel} 열려 있어요. 세션에 필요한 탭인지 살짝만 확인해봐요.`;
    if (tone === "coach") return `현재 ${current.domain} 탭이 ${current.openLabel} 유지 중입니다. 세션 관련성을 확인하세요.`;
    if (tone === "manager") return `${current.domain} 탭이 ${current.openLabel} 열려 있어요! 지금 목표랑 맞는지만 빠르게 봅시다!`;
    return `지금 보시는 ${current.domain} 탭이 ${current.openLabel} 열려 있습니다. 집중 목표와 맞는지만 확인하겠습니다.`;
  }
  if (tone === "secretary") return `지금 보는 ${current.domain} 탭은 ${current.openLabel}. 아직 가벼워요.`;
  if (tone === "coach") return `현재 ${current.domain} 탭은 ${current.openLabel}. 부담은 낮은 상태입니다.`;
  if (tone === "manager") return `${current.domain} 탭은 ${current.openLabel}! 아직 괜찮아요.`;
  return `지금 보시는 ${current.domain} 탭은 ${current.openLabel}. 아직 가볍습니다.`;
}

function tabHealthSummary(load, liveTabs, candidates) {
  const level = load.level || "light";
  const candidateCount = candidates.length;
  const note = candidateCount > 0 ? ` 집중 방해 후보 ${candidateCount}개를 골라뒀습니다.` : "";
  const copy = {
    concierge: {
      light: ["집중 흐름이 가볍습니다", `열린 탭 ${liveTabs}개입니다. 지금은 크게 방해되는 후보가 적습니다.${note}`],
      medium: ["후보를 살펴두었습니다", `열린 탭 ${liveTabs}개 중 오래 머문 탭을 조용히 골라두었습니다.${note}`],
      heavy: ["집중 후보 확인이 필요합니다", `탭 ${liveTabs}개가 열려 있습니다. 세션과 먼 탭만 차분히 안내하겠습니다.${note}`]
    },
    secretary: {
      light: ["아직 괜찮아요", `열린 탭 ${liveTabs}개예요. 집중을 방해할 만한 탭은 크지 않아 보여요.${note}`],
      medium: ["살짝 신경 쓸 후보가 있어요", `오래 쉬고 있는 탭이 보여요. 지금 할 일과 상관있는지만 가볍게 봐요.${note}`],
      heavy: ["집중이 흐트러질 수 있어요", `탭 ${liveTabs}개가 열려 있어요. 오래 안 본 탭만 제가 조용히 알려드릴게요.${note}`]
    },
    coach: {
      light: ["방해 낮음", `열린 탭 ${liveTabs}개. 현재 장기 미사용 후보는 낮습니다.${note}`],
      medium: ["후보 확인", `열린 탭 ${liveTabs}개. 세션과 관련 없는 장기 탭을 확인하세요.${note}`],
      heavy: ["집중 위험 후보", `탭 ${liveTabs}개. 오래 유지된 탭이 주의 분산 요인이 될 수 있습니다.${note}`]
    },
    manager: {
      light: ["집중 준비 좋습니다", `열린 탭 ${liveTabs}개! 지금은 크게 막는 후보가 없어요.${note}`],
      medium: ["후보 잡았습니다", `열린 탭 ${liveTabs}개! 오래 켜둔 탭만 빠르게 체크하고 집중 갑시다.${note}`],
      heavy: ["주의 분산 후보 있음", `탭 ${liveTabs}개! 지금 목표랑 먼 탭이 있으면 시야 밖으로 밀어봅시다.${note}`]
    }
  };
  const picked = (copy[tone] || copy.concierge)[level] || copy.concierge.light;
  return { title: picked[0], message: picked[1] };
}

window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  const m = e.data;
  if (!m || m.source !== "tabtalk-ext") return;
  if (m.type === "hello") {
    extConnected = true;
    setExtBadge();
    postToExt({ type: "ext-sync" });
  } else if (m.type === "state") {
    extConnected = true;
    setExtBadge();
    applyExtState(m.payload || {});
  }
});
// 로드 직후 확장에 현재 상태 요청 (hello를 놓쳤을 경우 대비)
window.postMessage({ source: "tabtalk-page", type: "ext-sync" }, window.location.origin);

// ---- 이벤트 바인딩 ----
document.addEventListener("visibilitychange", () => {
  if (extConnected) return; // 확장이 분류를 구동하면 탭 가시성으로 판단하지 않음
  if (document.hidden) onLeave();
  else onReturn();
});
window.addEventListener("blur", () => {
  if (extConnected) return;
  if (document.hidden) onLeave();
});
window.addEventListener("focus", () => {
  if (extConnected) return;
  if (!document.hidden) onReturn();
});

// ---- 시작 안내 팝업 ----
function openStartSheet() {
  if (sessionActive) return;
  showBriefing(); // 시작 전 예측 브리핑 최신화
  el("startSheet").hidden = false;
  if (window.lucide) window.lucide.createIcons();
}

el("startBtn").addEventListener("click", openStartSheet);
el("confirmStartBtn").addEventListener("click", () => {
  el("startSheet").hidden = true;
  startSession();
});
el("cancelStartBtn").addEventListener("click", () => {
  el("startSheet").hidden = true;
});
el("stopBtn").addEventListener("click", stopSession);
el("coachBtn").addEventListener("click", loadCoaching);
el("shareBtn").addEventListener("click", shareSummaryCard);

el("resetBtn").addEventListener("click", async () => {
  stats = { focusMs: 0, distractMs: 0, distractCount: 0, returnCount: 0 };
  saveLocal();
  renderStats();
  setHero("오늘 기록을 새로 시작합니다. 다시 멋지게 모실게요.");
  const day = await apiPost(API.reset, {});
  if (day) applyServer(day);
});

el("pipBtn").addEventListener("click", togglePip);
el("camBtn").addEventListener("click", toggleCamera);

document.querySelectorAll(".tone-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tone-chip").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    tone = btn.dataset.tone;
    localStorage.setItem(TONE_KEY, tone);
    setMascot(tone);
    paintToneFaces();
    if (lastTabOverview) renderTabHealthCard(lastTabOverview);
    const msg = sessionActive
      ? present
        ? t().focus
        : t().helpers[activeHelperId] || t().helpers.concierge
      : t().idle;
    setHero(msg);
  });
});

document.querySelectorAll(".goal-chip").forEach((btn) => {
  btn.addEventListener("click", () => setGoal(Number(btn.dataset.goal)));
});
async function init() {
  if (window.lucide) window.lucide.createIcons();
  setExtBadge();

  document.querySelectorAll(".tone-chip").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.tone === tone);
  });
  setMascot(tone);
  paintToneFaces();
  setGoal(goalMin()); // 저장된 목표로 칩·미리보기 동기화

  loadLocal();
  renderStats();
  setHero(t().idle);
  renderBriefing(computeForecast(loadHistory()));

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  // 서버 헬스/통계 동기화
  const health = await apiGet(API.health);
  online = !!(health && health.ok);
  setConn();
  if (online) {
    const day = await apiGet(API.stats);
    applyServer(day);
  }
}

init();
