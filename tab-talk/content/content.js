// 탭talk 콘텐츠 스크립트 — 집중 세션 중 딴짓 탭으로 들어오면 집사가 살짝 등장.
// 세션/딴짓 여부는 백그라운드가 storage.local에 기록한 present 값으로 판단한다.
// 멘트는 현재 사이트 종류(카테고리)와 선택된 집사 톤에 맞춰 매번 랜덤으로 고른다.
(() => {
  let bar = null;
  let extensionAlive = true;

  function markExtensionDead(err) {
    if (!err || !String(err.message || err).includes("Extension context invalidated")) return;
    extensionAlive = false;
    remove();
    removeAsk();
  }

  function chromeSafe(fn, fallback) {
    if (!extensionAlive) return fallback;
    try {
      return fn();
    } catch (err) {
      markExtensionDead(err);
      return fallback;
    }
  }

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

  // 집사 톤별 마스코트 SVG (popup/mascots.js와 동일 디자인을 콘텐츠 스크립트에 인라인).
  // 선택한 집사가 직접 메시지를 보내오는 느낌을 주기 위해 넛지 아이콘으로 사용한다.
  const MASCOTS = {
    concierge: `<svg class="mascot-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ttBodyConcierge" x1="60" y1="34" x2="60" y2="108" gradientUnits="userSpaceOnUse"><stop stop-color="#5aa0ff"/><stop offset="1" stop-color="#3182f6"/></linearGradient><linearGradient id="ttCapConcierge" x1="60" y1="22" x2="60" y2="42" gradientUnits="userSpaceOnUse"><stop stop-color="#ff6b76"/><stop offset="1" stop-color="#f04452"/></linearGradient></defs><ellipse cx="60" cy="111" rx="27" ry="5" fill="#191f28" opacity="0.07"/><rect x="25" y="42" width="70" height="65" rx="32" fill="url(#ttBodyConcierge)"/><rect x="35" y="38" width="50" height="9" rx="4.5" fill="#1b64da"/><rect x="39" y="25" width="42" height="16" rx="8" fill="url(#ttCapConcierge)"/><circle cx="60" cy="21" r="3.8" fill="#ffd23f"/><circle cx="49" cy="68" r="6.4" fill="#fff"/><circle cx="71" cy="68" r="6.4" fill="#fff"/><circle cx="50" cy="69" r="3.3" fill="#191f28"/><circle cx="72" cy="69" r="3.3" fill="#191f28"/><path d="M53 82 Q60 89 67 82" stroke="#191f28" stroke-width="3" stroke-linecap="round"/></svg>`,
    secretary: `<svg class="mascot-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ttBodySec" x1="60" y1="34" x2="60" y2="108" gradientUnits="userSpaceOnUse"><stop stop-color="#4fd49a"/><stop offset="1" stop-color="#00c73c"/></linearGradient></defs><ellipse cx="60" cy="111" rx="27" ry="5" fill="#191f28" opacity="0.07"/><rect x="25" y="42" width="70" height="65" rx="32" fill="url(#ttBodySec)"/><path d="M30 52 Q40 38 60 38 Q80 38 90 52 Q78 46 60 46 Q42 46 30 52 Z" fill="#00a831"/><path d="M43 70 Q49 64 55 70" stroke="#191f28" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M65 70 Q71 64 77 70" stroke="#191f28" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M52 82 Q60 90 68 82" stroke="#191f28" stroke-width="3" stroke-linecap="round"/></svg>`,
    coach: `<svg class="mascot-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ttBodyCoach" x1="60" y1="34" x2="60" y2="108" gradientUnits="userSpaceOnUse"><stop stop-color="#a78bfa"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs><ellipse cx="60" cy="111" rx="27" ry="5" fill="#191f28" opacity="0.07"/><rect x="25" y="42" width="70" height="65" rx="32" fill="url(#ttBodyCoach)"/><circle cx="49" cy="68" r="6" fill="#fff"/><circle cx="71" cy="68" r="6" fill="#fff"/><circle cx="50" cy="69" r="3" fill="#191f28"/><circle cx="72" cy="69" r="3" fill="#191f28"/><circle cx="49" cy="68" r="9" fill="none" stroke="#2d1b69" stroke-width="2.4"/><circle cx="71" cy="68" r="9" fill="none" stroke="#2d1b69" stroke-width="2.4"/><path d="M54 84 Q60 87 66 84" stroke="#191f28" stroke-width="3" stroke-linecap="round"/></svg>`,
    manager: `<svg class="mascot-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ttBodyMgr" x1="60" y1="34" x2="60" y2="108" gradientUnits="userSpaceOnUse"><stop stop-color="#ffb15a"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient></defs><ellipse cx="60" cy="111" rx="27" ry="5" fill="#191f28" opacity="0.07"/><rect x="25" y="42" width="70" height="65" rx="32" fill="url(#ttBodyMgr)"/><rect x="33" y="44" width="54" height="8" rx="4" fill="#f04452"/><circle cx="49" cy="69" r="6.4" fill="#fff"/><circle cx="71" cy="69" r="6.4" fill="#fff"/><circle cx="50" cy="70" r="3.3" fill="#191f28"/><circle cx="72" cy="70" r="3.3" fill="#191f28"/><path d="M50 81 Q60 93 70 81 Z" fill="#191f28"/></svg>`
  };
  function butlerFace(tone) {
    return MASCOTS[tone] || MASCOTS.concierge;
  }

  function createFace(tone) {
    const face = document.createElement("span");
    face.className = "face";
    try {
      const doc = new DOMParser().parseFromString(butlerFace(tone), "image/svg+xml");
      const svg = doc.documentElement;
      if (svg && svg.nodeName.toLowerCase() === "svg") face.appendChild(document.importNode(svg, true));
    } catch {}
    return face;
  }

  function createText(className, text) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
  }

  function createButton(className, text, title) {
    const button = document.createElement("button");
    button.className = className;
    button.textContent = text;
    if (title) button.title = title;
    return button;
  }

  function mountNudge(node, isCurrent) {
    try {
      if (!document.body) return false;
      document.body.appendChild(node);
      requestAnimationFrame(() => {
        try {
          if (isCurrent() && node.isConnected && !/(^|\s)show(\s|$)/.test(node.className)) {
            node.className += " show";
          }
        } catch {}
      });
      return true;
    } catch {
      return false;
    }
  }

  function unmountNudge(node) {
    try {
      if (!node) return;
      node.className = node.className.replace(/(^|\s)show(\s|$)/g, " ").trim();
      setTimeout(() => {
        try {
          if (node.isConnected) node.remove();
        } catch {}
      }, 350);
    } catch {}
  }

  // 현재 사이트 종류에 맞는 멘트 중 한 줄 고르기
  function pickLine(pool) {
    if (!pool || pool.length === 0) return "";
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function messageFor(tone) {
    const pack = LINES[tone] || LINES.concierge;
    const cat = categoryOf(location.hostname);
    let pool = [];
    if (pack && Array.isArray(pack[cat])) {
      pool = pack[cat];
    } else if (pack && Array.isArray(pack.etc)) {
      pool = pack.etc;
    }
    return pickLine(pool);
  }

  function show(tone) {
    if (bar) return;
    const nextBar = document.createElement("div");
    nextBar.className = "tabtalk-nudge";
    const closeButton = createButton("close", "x", "닫기");
    closeButton.onclick = remove;
    nextBar.append(createFace(tone), createText("msg", messageFor(tone)), closeButton);
    bar = nextBar;
    if (!mountNudge(nextBar, () => bar === nextBar)) bar = null;
  }
  function remove() {
    if (!bar) return;
    const currentBar = bar;
    bar = null;
    unmountNudge(currentBar);
  }

  // 중립 도메인 1회 물어보기 넛지 (업무/딴짓 버튼)
  let askBar = null;
  function showAsk(host, tone) {
    if (askBar) return;
    const nextAskBar = document.createElement("div");
    nextAskBar.className = "tabtalk-nudge tabtalk-ask";
    const yesButton = createButton("ask-yes", "업무예요");
    const noButton = createButton("ask-no", "딴짓이에요");
    const closeButton = createButton("close", "x", "나중에");
    yesButton.onclick = () => answer(host, "work");
    noButton.onclick = () => answer(host, "distract");
    closeButton.onclick = () => answer(host, "skip");
    nextAskBar.append(
      createFace(tone),
      createText("msg", `주인님, '${host}'는 업무 동료인가요, 딴짓 친구인가요?`),
      yesButton,
      noButton,
      closeButton
    );
    askBar = nextAskBar;
    if (!mountNudge(nextAskBar, () => askBar === nextAskBar)) askBar = null;
  }
  function removeAsk() {
    if (!askBar) return;
    const currentAskBar = askBar;
    askBar = null;
    unmountNudge(currentAskBar);
  }
  function answer(host, ans) {
    chromeSafe(() => {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({ type: "classify-answer", host, answer: ans }, () => {
          chromeSafe(() => void chrome.runtime.lastError, null);
        });
      }
    }, null);
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
    // 아직 업무/딴짓으로 등록되지 않은 사이트면, 복귀 경고 대신
    // '이 사이트는 업무인가요?' 질문을 먼저 띄운다. (업무로 답하면 업무로 등록됨)
    if (ask && ask.host && location.hostname.replace(/^www\./, "") === ask.host) {
      remove();
      showAsk(ask.host, tone);
      return;
    }
    removeAsk();
    // 등록된 딴짓 사이트(또는 자리비움)에서만 복귀 넛지를 띄운다.
    if (session && session.active && !session.present) {
      if (style === "popup") remove(); // 팝업 모드는 별도 경고 창이 처리 (중복 방지)
      else show(tone);
      return;
    }
    remove();
  }

  // 확장을 다시 불러오면(개발자 모드 새로고침 등) 이미 열려 있던 탭의 이 스크립트는
  // 무효화된 컨텍스트로 chrome.* 를 호출해 "Extension context invalidated" 오류를 낸다.
  // 모든 chrome 접근을 가드해 조용히 무시하도록 한다.
  const alive = () => {
    return chromeSafe(() => !!(chrome.runtime && chrome.runtime.id), false);
  };

  const read = () => {
    if (!alive()) return;
    chromeSafe(() => {
      chrome.storage.local.get(["session", "settings", "ask"], (o) => {
        // 비동기 콜백이 실행될 때 확장이 이미 무효화됐을 수 있으므로 여기서도 가드한다.
        chromeSafe(() => {
          if (!alive()) return;
          if (chrome.runtime.lastError) return;
          evaluate(o.session, o.settings, o.ask);
        }, null);
      });
    }, null);
  };
  try { read(); } catch {}
  chromeSafe(() => {
    chrome.storage.onChanged.addListener((c) => {
      chromeSafe(() => {
        if (!alive()) return;
        if (c.session || c.settings || c.ask) read();
      }, null);
    });
  }, null);
  // 탭을 보거나 숨길 때마다 다시 판단 (숨은 탭에서는 알림 제거)
  try { document.addEventListener("visibilitychange", () => { try { read(); } catch {} }); } catch {}
})();
