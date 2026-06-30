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
function elapsedSince(ts) {
  return Number.isFinite(ts) && ts > 0 ? Date.now() - ts : 0;
}

function send(type, extra) {
  return new Promise((res) => {
    try {
      chrome.runtime.sendMessage({ type, ...extra }, (r) => {
        if (chrome.runtime.lastError) {
          console.warn("탭talk 백그라운드 응답 실패:", chrome.runtime.lastError.message);
          res(null);
          return;
        }
        res(r || null);
      });
    } catch (err) {
      console.warn("탭talk 메시지 전송 실패:", err);
      res(null);
    }
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
  const total = stats.focusMs + stats.distractMs;
  const ratio = total === 0 ? 1 : stats.focusMs / total;
  el("statReturn").innerHTML = `${Math.round(ratio * 100)}<small>%</small>`;
  el("focusBar").style.width = `${Math.round(ratio * 100)}%`;
  el("titleBadge").textContent = (TITLES.find((x) => ratio >= x.min) || TITLES[TITLES.length - 1]).label;
  el("focusCaption").textContent = total === 0
    ? "아직 기록이 없어요. 첫 세션을 시작해볼까요?"
    : `오늘 집중 ${Math.round(ratio * 100)}% · 딴짓 ${Math.round((1 - ratio) * 100)}%`;

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
    el("statusTimer").textContent = fmtClock(elapsedSince(session.awaySince));
    el("heroMessage").textContent = t.helpers[session.activeHelper] || t.helpers.concierge;
  }
}

async function refresh() {
  state = await send("ping");
  if (!state) {
    toast("확장 백그라운드를 불러오는 중이에요. 잠시 후 다시 열어주세요.");
    return;
  }
  tone = (state && state.settings && state.settings.tone) || tone;
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
  const d = state && state.domainStats;
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
function guidanceCopy(candidates, liveTabs) {
  const names = candidates.map((it) => siteName(it.domain));
  const first = names[0];
  if (!first) {
    if (tone === "secretary") return `지금 열린 탭 ${liveTabs}개는 아직 괜찮아 보여요. 집중 세션 중엔 새 탭만 조금 조심해봐요.`;
    if (tone === "coach") return `열린 탭 ${liveTabs}개. 현재 오래 방치된 후보는 뚜렷하지 않습니다. 세션 목표에 필요한 탭만 유지하세요.`;
    if (tone === "manager") return `열린 탭 ${liveTabs}개! 지금은 괜찮아요. 집중할 때 새 탭만 막아봅시다!`;
    return `열린 탭 ${liveTabs}개입니다. 지금은 집중 흐름을 크게 방해하는 후보가 보이지 않습니다.`;
  }
  const rest = names.length > 1 ? ` 외 ${names.length - 1}개` : "";
  if (tone === "secretary") return `${first}${rest} 탭이 오래 쉬고 있어요. 지금 집중할 일과 상관없다면 잠시 의식만 해두셔도 좋아요.`;
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
async function renderTabs() {
  const ov = (await send("idle:overview")) || { tabs: [], total: 0, discarded: 0, memory: null, load: null, current: null };
  const tabs = ov.tabs || [];
  const liveTabs = tabs.filter((it) => !it.discarded).length;
  const heavyTabs = tabs.filter((it) => it.heavy).length;
  el("tabCount").textContent = `${ov.total}개`;
  el("liveTabCount").textContent = String(liveTabs);
  el("sleepingTabCount").textContent = String(ov.discarded || 0);
  el("heavyTabCount").textContent = String(heavyTabs);

  const load = ov.load || { level: "light", pct: 0, title: "정돈되어 있습니다", message: "", source: "tabs" };
  const candidates = guidanceTabs(tabs);
  const guide = el("tabGuide");
  guide.hidden = tabs.length === 0;
  el("tabGuideCopy").textContent = guidanceCopy(candidates, liveTabs);
  const guideSites = el("tabGuideSites");
  guideSites.innerHTML = "";
  (candidates.length ? candidates : tabs.filter((it) => !it.active).slice(0, 3)).forEach((it) => {
    const chip = document.createElement("span");
    chip.textContent = siteName(it.domain);
    guideSites.appendChild(chip);
  });
  el("memBox").dataset.level = load.level;
  el("memStatusTitle").textContent = candidates.length ? "집중 후보를 골라뒀어요" : "지금은 가볍게 집중해도 좋아요";
  el("memStatusMsg").textContent = guidanceCopy(candidates, liveTabs);
  el("memFill").style.width = `${load.pct}%`;

  // 게이지 라벨: 메모리 권한이 있으면 실제 메모리, 없으면 부담 지수
  if (load.source === "memory" && ov.memory && ov.memory.capacity) {
    el("memLabel").textContent = "메모리";
    el("memVal").textContent = `${load.pct}%`;
  } else {
    el("memLabel").textContent = "부담";
    el("memVal").textContent = `${load.pct}%`;
  }

  el("memCaption").textContent = popupTabCaption(ov, load);

  const visibleTabs = tabs;
  el("sleepEmpty").hidden = tabs.length > 0;
  el("tabDetail").hidden = tabs.length === 0;
  const ul = el("sleepList");
  ul.innerHTML = "";
  visibleTabs.forEach((it) => {
    const li = document.createElement("li");
    li.className = `sleep-item lv${it.level || 0}${it.active ? " is-live" : ""}${it.discarded ? " is-sleep" : ""}${it.heavy ? " is-heavy" : ""}`;
    const fav = it.favIconUrl
      ? `<img class="sleep-fav" src="${it.favIconUrl}" alt="" />`
      : `<span class="sleep-fav ph">🗂️</span>`;
    const status = it.active ? "보는 중" : it.discarded ? "잠듦" : it.heavy ? "오래 켜둠" : "";
    const name = siteName(it.domain);
    const line = tabButlerLine(it);
    li.innerHTML = `
      ${fav}
      <div class="sleep-main">
        <p class="sleep-msg" title="${line}">${line}</p>
        <span class="sleep-meta">${it.domain} · ${it.openLabel}${it.active ? "" : ` · ${it.idleLabel}`}${status ? ` · ${status}` : ""}</span>
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

function popupTabCaption(ov, load) {
  const current = ov && ov.current;
  if (load.source === "memory" && ov.memory && ov.memory.capacity) {
    const used = fmtGB(ov.memory.capacity - ov.memory.available);
    const total = fmtGB(ov.memory.capacity);
    if (tone === "secretary") return `메모리 ${used}/${total}GB 사용 중이에요. 지금은 집중에 필요한 탭만 남기는 느낌으로 가볍게 살펴봐요.`;
    if (tone === "coach") return `메모리 ${used}/${total}GB 사용 중. 세션과 무관한 장기 탭만 후보로 확인하세요.`;
    if (tone === "manager") return `메모리 ${used}/${total}GB 사용 중! 지금 집중할 탭만 딱 보고 갑시다!`;
    return `메모리 ${used}/${total}GB 사용 중입니다. 집중에 덜 필요한 탭만 조용히 후보로 보겠습니다.`;
  }
  if (!current) return "열린 탭을 집중 흐름 기준으로 살펴보고 있습니다.";
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

// 코치 (규칙 기반)
function coach() {  const s = state && state.stats;
  const total = ((s && s.focusMs) || 0) + ((s && s.distractMs) || 0);
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
