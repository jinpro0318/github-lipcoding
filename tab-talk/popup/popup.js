// 탭talk 팝업 — 백그라운드 서비스워커의 세션/통계 상태를 보여주고 제어한다.
import { TONE, TITLES } from "../background/shared.js";
import { MASCOTS } from "./mascots.js";

const el = (id) => document.getElementById(id);
let state = null;       // 마지막으로 받은 백그라운드 상태
let tone = "concierge";
let goalMin = 25;
let timerId = null;
let lastMilestone = 0;  // 마지막으로 축하한 분(5분 단위 + 목표)

function fmtMin(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}<small>분</small>`;
  return `${Math.floor(m / 60)}<small>시간</small>${m % 60}<small>분</small>`;
}
function fmtClock(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function send(type, extra) {
  return new Promise((res) => {
    chrome.runtime.sendMessage({ type, ...extra }, (r) => res(r));
  });
}

function setMascot(id) {
  const host = el("mascot");
  const tmp = document.createElement("div");
  tmp.innerHTML = MASCOTS[id] || MASCOTS.concierge;
  const next = tmp.querySelector(".mascot-svg");
  const cur = host.querySelector(".mascot-svg");
  if (cur) cur.replaceWith(next);
  else host.appendChild(next);
}

function toast(text) {
  const n = el("toast");
  n.textContent = text;
  n.hidden = false;
  n.classList.add("show");
  setTimeout(() => { n.classList.remove("show"); setTimeout(() => (n.hidden = true), 250); }, 2000);
}

// 5분마다 마스코트가 한 뼘씩 자라는 연출. stage=5분 경과 수, atGoal이면 만개.
function applyMascotGrowth(stage, atGoal) {
  const m = el("mascot");
  if (!m) return;
  const capped = Math.min(Math.max(0, stage), 6); // 30분에서 상한
  m.style.setProperty("--grow", (1 + capped * 0.045).toFixed(3));
  m.dataset.grow = String(capped);
  m.classList.toggle("bloom", !!atGoal);
}

// 목표 달성/마일스톤 시 마스코트 점프 축하
function celebrateMascot() {
  const m = el("mascot");
  if (!m) return;
  m.classList.remove("celebrate");
  void m.offsetWidth; // 리플로우로 애니메이션 재시작
  m.classList.add("celebrate");
  setTimeout(() => m.classList.remove("celebrate"), 1400);
}

// 5분 돌파/목표 달성 시 1회만 축하
function checkMilestone(mins) {
  const marks = [];
  for (let x = 5; x < goalMin; x += 5) marks.push(x);
  marks.push(goalMin);
  for (const x of marks) {
    if (mins >= x && lastMilestone < x) {
      lastMilestone = x;
      const ring = el("heroRing");
      ring.classList.add("pop");
      setTimeout(() => ring.classList.remove("pop"), 600);
      celebrateMascot();
      toast(x >= goalMin ? `🎉 ${goalMin}분 목표 달성! 최고예요, 주인님` : `${x}분 돌파! 탭이가 한 단계 성장했어요 ✨`);
      break;
    }
  }
}

function render() {
  if (!state) return;
  const { session, stats } = state;
  const t = TONE[tone] || TONE.concierge;

  // 오늘 요약
  el("statFocus").innerHTML = fmtMin(stats.focusMs);
  el("statDistract").innerHTML = fmtMin(stats.distractMs);
  const rate = stats.distractCount === 0 ? 100 : Math.round((stats.returnCount / stats.distractCount) * 100);
  el("statReturn").innerHTML = `${rate}<small>%</small>`;
  const total = stats.focusMs + stats.distractMs;
  const ratio = total === 0 ? 1 : stats.focusMs / total;
  el("focusBar").style.width = `${Math.round(ratio * 100)}%`;
  el("titleBadge").textContent = (TITLES.find((x) => ratio >= x.min) || TITLES.at(-1)).label;
  el("focusCaption").textContent = total === 0
    ? "아직 기록이 없어요. 첫 세션을 시작해볼까요?"
    : `오늘 몰입 비율 ${Math.round(ratio * 100)}% · 복귀 ${stats.returnCount}회`;

  // 세션 상태
  el("startBtn").disabled = session.active;
  el("stopBtn").disabled = !session.active;
  el("sessionProgress").hidden = !session.active;
  el("heroCard").classList.toggle("is-focus", session.active && session.present);
  el("heroCard").classList.toggle("is-distract", session.active && !session.present);
  if (!session.active) {
    el("statusChip").textContent = "대기 중";
    el("statusTimer").textContent = "00:00";
    el("heroMessage").textContent = t.idle;
    lastMilestone = 0;
    applyMascotGrowth(0, false);
  } else if (session.present) {
    el("statusChip").textContent = "몰입 중";
    el("statusTimer").textContent = fmtClock(session.focusMs);
    el("heroMessage").textContent = t.focus;
    const mins = Math.floor(session.focusMs / 60000);
    const pct = Math.min(100, (session.focusMs / (goalMin * 60000)) * 100);
    el("sessionFill").style.width = `${pct}%`;
    const remain = Math.max(0, Math.ceil((goalMin * 60000 - session.focusMs) / 60000));
    el("sessionCap").textContent = pct >= 100 ? `${goalMin}분 목표 달성!` : `${goalMin}분 목표까지 ${remain}분`;
    applyMascotGrowth(Math.floor(mins / 5), pct >= 100);
    checkMilestone(mins);
  } else {
    el("statusChip").textContent = "자리 비움";
    el("statusTimer").textContent = fmtClock(Date.now() - session.awaySince);
    el("heroMessage").textContent = t.helpers[session.activeHelper] || t.helpers.concierge;
  }
}

async function refresh() {
  state = await send("ping");
  tone = state?.settings?.tone || tone;
  document.querySelectorAll(".tone-chip").forEach((b) => b.classList.toggle("is-active", b.dataset.tone === tone));
  setMascot(tone);
  paintButlers();
  render();
  renderDomains();
  renderTabs();
}

// 담당 집사 칩에 마스코트 캐릭터를 그려넣는다
function paintButlers() {
  document.querySelectorAll(".butler-face").forEach((s) => {
    if (s.querySelector(".mascot-svg")) return;
    s.innerHTML = MASCOTS[s.dataset.m] || MASCOTS.concierge;
  });
}

const CAT_ICON = { work: "💼", video: "🎬", shopping: "🛍️", sns: "📸", community: "🔄", game: "🎮", news_portal: "📰", webtoon: "📖", neutral: "🌐", etc: "🌐" };

// 오늘 사이트별 체류 시간 카드
function renderDomains() {
  const d = state?.domainStats;
  const hosts = d && d.hosts ? d.hosts : {};
  const rows = Object.entries(hosts)
    .map(([host, r]) => ({ host, ms: r.ms || 0, category: r.category || "etc" }))
    .filter((r) => r.ms >= 1000)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 6);
  const total = Object.values(hosts).reduce((s, r) => s + (r.ms || 0), 0);
  el("domainTotal").innerHTML = fmtMin(total);
  el("domainEmpty").hidden = rows.length > 0;
  const ul = el("domainList");
  ul.innerHTML = "";
  const max = rows.length ? rows[0].ms : 1;
  rows.forEach((r) => {
    const li = document.createElement("li");
    li.className = "domain-item";
    const min = Math.max(1, Math.round(r.ms / 60000));
    li.innerHTML = `
      <span class="domain-ico">${CAT_ICON[r.category] || "🌐"}</span>
      <div class="domain-main">
        <span class="domain-host">${r.host}</span>
        <div class="domain-track"><div class="domain-fill" style="width:${Math.round((r.ms / max) * 100)}%"></div></div>
      </div>
      <span class="domain-min">${min}분</span>`;
    ul.appendChild(li);
  });
}

// 열린 탭 + 컴퓨터 부담 상태
function fmtGB(bytes) {
  return (bytes / 1073741824).toFixed(1);
}
async function renderTabs() {
  const ov = (await send("idle:overview")) || { tabs: [], total: 0, discarded: 0, memory: null, load: null, current: null };
  const tabs = ov.tabs || [];
  el("tabCount").textContent = `${ov.total}개`;

  // 부담 상태 배너 (색상으로 구분)
  const load = ov.load || { level: "light", pct: 0, title: "쾌적해요 🟢", message: "", source: "tabs" };
  el("memBox").dataset.level = load.level;
  el("memStatusTitle").textContent = load.title;
  el("memStatusMsg").textContent = load.message;
  el("memFill").style.width = `${load.pct}%`;

  // 게이지 라벨: 메모리 권한이 있으면 실제 메모리, 없으면 부담 지수
  if (load.source === "memory" && ov.memory && ov.memory.capacity) {
    el("memLabel").textContent = "시스템 메모리";
    el("memVal").textContent = `${load.pct}% · ${fmtGB(ov.memory.capacity - ov.memory.available)}/${fmtGB(ov.memory.capacity)}GB`;
  } else {
    el("memLabel").textContent = "메모리 부담";
    el("memVal").textContent = `${load.pct}%`;
  }

  // 현재 보고 있는 사이트 상태 (색상 강조)
  if (ov.current) {
    const c = ov.current;
    el("memCaption").innerHTML = c.heavy
      ? `지금 보는 <b>${c.domain}</b> 을(를) <b>${c.openLabel.replace("째 열림", "")}째</b> 열어두셨어요. 슬슬 정리하면 가벼워져요.`
      : `지금 보는 <b>${c.domain}</b> 은(는) ${c.openLabel}. 아직 가벼워요.`;
  } else {
    el("memCaption").textContent = "오래 켜둔 탭은 컴퓨터를 느리게 만들 수 있어요.";
  }

  el("sleepEmpty").hidden = tabs.length > 0;
  const ul = el("sleepList");
  ul.innerHTML = "";
  tabs.forEach((it) => {
    const li = document.createElement("li");
    li.className = `sleep-item${it.active ? " is-live" : ""}${it.discarded ? " is-sleep" : ""}${it.heavy ? " is-heavy" : ""}`;
    const fav = it.favIconUrl
      ? `<img class="sleep-fav" src="${it.favIconUrl}" alt="" />`
      : `<span class="sleep-fav ph">🗂️</span>`;
    const badge = it.active ? `<span class="tab-badge live">보는 중</span>`
      : it.discarded ? `<span class="tab-badge sleep">잠듦</span>`
      : it.heavy ? `<span class="tab-badge heavy">오래 켜둠</span>` : "";
    li.innerHTML = `
      ${fav}
      <div class="sleep-main">
        <p class="sleep-msg">${it.title}${badge}</p>
        <span class="sleep-meta">${it.domain} · ${it.openLabel}${it.active ? "" : ` · ${it.idleLabel}`}</span>
      </div>
      <div class="sleep-actions">
        <button class="sleep-open" title="이 탭 열기">열기</button>
        ${it.active ? "" : `<button class="sleep-close" title="이 탭 닫기">닫기</button>`}
      </div>`;
    li.querySelector(".sleep-open").onclick = async () => { await send("idle:focus", { tabId: it.tabId }); renderTabs(); };
    const cl = li.querySelector(".sleep-close");
    if (cl) cl.onclick = async () => { await send("idle:close", { tabId: it.tabId }); renderTabs(); toast("탭을 정리했어요"); };
    ul.appendChild(li);
  });
}

// 코치 (규칙 기반)
function coach() {  const s = state?.stats;
  const total = (s?.focusMs || 0) + (s?.distractMs || 0);
  if (!total) { el("coachHeadline").textContent = "오늘 첫 세션을 시작해보면 코칭을 드릴게요."; return; }
  const ratio = s.focusMs / total;
  el("coachHeadline").textContent = ratio >= 0.7 ? "오늘 집중 흐름이 아주 좋아요." : ratio >= 0.4 ? "집중과 딴짓이 반반이에요." : "오늘은 딴짓 유혹이 강했네요.";
  el("coachAdvice").textContent = ratio >= 0.7
    ? "이 페이스를 유지하면 목표 달성은 시간 문제예요."
    : "딴짓 탭(유튜브·SNS)을 닫고 25분만 집중해보면 비율이 확 올라가요.";
}

// 이벤트
el("startBtn").onclick = async () => { state = await send("start", { goalMin }); render(); };
el("stopBtn").onclick = async () => { state = await send("stop"); render(); toast("세션을 마쳤어요. 수고하셨어요!"); };
el("resetBtn").onclick = async () => { state = await send("reset"); render(); toast("오늘 기록을 초기화했어요"); };
el("optionsBtn").onclick = () => chrome.runtime.openOptionsPage();
el("coachBtn").onclick = coach;
document.querySelectorAll(".goal-chip").forEach((b) => b.onclick = () => {
  goalMin = Number(b.dataset.goal);
  document.querySelectorAll(".goal-chip").forEach((c) => c.classList.toggle("is-active", c === b));
  render();
});
document.querySelectorAll(".tone-chip").forEach((b) => b.onclick = async () => {
  tone = b.dataset.tone;
  state = await send("tone", { tone });
  document.querySelectorAll(".tone-chip").forEach((c) => c.classList.toggle("is-active", c === b));
  setMascot(tone); render();
});

refresh();
timerId = setInterval(render, 1000);
window.addEventListener("unload", () => clearInterval(timerId));
