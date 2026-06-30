// 탭talk — 도메인 분류 (업무 vs 딴짓)
// 보안 샌드박스 안에서 확장이 합법적으로 알 수 있는 "활성 탭 도메인"만 사용한다.
// 전체 URL/내용은 다루지 않고 도메인 호스트만 본다.

export const DEFAULT_DISTRACT = [
  "youtube.com",
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "netflix.com",
  "twitch.tv",
  "x.com",
  "twitter.com",
  "reddit.com",
  "coupang.com",
  "11st.co.kr",
  "gmarket.co.kr",
  "aliexpress.com",
  "amazon.com",
  "dcinside.com",
  "fmkorea.com",
  "ruliweb.com"
];

export const DEFAULT_WORK = [
  "github.com",
  "gitlab.com",
  "notion.so",
  "docs.google.com",
  "stackoverflow.com",
  "figma.com",
  "atlassian.net",
  "slack.com",
  "azure.com",
  "developer.mozilla.org",
  "localhost",
  "tabtalk-jinpro0318-162012.azurewebsites.net"
];

// 호스트에서 기준 도메인 추출 (www. 제거)
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// 도메인 카테고리 판정: distract | work | neutral
export function classify(url, lists) {
  const host = hostOf(url);
  if (!host) return "neutral";
  const distract = DEFAULT_DISTRACT.concat((lists && lists.blocklist) || []);
  const work = DEFAULT_WORK.concat((lists && lists.allowlist) || []);
  const match = (arr) => arr.some((d) => host === d || host.endsWith("." + d));
  if (match(distract)) return "distract";
  if (match(work)) return "work";
  return "neutral";
}

// 딴짓 사이트 종류 매핑 — 멘트를 사이트 성격에 맞게 고르기 위함
export const CATEGORY_MAP = {
  video: ["youtube.com", "youtu.be", "netflix.com", "twitch.tv", "chzzk.naver.com", "tving.com", "wavve.com", "laftel.net", "disneyplus.com"],
  shopping: ["coupang.com", "11st.co.kr", "gmarket.co.kr", "aliexpress.com", "amazon.com", "musinsa.com", "shopping.naver.com", "ssg.com", "auction.co.kr", "29cm.co.kr", "ably.co.kr"],
  sns: ["instagram.com", "facebook.com", "x.com", "twitter.com", "threads.net", "tiktok.com"],
  community: ["dcinside.com", "fmkorea.com", "ruliweb.com", "clien.net", "theqoo.net", "reddit.com", "inven.co.kr", "mlbpark.donga.com", "bobaedream.co.kr"],
  game: ["store.steampowered.com", "steamcommunity.com", "leagueoflegends.com", "op.gg", "game.naver.com", "epicgames.com"],
  news_portal: ["entertain.naver.com", "sports.news.naver.com", "news.nate.com", "insight.co.kr", "wikitree.co.kr"],
  webtoon: ["comic.naver.com", "webtoon.naver.com", "webtoon.kakao.com", "page.kakao.com", "bomtoon.com", "lezhin.com"]
};

// 호스트가 속한 딴짓 카테고리 반환 (없으면 "etc")
export function category(url) {
  const host = hostOf(url);
  if (!host) return "etc";
  for (const cat in CATEGORY_MAP) {
    if (CATEGORY_MAP[cat].some((d) => host === d || host.endsWith("." + d))) return cat;
  }
  return "etc";
}
