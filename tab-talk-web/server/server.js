// 탭talk 풀스택 서버 (Express)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getToday, recordEvent, resetToday, getHistory } from "./store.js";
import { generateCoaching, forecastFromHistory } from "./coach.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// 정적 프론트엔드 제공
app.use(express.static(path.join(__dirname, "..", "public")));

// --- API ---
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tabtalk", time: new Date().toISOString() });
});

app.get("/api/stats/today", async (_req, res, next) => {
  try {
    const day = await getToday();
    res.json(publicDay(day));
  } catch (err) {
    next(err);
  }
});

app.post("/api/session/event", async (req, res, next) => {
  try {
    const { type, awayMs, deltaMs } = req.body || {};
    const allowed = ["start", "leave", "return", "stop", "focus-tick"];
    if (!allowed.includes(type)) {
      return res.status(400).json({ error: "invalid event type" });
    }
    const day = await recordEvent({ type, awayMs, deltaMs });
    res.json(publicDay(day));
  } catch (err) {
    next(err);
  }
});

app.post("/api/stats/reset", async (_req, res, next) => {
  try {
    const day = await resetToday();
    res.json(publicDay(day));
  } catch (err) {
    next(err);
  }
});

app.get("/api/coach", async (_req, res, next) => {
  try {
    const day = await getToday();
    const coaching = await generateCoaching(day);
    res.json(coaching);
  } catch (err) {
    next(err);
  }
});

app.get("/api/history", async (_req, res, next) => {
  try {
    const days = await getHistory(7);
    res.json(days.map(publicDay));
  } catch (err) {
    next(err);
  }
});

// 집중 브리핑 예측 (최근 기록 기반)
app.get("/api/forecast", async (_req, res, next) => {
  try {
    const days = await getHistory(14);
    res.json(forecastFromHistory(days));
  } catch (err) {
    next(err);
  }
});

// 이벤트 로그는 외부로 노출하지 않음
function publicDay(day) {
  const { events, ...rest } = day;
  return rest;
}

app.use((err, _req, res, _next) => {
  console.error("[tabtalk] error:", err);
  res.status(500).json({ error: "internal error" });
});

app.listen(PORT, () => {
  console.log(`탭talk 서버 실행 중 → http://localhost:${PORT}`);
});
