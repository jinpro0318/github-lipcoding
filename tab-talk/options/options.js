// 탭talk 옵션 — 업무(allowlist)/딴짓(blocklist) 도메인 편집.
// 백그라운드 service-worker가 읽는 settings(chrome.storage.local)에 저장한다.
import { DEFAULT_WORK, DEFAULT_DISTRACT, hostOf } from "../background/classify.js";

const SETTINGS_KEY = "settings";
const el = (id) => document.getElementById(id);

const defaults = () => ({ tone: "concierge", allowlist: [], blocklist: [], idleReminder: true, idleTestMode: false, warnStyle: "nudge", askedHosts: [] });

async function load() {
  const o = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...defaults(), ...(o[SETTINGS_KEY] || {}) };
}
async function save(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

function toast(text) {
  const n = el("toast");
  n.textContent = text;
  n.hidden = false;
  n.classList.add("show");
  setTimeout(() => { n.classList.remove("show"); setTimeout(() => (n.hidden = true), 250); }, 1800);
}

// 입력값을 도메인 호스트로 정규화 (https://www.youtube.com/watch → youtube.com)
function normalize(raw) {
  let v = (raw || "").trim().toLowerCase();
  if (!v) return "";
  if (v.includes("/") || v.includes(":")) {
    const h = hostOf(v.includes("://") ? v : "https://" + v);
    if (h) return h;
  }
  return v.replace(/^www\./, "").replace(/\/.*$/, "");
}

function renderList(key, items) {
  const ul = el(key);
  ul.innerHTML = "";
  items.forEach((domain) => {
    const li = document.createElement("li");
    li.className = "chip";
    li.innerHTML = `<span>${domain}</span><button class="x" title="삭제" aria-label="${domain} 삭제">✕</button>`;
    li.querySelector(".x").onclick = () => remove(key, domain);
    ul.appendChild(li);
  });
}

function renderDefaults() {
  const fill = (id, arr) => {
    const ul = el(id);
    ul.innerHTML = "";
    arr.forEach((d) => {
      const li = document.createElement("li");
      li.className = "chip";
      li.textContent = d;
      ul.appendChild(li);
    });
  };
  fill("defaultWork", DEFAULT_WORK);
  fill("defaultDistract", DEFAULT_DISTRACT);
}

async function add(key, raw) {
  const domain = normalize(raw);
  if (!domain) return;
  const settings = await load();
  if (settings[key].includes(domain)) { toast(`이미 등록된 도메인이에요: ${domain}`); return; }
  // 반대 목록에 있으면 옮긴다 (한 도메인이 양쪽에 동시에 있으면 안 됨)
  const other = key === "allowlist" ? "blocklist" : "allowlist";
  settings[other] = settings[other].filter((d) => d !== domain);
  settings[key] = [...settings[key], domain];
  await save(settings);
  renderList("allowlist", settings.allowlist);
  renderList("blocklist", settings.blocklist);
  toast(`추가했어요: ${domain}`);
}

async function remove(key, domain) {
  const settings = await load();
  settings[key] = settings[key].filter((d) => d !== domain);
  await save(settings);
  renderList(key, settings[key]);
  toast(`삭제했어요: ${domain}`);
}

async function init() {
  renderDefaults();
  const settings = await load();
  renderList("allowlist", settings.allowlist);
  renderList("blocklist", settings.blocklist);

  // 잠든 탭 안내 토글
  const idleReminder = el("idleReminder");
  const idleTestMode = el("idleTestMode");
  idleReminder.checked = settings.idleReminder !== false;
  idleTestMode.checked = !!settings.idleTestMode;
  idleReminder.addEventListener("change", async () => {
    const s = await load();
    s.idleReminder = idleReminder.checked;
    await save(s);
    toast(idleReminder.checked ? "잠든 탭 안내를 켰어요" : "잠든 탭 안내를 껐어요");
  });
  idleTestMode.addEventListener("change", async () => {
    const s = await load();
    s.idleTestMode = idleTestMode.checked;
    await save(s);
    toast(idleTestMode.checked ? "테스트 모드: 단계 단위가 '분'이에요" : "테스트 모드를 껐어요");
  });

  // 딴짓 경고 방식
  const warnStyle = settings.warnStyle || "nudge";
  document.querySelectorAll('input[name="warnStyle"]').forEach((r) => {
    r.checked = r.value === warnStyle;
    r.addEventListener("change", async () => {
      if (!r.checked) return;
      const s = await load();
      s.warnStyle = r.value;
      await save(s);
      const labels = { nudge: "코너 넛지", popup: "팝업창", sidepanel: "사이드패널" };
      toast(`딴짓 경고: ${labels[r.value]}로 바꿨어요`);
    });
  });

  document.querySelectorAll(".add-row").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector(".add-input");
      add(form.dataset.list, input.value);
      input.value = "";
      input.focus();
    });
  });
}

init();
