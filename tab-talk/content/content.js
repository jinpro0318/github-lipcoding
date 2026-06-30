// 탭talk 콘텐츠 스크립트 — 집중 세션 중 딴짓 탭으로 들어오면 집사가 살짝 등장.
// 세션/딴짓 여부는 백그라운드가 storage.local에 기록한 present 값으로 판단한다.
// 멘트는 현재 사이트 종류(카테고리)와 선택된 집사 톤에 맞춰 매번 랜덤으로 고른다.
(() => {
  let bar = null;
  let lastIdx = -1;

  // 딴짓 사이트 종류 매핑 (classify.js의 CATEGORY_MAP과 동일 기준)
  const CATEGORY_MAP = {
    video: ["youtube.com", "youtu.be", "netflix.com", "twitch.tv", "chzzk.naver.com", "tving.com", "wavve.com", "laftel.net", "disneyplus.com"],
    shopping: ["coupang.com", "11st.co.kr", "gmarket.co.kr", "aliexpress.com", "amazon.com", "musinsa.com", "shopping.naver.com", "ssg.com", "auction.co.kr", "29cm.co.kr", "ably.co.kr"],
    sns: ["instagram.com", "facebook.com", "x.com", "twitter.com", "threads.net", "tiktok.com"],
    community: ["dcinside.com", "fmkorea.com", "ruliweb.com", "clien.net", "theqoo.net", "reddit.com", "inven.co.kr", "mlbpark.donga.com", "bobaedream.co.kr"],
    game: ["store.steampowered.com", "steamcommunity.com", "leagueoflegends.com", "op.gg", "game.naver.com", "epicgames.com"],
    news_portal: ["entertain.naver.com", "sports.news.naver.com", "news.nate.com", "insight.co.kr", "wikitree.co.kr"],
    webtoon: ["comic.naver.com", "webtoon.naver.com", "webtoon.kakao.com", "page.kakao.com", "bomtoon.com", "lezhin.com"]
  };

  function categoryOf(host) {
    const h = (host || "").replace(/^www\./, "");
    if (!h) return "etc";
    for (const cat in CATEGORY_MAP) {
      if (CATEGORY_MAP[cat].some((d) => h === d || h.endsWith("." + d))) return cat;
    }
    return "etc";
  }

  // 멘트 풀: LINES[톤][카테고리] = [여러 줄]. 호칭은 전부 "주인님" 통일.
  const LINES = {
    concierge: {
      video: [
        "주인님, '딱 한 편'이 시즌 전체가 되는 걸 제가 잘 압니다. 자리로 모실까요? 🎬",
        "주인님, 알고리즘의 손길이 부드럽지요. 허나 지금은 집중하실 시간입니다.",
        "주인님, 영상은 잠시 멈춰두시지요. 흐름이 끊기기 전에 모셔다 드릴게요."
      ],
      shopping: [
        "주인님, 좋은 물건은 내일도 그 자리에 있습니다. 쇼핑은 잠시 접어두시지요. 🛍️",
        "주인님, 장바구니에 담아두면 도망가지 않습니다. 지금은 일에 집중하시지요.",
        "주인님, 둘러보기는 잠시 후에. 집중 자리로 정중히 안내해 드릴게요."
      ],
      sns: [
        "주인님, 남의 일상 구경은 잠깐이면 충분하지요. 자리로 모실까요? 📸",
        "주인님, 타임라인은 흘러가도 마감은 기다려주지 않습니다.",
        "주인님, 잠시 화면을 닫아두시지요. 다시 흐름을 잡아드릴게요."
      ],
      community: [
        "주인님, 새 글은 방금 확인하셨지요. 잠시 집중 자리로 모시겠습니다. 🔄",
        "주인님, 여론은 주인님 없이도 잘 흘러갑니다. 지금은 일에 집중하시지요.",
        "주인님, 눈팅은 잠시 멈춰두시지요. 곧 다시 돌아오실 수 있어요."
      ],
      game: [
        "주인님, '딱 한 판'은 존재하지 않는다 들었습니다. 자리로 모실까요? 🎮",
        "주인님, 승부는 잠시 미뤄두시지요. 오늘 목표가 기다리고 있어요.",
        "주인님, 게임은 잠깐 멈춰두시지요. 집중 자리로 안내해 드릴게요."
      ],
      news_portal: [
        "주인님, 연예 소식이 업무를 대신해주지는 않지요. 자리로 모실까요? 📰",
        "주인님, 가십은 잠시 후에. 지금은 집중하실 시간입니다.",
        "주인님, 기사 한 줄이 한 시간이 되곤 하지요. 슬슬 돌아오실까요?"
      ],
      webtoon: [
        "주인님, 다음 화는 내일도 기다려줍니다. 잠시 덮어두시지요. 📖",
        "주인님, 이야기는 도망가지 않습니다. 지금은 일에 집중하시지요.",
        "주인님, 한 화만 더는 위험하지요. 자리로 정중히 모시겠습니다."
      ],
      etc: [
        "주인님, 잠시 다른 곳에 머무르고 계시네요. 원하실 때 모셔다 드릴게요.",
        "주인님, 슬슬 집중 자리로 다시 모실까요?",
        "주인님, 오늘 목표가 주인님을 기다리고 있어요."
      ]
    },
    secretary: {
      video: [
        "주인님, 영상은 이따 같이 봐요. 지금은 집중할 시간이에요. 🎬",
        "주인님, 한 편만 보려던 거 아니었어요? 우리 일단 일 끝내요.",
        "주인님, 재밌는 건 나중에. 조금만 더 힘내봐요."
      ],
      shopping: [
        "주인님, 구경은 이따 같이 해요. 지금은 일에 집중해봐요. 🛍️",
        "주인님, 그거 진짜 필요한 거 맞아요? 일단 일 먼저 끝내요.",
        "주인님, 장바구니는 안 도망가요. 우리 조금만 더 집중해요."
      ],
      sns: [
        "주인님, 다른 사람 소식은 잠깐 미뤄요. 지금은 우리 일에 집중해요. 📸",
        "주인님, 피드는 이따 봐요. 조금만 더 힘내봐요.",
        "주인님, 잠깐 폰 내려놓고 같이 집중해봐요."
      ],
      community: [
        "주인님, 새 글은 방금 봤잖아요. 우리 다시 집중해봐요. 🔄",
        "주인님, 눈팅은 이따 해요. 지금은 일 먼저 끝내요.",
        "주인님, 글은 안 사라져요. 조금만 더 힘내요."
      ],
      game: [
        "주인님, 게임은 일 끝나고 마음껏 해요. 지금은 집중할 시간이에요. 🎮",
        "주인님, 한 판만 하려던 거 알아요. 그래도 일단 일 먼저 해요.",
        "주인님, 승부는 이따가. 조금만 더 집중해봐요."
      ],
      news_portal: [
        "주인님, 연예 소식은 이따 봐요. 지금은 우리 일에 집중해요. 📰",
        "주인님, 그 기사 안 사라져요. 조금만 더 힘내봐요.",
        "주인님, 가십은 나중에. 같이 집중해봐요."
      ],
      webtoon: [
        "주인님, 다음 화는 내일도 있어요. 지금은 일 먼저 끝내요. 📖",
        "주인님, 이야기는 안 도망가요. 조금만 더 집중해봐요.",
        "주인님, 웹툰은 이따 같이 봐요. 우리 힘내요."
      ],
      etc: [
        "주인님, 잠깐 한눈파셨네요. 괜찮아요, 같이 돌아가요.",
        "주인님, 슬슬 집중 자리로 돌아와봐요.",
        "주인님, 할 일이 기다리고 있어요. 조금만 더 힘내요."
      ]
    },
    coach: {
      video: [
        "주인님, 영상 시청 감지. 작업 흐름이 끊깁니다. 🎬",
        "주인님, 지금은 업무 시간입니다. 영상은 보류하십시오.",
        "주인님, 한 편이 한 시간 됩니다. 복귀를 권장합니다."
      ],
      shopping: [
        "주인님, 쇼핑몰 감지. 지금은 업무 시간입니다. 🛒",
        "주인님, 구매 검색은 업무 후 권장합니다.",
        "주인님, 장바구니는 유지됩니다. 복귀하십시오."
      ],
      sns: [
        "주인님, SNS 감지. 집중이 분산됩니다. 📱",
        "주인님, 피드 확인은 업무 후로 미루십시오.",
        "주인님, 타임라인은 그대로입니다. 복귀를 권장합니다."
      ],
      community: [
        "주인님, 커뮤니티 감지. 새 글은 거의 없습니다. 🔄",
        "주인님, 눈팅은 효율을 낮춥니다. 복귀하십시오.",
        "주인님, 지금은 업무 시간입니다. 탭을 닫으십시오."
      ],
      game: [
        "주인님, 게임 사이트 감지. 업무 흐름이 끊깁니다. 🎮",
        "주인님, 한 판은 한 판으로 끝나지 않습니다. 복귀하십시오.",
        "주인님, 지금은 집중 시간입니다. 게임은 보류하십시오."
      ],
      news_portal: [
        "주인님, 연예·스포츠 기사 감지. 업무와 무관합니다. 📰",
        "주인님, 가십 소비는 시간 손실입니다. 복귀를 권장합니다.",
        "주인님, 기사 열람은 업무 후로 미루십시오."
      ],
      webtoon: [
        "주인님, 웹툰 감지. 작업 맥락이 끊깁니다. 📖",
        "주인님, 다음 화는 내일도 제공됩니다. 복귀하십시오.",
        "주인님, 지금은 업무 시간입니다. 시청을 보류하십시오."
      ],
      etc: [
        "주인님, 집중에서 벗어났습니다. 복귀를 권장합니다.",
        "주인님, 현재 페이지는 업무와 무관합니다.",
        "주인님, 작업 흐름 유지를 위해 복귀하십시오."
      ]
    },
    manager: {
      video: [
        "주인님! 알고리즘한테 지지 말고 가즈아! 🔥",
        "주인님! 영상 끄고 일하러 달려요! 할 수 있어요!",
        "주인님! 한 편만? 그거 함정이에요! 자, 복귀!"
      ],
      shopping: [
        "주인님! 지름신은 잠깐 보류! 일 끝내고 마음껏 둘러봐요! 💪",
        "주인님! 장바구니 잠깐 멈추고 일하러 가즈아!",
        "주인님! 쇼핑은 이따! 지금은 집중 타임이에요!"
      ],
      sns: [
        "주인님! 남 구경 그만, 내 일에 집중! 가즈아! 📱",
        "주인님! 피드 그만 내리고 달려봅시다!",
        "주인님! 폰 내려놓고 집중 모드 온! 할 수 있어요!"
      ],
      community: [
        "주인님! 새 글 없어요, 진짜로! 복귀 가즈아! 🔄",
        "주인님! 눈팅 그만, 일하러 달려요!",
        "주인님! 커뮤는 이따! 지금은 집중각이에요!"
      ],
      game: [
        "주인님! 딱 한 판의 저주, 오늘은 끊어요! 가즈아! 🎮",
        "주인님! 게임은 보상으로! 일 먼저 클리어해요!",
        "주인님! 승부는 이따! 지금은 일에 올인!"
      ],
      news_portal: [
        "주인님! 연예 기사가 밥 먹여주나요! 복귀 가즈아! 📰",
        "주인님! 가십 그만, 내 할 일로 달려요!",
        "주인님! 기사는 이따! 지금은 집중 타임!"
      ],
      webtoon: [
        "주인님! 다음 화는 내일도 있어요! 지금은 일하러 가즈아! 📖",
        "주인님! 웹툰 덮고 집중 모드! 할 수 있어요!",
        "주인님! 한 화만? 그거 함정! 복귀합시다!"
      ],
      etc: [
        "주인님! 어이쿠 잠깐 새셨네요! 다시 가봅시다!",
        "주인님! 집중 자리로 컴백, 가즈아!",
        "주인님! 할 일이 손짓해요! 달려봅시다!"
      ]
    }
  };

  // 직전에 뜬 줄은 제외하고 랜덤으로 한 줄 고르기 (연속 중복 방지)
  function pickLine(pool) {
    if (!pool || pool.length === 0) return "";
    if (pool.length === 1) return pool[0];
    let i;
    do {
      i = Math.floor(Math.random() * pool.length);
    } while (i === lastIdx);
    lastIdx = i;
    return pool[i];
  }

  function messageFor(tone) {
    const pack = LINES[tone] || LINES.concierge;
    const cat = categoryOf(location.hostname);
    return pickLine(pack[cat] || pack.etc);
  }

  function show(tone) {
    if (bar) return;
    bar = document.createElement("div");
    bar.className = "tabtalk-nudge";
    bar.innerHTML = `<span class="bell">🔔</span><span class="msg">${messageFor(tone)}</span><button class="close" title="닫기">✕</button>`;
    bar.querySelector(".close").onclick = remove;
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add("show"));
  }
  function remove() {
    if (!bar) return;
    bar.classList.remove("show");
    const b = bar; bar = null;
    setTimeout(() => b.remove(), 350);
  }

  // 중립 도메인 1회 물어보기 넛지 (업무/딴짓 버튼)
  let askBar = null;
  function showAsk(host) {
    if (askBar) return;
    askBar = document.createElement("div");
    askBar.className = "tabtalk-nudge tabtalk-ask";
    askBar.innerHTML =
      `<span class="bell">🤔</span>` +
      `<span class="msg">주인님, '${host}'는 업무 동료인가요, 딴짓 친구인가요?</span>` +
      `<button class="ask-yes">업무예요</button>` +
      `<button class="ask-no">딴짓이에요</button>` +
      `<button class="close" title="나중에">✕</button>`;
    askBar.querySelector(".ask-yes").onclick = () => answer(host, "work");
    askBar.querySelector(".ask-no").onclick = () => answer(host, "distract");
    askBar.querySelector(".close").onclick = () => answer(host, "skip");
    document.body.appendChild(askBar);
    requestAnimationFrame(() => askBar.classList.add("show"));
  }
  function removeAsk() {
    if (!askBar) return;
    askBar.classList.remove("show");
    const b = askBar; askBar = null;
    setTimeout(() => b.remove(), 350);
  }
  function answer(host, ans) {
    try { chrome.runtime.sendMessage({ type: "classify-answer", host, answer: ans }); } catch {}
    removeAsk();
  }

  function evaluate(session, settings, ask) {
    const tone = (settings && settings.tone) || "concierge";
    const style = (settings && settings.warnStyle) || "nudge";
    // 백그라운드(숨은) 탭에서는 절대 띄우지 않는다 — 지금 보고 있는 탭에만 안내.
    // (업무로 분류해 둔 사이트를 다른 탭에서 보는 동안 잘못 알림이 뜨던 문제 방지)
    if (document.visibilityState !== "visible") {
      remove();
      removeAsk();
      return;
    }
    if (session && session.active && !session.present) {
      removeAsk();
      if (style === "popup") remove(); // 팝업 모드는 별도 경고 창이 처리 (중복 방지)
      else show(tone);
      return;
    }
    remove();
    // 딴짓 상태가 아니고, 이 페이지가 물어볼 중립 도메인이면 1회 질문
    if (ask && ask.host && location.hostname.replace(/^www\./, "") === ask.host) showAsk(ask.host);
    else removeAsk();
  }

  const read = () => chrome.storage.local.get(["session", "settings", "ask"], (o) => evaluate(o.session, o.settings, o.ask));
  read();
  chrome.storage.onChanged.addListener((c) => {
    if (c.session || c.settings || c.ask) read();
  });
  // 탭을 보거나 숨길 때마다 다시 판단 (숨은 탭에서는 알림 제거)
  document.addEventListener("visibilitychange", read);
})();
