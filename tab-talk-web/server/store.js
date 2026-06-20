// 탭talk 데이터 저장 계층 (파일 기반 JSON 스토어)
// 사용자별 일일 집중 기록을 보관합니다. (MVP: 단일 디바이스/로컬 파일)
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDay(date) {
  return {
    date,
    focusMs: 0,
    distractMs: 0,
    distractCount: 0,
    returnCount: 0,
    sessions: 0,
    events: []
  };
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ days: {} }, null, 2));
  }
}

async function readAll() {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return { days: {} };
  }
}

async function writeAll(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function getToday() {
  const data = await readAll();
  const key = todayKey();
  if (!data.days[key]) {
    data.days[key] = emptyDay(key);
    await writeAll(data);
  }
  return data.days[key];
}

export async function recordEvent(event) {
  const data = await readAll();
  const key = todayKey();
  if (!data.days[key]) data.days[key] = emptyDay(key);
  const day = data.days[key];

  const stamped = { ...event, at: new Date().toISOString() };

  switch (event.type) {
    case "start":
      day.sessions += 1;
      break;
    case "leave":
      day.distractCount += 1;
      break;
    case "return":
      day.returnCount += 1;
      if (typeof event.awayMs === "number" && event.awayMs > 0) {
        day.distractMs += event.awayMs;
      }
      break;
    case "focus-tick":
      if (typeof event.deltaMs === "number" && event.deltaMs > 0) {
        day.focusMs += event.deltaMs;
      }
      break;
    default:
      break;
  }

  day.events.push(stamped);
  // 이벤트 로그는 최근 500개만 유지
  if (day.events.length > 500) day.events = day.events.slice(-500);

  await writeAll(data);
  return day;
}

export async function resetToday() {
  const data = await readAll();
  const key = todayKey();
  data.days[key] = emptyDay(key);
  await writeAll(data);
  return data.days[key];
}

export async function getHistory(limit = 7) {
  const data = await readAll();
  return Object.values(data.days)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}
