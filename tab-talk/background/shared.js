// 탭talk — 공유 데이터(톤 멘트·도우미·칭호). 백그라운드/팝업 양쪽에서 사용.

export const HELPERS = [
  { id: "concierge", name: "탭talk 집사", afterSec: 0 },
  { id: "noljima", name: "놀지마AI", afterSec: 60 },
  { id: "teacher", name: "탭선생", afterSec: 180 },
  { id: "alarm", name: "딴짓경보기", afterSec: 300 },
  { id: "pleader", name: "집중호소인", afterSec: 600 }
];

export const TONE = {
  concierge: {
    label: "정중한 집사",
    idle: "주인님, 준비되시면 집중 세션을 시작해 드리겠습니다.",
    focus: "좋습니다, 주인님. 지금 흐름을 차분히 이어가겠습니다.",
    helpers: {
      concierge: "주인님, 잠시 다른 곳에 머무르고 계십니다. 원하시면 바로 안내해 드리겠습니다.",
      noljima: "1분 정도 지나셨습니다, 주인님. 이제 집중 자리로 돌아가 보실까요?",
      teacher: "3분이 지났습니다. 흐름이 끊기기 전에 다시 이어가시길 권해드립니다.",
      alarm: "5분이 지났습니다, 주인님. 오늘 목표를 위해 지금 복귀하시면 좋겠습니다.",
      pleader: "10분이 지났습니다. 쉬는 시간은 충분했으니 다시 집중을 시작해 보시지요."
    },
    welcome: "돌아오셨군요, 주인님. 이어서 집중하실 수 있게 돕겠습니다."
  },
  secretary: {
    label: "다정한 집사",
    idle: "오셨어요? 준비되면 같이 집중을 시작해봐요.",
    focus: "좋아요, 지금 잘 이어가고 있어요. 이 흐름만 지켜봐요.",
    helpers: {
      concierge: "잠깐 다른 곳에 와 있어요. 괜찮아요, 천천히 돌아가면 돼요.",
      noljima: "1분 지났어요. 지금 돌아가면 흐름을 금방 되찾을 수 있어요.",
      teacher: "3분이 지났어요. 우리 다시 하던 일로 살짝 돌아가 볼까요?",
      alarm: "5분이 지났어요. 너무 멀어지기 전에 다시 시작해봐요.",
      pleader: "10분이 지났어요. 여기서 한 번만 마음을 돌려보면 좋아요."
    },
    welcome: "돌아왔네요. 좋아요, 다시 천천히 이어가봐요."
  },
  coach: {
    label: "차분한 집사",
    idle: "세션을 시작하면 집중 흐름을 기록합니다.",
    focus: "집중 유지 중입니다. 현재 페이스가 안정적입니다.",
    helpers: {
      concierge: "집중 범위에서 벗어났습니다. 복귀하면 기록을 이어갈 수 있습니다.",
      noljima: "1분 경과. 지금 복귀하면 작업 맥락을 유지할 수 있습니다.",
      teacher: "3분 경과. 다시 작업 화면으로 돌아가 흐름을 회복해 보세요.",
      alarm: "5분 경과. 목표 시간이 밀리고 있어 복귀를 권장합니다.",
      pleader: "10분 경과. 세션을 계속할지 정하고 다시 정렬할 시점입니다."
    },
    welcome: "복귀 확인. 세션을 이어갑니다."
  },
  manager: {
    label: "열정 집사",
    idle: "좋아요, 준비되면 바로 시작해봅시다. 오늘 흐름 잡아볼게요!",
    focus: "좋습니다! 지금 페이스 아주 좋아요. 그대로 밀고 갑시다!",
    helpers: {
      concierge: "잠깐 방향이 새었네요. 괜찮습니다, 바로 다시 잡아봅시다!",
      noljima: "1분 지났습니다. 지금 돌아오면 흐름을 다시 살릴 수 있어요!",
      teacher: "3분 지났어요. 여기서 바로 복귀하면 아직 충분합니다!",
      alarm: "5분 지났습니다. 목표를 놓치기 전에 다시 달려봅시다!",
      pleader: "10분 지났습니다. 쉬었으니 이제 한 번 제대로 몰입해봅시다!"
    },
    welcome: "좋아요, 돌아왔습니다. 다시 페이스 올려봅시다!"
  }
};

export const TITLES = [
  { min: 0.9, label: "몰입의 신" },
  { min: 0.7, label: "집중 장인" },
  { min: 0.5, label: "균형 마스터" },
  { min: 0.3, label: "흔들리는 갈대" },
  { min: 0, label: "유혹의 탐험가" }
];

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export const GRACE_MS = 10000; // 10초 미만 잠깐 이동은 이탈로 안 셈
