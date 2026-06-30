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
    idle: "주인님, 환영합니다. 준비되시면 집중 세션을 시작해 드릴게요.",
    focus: "주인님, 지금 흐름이 아주 좋으십니다. 그대로 모시겠습니다.",
    helpers: {
      concierge: "주인님, 잠시 다른 곳에 머무르고 계시네요. 원하실 때 모셔다 드릴게요.",
      noljima: "주인님, 1분이 지났어요. 슬슬 자리로 다시 모실까요?",
      teacher: "주인님, 3분째 머무셨어요. 집중 자리로 정중히 안내해 드릴게요.",
      alarm: "주인님, 5분이 지났습니다. 오늘 목표가 주인님을 기다리고 있어요.",
      pleader: "주인님, 충분히 쉬셨다면 이제 멋진 집중을 보여주실 시간이에요."
    },
    welcome: "주인님, 돌아와 주셔서 감사합니다. 바로 집중 자리로 모실게요."
  },
  secretary: {
    label: "다정한 집사",
    idle: "오셨어요? 준비되면 바로 시작할게요. 천천히 하셔도 돼요.",
    focus: "오, 지금 집중력 정말 좋아요. 이대로 쭉 가요!",
    helpers: {
      concierge: "잠깐 한눈파셨네요. 괜찮아요, 같이 돌아가요.",
      noljima: "1분 지났어요. 이제 슬슬 돌아올까요?",
      teacher: "벌써 3분이에요. 우리 다시 집중해봐요.",
      alarm: "5분 지났어요! 할 일이 기다리고 있어요.",
      pleader: "이제 진짜 돌아올 시간이에요. 제가 응원할게요."
    },
    welcome: "돌아왔네요! 잘했어요. 다시 시작해봐요."
  },
  coach: {
    label: "차분한 집사",
    idle: "세션을 시작하면 집중 시간을 측정합니다.",
    focus: "집중 유지 중. 좋은 페이스입니다.",
    helpers: {
      concierge: "집중에서 벗어났습니다. 복귀를 권장합니다.",
      noljima: "1분 경과. 지금 복귀하면 흐름을 살릴 수 있습니다.",
      teacher: "3분 경과. 작업 맥락이 끊기기 시작합니다.",
      alarm: "5분 경과. 목표 진행이 지연되고 있습니다.",
      pleader: "10분 경과. 세션을 재정비할 시점입니다."
    },
    welcome: "복귀 확인. 세션을 이어갑니다."
  },
  manager: {
    label: "열정 집사",
    idle: "자, 시작해볼까요? 오늘도 멋지게 가봅시다!",
    focus: "이야 집중력 미쳤다! 그대로 가즈아!",
    helpers: {
      concierge: "어이쿠 잠깐 새셨네요! 다시 가봅시다!",
      noljima: "1분 컷! 자 돌아와요, 할 수 있어요!",
      teacher: "3분이나! 괜찮아요, 지금부터 다시 달리면 돼요!",
      alarm: "5분 경보! 목표가 손짓하고 있어요, 가즈아!",
      pleader: "10분이면 충분히 쉬었어요! 이제 폭발할 시간!"
    },
    welcome: "돌아왔다! 역시 해낼 줄 알았어요. 가봅시다!"
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
