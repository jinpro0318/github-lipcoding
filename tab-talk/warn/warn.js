// 탭talk 경고 페이지 — 팝업창/사이드패널 공용.
// 현재 분류(딴짓 도메인 카테고리)와 선택된 집사 톤에 맞춘 한마디를 보여준다.
import { category } from "../background/classify.js";

const LINES = {
  concierge: {
    video: "주인님, 영상은 잠시 멈춰두시지요. 자리로 정중히 모시겠습니다. 🎬",
    shopping: "주인님, 좋은 물건은 내일도 그 자리에 있습니다. 쇼핑은 잠시 접어두시지요. 🛍️",
    sns: "주인님, 타임라인은 흘러가도 마감은 기다려주지 않습니다. 📸",
    community: "주인님, 새 글은 방금 확인하셨지요. 집중 자리로 모시겠습니다. 🔄",
    game: "주인님, '딱 한 판'은 존재하지 않는다 들었습니다. 자리로 모실까요? 🎮",
    news_portal: "주인님, 가십은 잠시 후에. 지금은 집중하실 시간입니다. 📰",
    webtoon: "주인님, 다음 화는 내일도 기다려줍니다. 잠시 덮어두시지요. 📖",
    etc: "주인님, 잠시 다른 곳에 머무르고 계시네요. 자리로 모실까요?"
  },
  secretary: {
    video: "주인님, 영상은 이따 같이 봐요. 지금은 집중할 시간이에요. 🎬",
    shopping: "주인님, 구경은 이따 같이 해요. 지금은 일에 집중해봐요. 🛍️",
    sns: "주인님, 피드는 이따 봐요. 조금만 더 힘내봐요. 📸",
    community: "주인님, 새 글은 방금 봤잖아요. 우리 다시 집중해봐요. 🔄",
    game: "주인님, 게임은 일 끝나고 마음껏 해요. 지금은 집중할 시간이에요. 🎮",
    news_portal: "주인님, 연예 소식은 이따 봐요. 지금은 우리 일에 집중해요. 📰",
    webtoon: "주인님, 다음 화는 내일도 있어요. 지금은 일 먼저 끝내요. 📖",
    etc: "주인님, 잠깐 한눈파셨네요. 괜찮아요, 같이 돌아가요."
  },
  coach: {
    video: "주인님, 영상 시청 감지. 작업 흐름이 끊깁니다. 🎬",
    shopping: "주인님, 쇼핑몰 감지. 지금은 업무 시간입니다. 🛒",
    sns: "주인님, SNS 감지. 집중이 분산됩니다. 📱",
    community: "주인님, 커뮤니티 감지. 복귀를 권장합니다. 🔄",
    game: "주인님, 게임 사이트 감지. 업무 흐름이 끊깁니다. 🎮",
    news_portal: "주인님, 연예·스포츠 기사 감지. 업무와 무관합니다. 📰",
    webtoon: "주인님, 웹툰 감지. 작업 맥락이 끊깁니다. 📖",
    etc: "주인님, 집중에서 벗어났습니다. 복귀를 권장합니다."
  },
  manager: {
    video: "주인님! 알고리즘한테 지지 말고 가즈아! 🔥",
    shopping: "주인님! 지름신은 잠깐 보류! 일 끝내고 둘러봐요! 💪",
    sns: "주인님! 남 구경 그만, 내 일에 집중! 가즈아! 📱",
    community: "주인님! 새 글 없어요, 진짜로! 복귀 가즈아! 🔄",
    game: "주인님! 딱 한 판의 저주, 오늘은 끊어요! 가즈아! 🎮",
    news_portal: "주인님! 연예 기사가 밥 먹여주나요! 복귀 가즈아! 📰",
    webtoon: "주인님! 다음 화는 내일도 있어요! 일하러 가즈아! 📖",
    etc: "주인님! 어이쿠 잠깐 새셨네요! 다시 가봅시다!"
  }
};

async function render() {
  const o = await chrome.storage.local.get(["classification", "settings"]);
  const tone = (o.settings && o.settings.tone) || "concierge";
  const host = (o.classification && o.classification.host) || "";
  const cat = host ? category("https://" + host) : "etc";
  const pack = LINES[tone] || LINES.concierge;
  document.getElementById("msg").textContent = pack[cat] || pack.etc;
  document.getElementById("host").textContent = host ? `현재: ${host}` : "";
}

document.getElementById("ok").addEventListener("click", () => window.close());
document.getElementById("tagWork").addEventListener("click", async () => {
  await chrome.storage.local.set({ nudgeTag: "work" });
  window.close();
});
document.getElementById("tagDistract").addEventListener("click", async () => {
  await chrome.storage.local.set({ nudgeTag: "distract" });
  window.close();
});
document.getElementById("tagBreak").addEventListener("click", async () => {
  await chrome.storage.local.set({ nudgeTag: "break" });
  window.close();
});
render();
chrome.storage.onChanged.addListener((c) => {
  if (c.classification || c.settings) render();
});
