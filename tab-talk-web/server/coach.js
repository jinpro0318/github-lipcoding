// 탭talk AI 코치
// 현재: 규칙 기반 코칭 메시지 생성 (자격증명 없이 동작)
// 확장: GitHub Copilot SDK 연동 지점을 명시 — USE_COPILOT=1 + 토큰 설정 시 LLM 코칭으로 대체
//
// Copilot SDK 연동 예시 (의사 코드):
//   import { CopilotClient } from "@github/copilot-sdk";
//   const client = new CopilotClient({ token: process.env.COPILOT_TOKEN });
//   const session = await client.createSession();
//   const reply = await session.sendAndWait(buildPrompt(day));
//
// Azure BYOM 사용 시 provider.bearerToken 은 DefaultAzureCredential/ManagedIdentityCredential 로 발급.

function fmtMin(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

export function buildPrompt(day) {
  const total = day.focusMs + day.distractMs;
  const ratio = total === 0 ? 0 : day.focusMs / total;
  return [
    "당신은 '탭talk'의 친절한 집중 컨시어지입니다.",
    "아래 오늘 데이터를 바탕으로 한국어로 따뜻하고 구체적인 코칭을 3문장 이내로 작성하세요.",
    `- 몰입 시간: ${fmtMin(day.focusMs)}`,
    `- 딴짓 시간: ${fmtMin(day.distractMs)}`,
    `- 딴짓 발생: ${day.distractCount}회`,
    `- 복귀 성공: ${day.returnCount}회`,
    `- 몰입 비율: ${Math.round(ratio * 100)}%`,
    "고객을 존중하는 말투(주인님)로 작성하세요."
  ].join("\n");
}

function ruleBasedCoach(day) {
  const total = day.focusMs + day.distractMs;
  const ratio = total === 0 ? 0 : day.focusMs / total;
  const pct = Math.round(ratio * 100);
  const returnRate =
    day.distractCount === 0 ? 100 : Math.round((day.returnCount / day.distractCount) * 100);

  let headline;
  let advice;

  if (total === 0) {
    headline = "주인님, 아직 오늘의 집중 여정이 시작되지 않았어요.";
    advice = "준비되시면 집중 세션을 시작해 주세요. 제가 곁에서 정성껏 모시겠습니다.";
  } else if (ratio >= 0.8) {
    headline = `주인님, 오늘 몰입 비율이 ${pct}%로 아주 훌륭하십니다.`;
    advice = "지금 페이스라면 충분합니다. 중간중간 짧은 휴식으로 컨디션을 지켜주세요.";
  } else if (ratio >= 0.5) {
    headline = `주인님, 오늘 몰입 ${fmtMin(day.focusMs)}, 균형 잡힌 하루를 보내고 계세요.`;
    advice = `딴짓이 ${day.distractCount}회 있었지만 복귀율이 ${returnRate}%로 안정적이에요. 한 세션만 더 집중해볼까요?`;
  } else {
    headline = `주인님, 오늘은 딴짓이 ${fmtMin(day.distractMs)} 정도 있었어요.`;
    advice = "괜찮습니다. 25분 집중 세션 하나로 다시 흐름을 만들어 드릴게요. 함께 시작해요.";
  }

  return {
    source: "rule-based",
    headline,
    advice,
    metrics: {
      focus: fmtMin(day.focusMs),
      distract: fmtMin(day.distractMs),
      focusRatio: pct,
      returnRate
    }
  };
}

// 집중 브리핑(예측): 과거 기록을 최근일수록 가중치 높여 평균
// records: [{ focusMs, distractMs }, ...] (최근 항목이 앞쪽)
export function forecastFromHistory(records) {
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

export async function generateCoaching(day) {
  // Copilot SDK 사용이 설정되어 있으면 LLM 코칭으로 대체 (자격증명 필요)
  if (process.env.USE_COPILOT === "1") {
    try {
      // 실제 연동 시 아래 주석을 해제하고 SDK 호출로 교체하세요.
      // const { CopilotClient } = await import("@github/copilot-sdk");
      // const client = new CopilotClient({ token: process.env.COPILOT_TOKEN });
      // const session = await client.createSession();
      // const text = await session.sendAndWait(buildPrompt(day));
      // return { source: "copilot", headline: text, advice: "", metrics: {} };
      throw new Error("Copilot SDK not configured");
    } catch (err) {
      // 실패 시 규칙 기반으로 안전하게 폴백
      return { ...ruleBasedCoach(day), note: `copilot fallback: ${err.message}` };
    }
  }
  return ruleBasedCoach(day);
}
