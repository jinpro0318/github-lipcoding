// 탭talk 브리지 — 웹앱(대시보드) origin에만 주입된다.
// 확장(센서)과 웹페이지(대시보드) 사이의 안전한 postMessage 릴레이.
//  - Page → Ext : window.postMessage({source:"tabtalk-page", ...}) → chrome.runtime.sendMessage
//  - Ext → Page : chrome.storage.onChanged 구독 → window.postMessage({source:"tabtalk-ext", ...})
// 확장 ID를 노출하지 않고 동일 출처 메시지만 다루므로 externally_connectable보다 안전하다.
(() => {
  const PAGE = "tabtalk-page";
  const EXT = "tabtalk-ext";
  let extensionAlive = true;

  function markExtensionDead(err) {
    if (!err || !String(err.message || err).includes("Extension context invalidated")) return;
    extensionAlive = false;
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

  // 확장을 다시 불러오면(개발자 모드 새로고침 등) 이미 열려 있던 탭의 이 스크립트는
  // 무효화된 컨텍스트로 chrome.* 를 호출해 "Extension context invalidated" 오류를 낸다.
  // 모든 chrome 접근을 가드해 조용히 무시하도록 한다.
  const alive = () => {
    return chromeSafe(() => !!(chrome.runtime && chrome.runtime.id), false);
  };

  // 확장 상태를 한 번에 모아 페이지로 전달
  function pushState() {
    if (!alive()) return;
    chromeSafe(() => {
      chrome.storage.local.get(["session", "settings", "classification", "domainStats"], (o) => {
        // 비동기 콜백 실행 시점에 확장이 무효화됐을 수 있으므로 여기서도 가드한다.
        chromeSafe(() => {
          if (!alive()) return;
          if (chrome.runtime.lastError) return;
          const payload = {
            session: o.session || null,
            settings: o.settings || null,
            classification: o.classification || null,
            domainStats: o.domainStats || null,
            tabOverview: null
          };
          chrome.runtime.sendMessage({ type: "idle:overview" }, (overview) => {
            chromeSafe(() => {
              if (!alive()) return;
              if (!chrome.runtime.lastError) payload.tabOverview = overview || null;
              window.postMessage({ source: EXT, type: "state", payload }, window.location.origin);
            }, null);
          });
        }, null);
      });
    }, null);
  }

  // 페이지 → 확장: 신뢰할 수 있는 같은 출처 메시지만 받는다
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const msg = e.data;
    if (!msg || msg.source !== PAGE || typeof msg.type !== "string") return;
    if (!alive()) return; // 확장이 사라졌으면 조용히 무시
    if (msg.type === "ext-sync") { pushState(); return; } // 페이지가 최신 상태 요청
    chromeSafe(() => {
      chrome.runtime.sendMessage(msg.payload || { type: msg.type }, () => {
        // 응답 직후 최신 상태를 다시 흘려보냄
        chromeSafe(() => {
          if (!alive()) return;
          if (chrome.runtime.lastError) return;
          pushState();
        }, null);
      });
    }, null);
  });

  // 확장 storage 변경 → 페이지로 자동 전파
  chromeSafe(() => {
    chrome.storage.onChanged.addListener((changes, area) => {
      chromeSafe(() => {
        if (!alive()) return;
        if (area !== "local") return;
        if (changes.session || changes.settings || changes.classification || changes.domainStats) {
          pushState();
        }
      }, null);
    });
  }, null);

  // 로드 시 "확장 있음" 알림 + 초기 상태 전송
  try { window.postMessage({ source: EXT, type: "hello" }, window.location.origin); } catch {}
  pushState();
})();
