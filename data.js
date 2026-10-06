// 여행 데이터 — 시간/장소/좌표/사진을 여기서만 고치면 화면 전체에 반영됩니다.
// 좌표는 주소 기준 추정치입니다. 카드의 "네이버/카카오 지도" 버튼은 장소명 검색이라 정확합니다.

// Wikimedia Commons 파일명 → 썸네일 URL (API 키 없음, 브라우저가 직접 불러옴)
const wm = (name, width = 960) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`;
const wmPage = (name) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name.replace(/ /g, '_'))}`;
const photo = (name, caption) => ({ src: wm(name), page: wmPage(name), caption });

window.TRIP = {
  title: '안면도 쭈꾸미 원정대',
  subtitle: '구매항 · 피싱게이트 바하호 새벽 출조 1박 2일',
  // 출발 날짜가 정해지면 'YYYY-MM-DD'로 바꾸세요. D-day와 "지금 여기" 표시가 켜집니다.
  startDate: '2026-10-23',

  stops: [
    {
      id: 'jamsil',
      day: 1, time: '02:00', icon: '🚗',
      title: '잠실 장미아파트 출발',
      who: '나',
      desc: '새벽 2시 출발! 아이스박스·낚시 장비는 전날 밤에 미리 실어두기. 졸음 주의 — 커피·껌 필수.',
      place: '잠실 장미아파트',
      lat: 37.5185, lng: 127.1015,
      photos: [photo('Jamsil Apartment Complex Phase 5 (6196571900).jpg', '새벽의 잠실 아파트 단지')],
    },
    {
      id: 'byeongjeom',
      day: 1, time: '03:30', icon: '🤝',
      title: '병점역에서 친구 픽업',
      who: '친구',
      desc: '1호선 병점역 앞에서 픽업. 바로 서해안고속도로 타고 안면도로 직행.',
      place: '병점역',
      address: '경기 화성시 병점구 떡전골로 97',
      lat: 37.2068, lng: 127.0331,
      photos: [
        photo('Korail-P157-Byeongjeom-station-sign-20181127-105834.jpg', '병점역'),
        photo('StoryWay on Byeongjeom station 20181127 104914.jpg', '병점역'),
      ],
    },
    {
      id: 'port',
      day: 1, time: '05:30', icon: '⚓',
      title: '구매항 도착 · 승선 준비',
      desc: '주차 후 승선명부 작성(신분증 필수). 멀미약은 지금 먹기. 일출(06:49) 전이라 어두우니 헤드랜턴 챙기기.',
      place: '구매항',
      address: '충남 태안군 고남면 구매길 93',
      lat: 36.4155, lng: 126.4290,
      photos: [photo('Port of Anheung, at Taean.jpg', '태안의 어항 풍경 (안흥항)')],
    },
    {
      id: 'boat',
      day: 1, time: '06:00', end: '11:00', icon: '🦑',
      title: '피싱게이트 바하호 출조',
      desc: '천수만 일대에서 쭈꾸미 · 갑오징어 낚시. 08:56 간조 물돌이 전후가 승부처! 바닥 찍고 살살 끌어주기.',
      place: '피싱게이트 바하호',
      lat: 36.3900, lng: 126.4700,
      isSea: true,
      photos: [
        photo('Octopus ocellatus (catch).jpg', '오늘의 목표 ① 쭈꾸미'),
        photo('Golden Cuttlefish (Sepia esculenta) (8475830927).jpg', '오늘의 목표 ② 갑오징어'),
      ],
    },
    {
      id: 'mart',
      day: 1, time: '11:00', end: '15:00', icon: '🛒',
      title: '장보기 · 점심 · 놀기',
      desc: '하선 후 점심 먹고 하나로마트에서 저녁 바베큐 고기·채소·술·얼음 장보기. 남는 시간은 자유롭게 안면도 구경. (마트 영업 08:30~19:00)',
      place: '하나로마트 안면도농협 고남점',
      address: '충남 태안군 고남면 안면대로 4223',
      lat: 36.4260, lng: 126.4060,
      photos: [
        photo('Hanaro Mart a standing board in Seongnam.jpg', '농협 하나로마트'),
        photo('Nonghyup HanaroMart.jpg', '농협 하나로마트'),
      ],
    },
    {
      id: 'pension',
      day: 1, time: '15:00', icon: '🛏',
      title: '바하캘리포니아펜션 체크인 · 휴식',
      desc: '체크인하고 새벽 출조 피로 풀기. 잡은 쭈꾸미 손질해두고 낮잠 한숨.',
      place: '바하캘리포니아펜션',
      address: '충남 태안군 고남면 구매길 21 · 010-2906-1253',
      mapQuery: '안면도 바하캘리포니아펜션',
      lat: 36.4172, lng: 126.4215,
      photos: [photo('꽃지의석양.jpg', '안면도의 오후 (꽃지)')],
    },
    {
      id: 'bbq',
      day: 1, time: '18:00', icon: '🍖',
      title: '바베큐 + 음주',
      desc: '잡은 쭈꾸미는 샤브샤브·라면으로, 고기는 숯불에. 🍻',
      place: '바하캘리포니아펜션',
      mapQuery: '안면도 바하캘리포니아펜션',
      lat: 36.4172, lng: 126.4215,
      noPin: true,
      photos: [
        photo('Korean barbecue - moksal, samgyeopsal, beoseot, and meljeot on a gridiron.jpg', '숯불 바베큐'),
        photo('Korean barbecue-Samgyeopsal-08.jpg', '삼겹살'),
      ],
    },
    {
      id: 'game',
      day: 1, time: '21:00', icon: '🎮',
      title: '노트북 게임 타임',
      desc: '바베큐 정리하고 각자 가져온 노트북으로 게임. 다음날 해장 있으니 적당히…? (멀티탭 · 마우스 · 충전기 챙기기)',
      place: '바하캘리포니아펜션',
      mapQuery: '안면도 바하캘리포니아펜션',
      lat: 36.4172, lng: 126.4215,
      noPin: true,
      photos: [photo('Winter 2004 DreamHack LAN Party.jpg', '오늘 밤은 펜션 PC방 (예시 사진)')],
    },
    {
      id: 'gegukji',
      day: 2, time: '09:00', icon: '🍲',
      title: '딴뚝통나무집식당 게국지 해장',
      desc: '안면도 게국지 원조집(백년가게). 게국지 + 간장게장 정식으로 속 풀기. 09:00 오픈이라 오픈런!',
      place: '딴뚝통나무집식당',
      mapQuery: '안면도 딴뚝통나무집식당',
      address: '충남 태안군 안면읍 조운막터길 23-22 · 041-673-1645',
      lat: 36.5095, lng: 126.3560,
      photos: [photo('서산 9미 게국지.jpg', '게국지')],
    },
    {
      id: 'bye',
      day: 2, time: '10:30', icon: '🚌',
      title: '안면도버스터미널에서 해산',
      desc: '친구를 터미널에 내려주고 원정 마무리! 버스 시간은 미리 확인. 나는 하루 더 놀기 (일정 미정)',
      place: '안면도버스터미널',
      mapQuery: '안면버스터미널',
      address: '충남 태안군 안면읍 장터로 126-1',
      lat: 36.5120, lng: 126.3530,
      photos: [photo('꽃지의석양.jpg', '나는 하루 더 · 꽃지 노을')],
    },
  ],

  // 지도 경로 (시간대별 색상). path는 대략적인 도로 경유점이며,
  // scripts/build-routes.mjs 를 한 번 실행하면 data/routes.json 에 실제 도로 경로가 저장되어 자동으로 대체됩니다.
  legs: [
    {
      id: 'leg1', from: 'jamsil', to: 'byeongjeom', label: '02:00 → 03:30 · 잠실 → 병점',
      color: '#5e35b1',
      path: [[37.5185, 127.1015], [37.4935, 127.0720], [37.4690, 127.0390], [37.4000, 127.1000],
             [37.2830, 127.1040], [37.2300, 127.0750], [37.2068, 127.0331]],
    },
    {
      id: 'leg2', from: 'byeongjeom', to: 'port', label: '03:30 → 05:30 · 병점 → 구매항',
      color: '#3f7fe0',
      path: [[37.2068, 127.0331], [37.2000, 126.9550], [37.1350, 126.9350], [37.0500, 126.9000],
             [36.9950, 126.8550], [36.9750, 126.8250], [36.9600, 126.7960], [36.9150, 126.7300],
             [36.8500, 126.6900], [36.7700, 126.5600], [36.7000, 126.5500], [36.6300, 126.4600],
             [36.6100, 126.4200], [36.5800, 126.3700], [36.5550, 126.3350], [36.5300, 126.3400],
             [36.5080, 126.3510], [36.4700, 126.3700], [36.4400, 126.3900], [36.4260, 126.4060],
             [36.4200, 126.4150], [36.4172, 126.4215], [36.4155, 126.4290]],
    },
    {
      id: 'sea', from: 'port', to: 'port', label: '06:00 → 11:00 · 바하호 선상낚시',
      color: '#00a3c4', sea: true,
      path: [[36.4155, 126.4290], [36.4050, 126.4550], [36.3900, 126.4700], [36.3700, 126.4800],
             [36.3600, 126.4600], [36.3800, 126.4450], [36.4000, 126.4400], [36.4155, 126.4290]],
    },
    {
      id: 'leg3', from: 'port', to: 'mart', label: '11:00 → 15:00 · 점심 · 장보기 · 놀기',
      color: '#f5a000',
      path: [[36.4155, 126.4290], [36.4172, 126.4215], [36.4200, 126.4150], [36.4260, 126.4060]],
    },
    {
      id: 'leg4', from: 'mart', to: 'pension', label: '15:00 · 마트 → 펜션 체크인',
      color: '#e53950',
      path: [[36.4260, 126.4060], [36.4200, 126.4150], [36.4172, 126.4215]],
    },
    {
      id: 'leg6', from: 'pension', to: 'gegukji', label: '08:40 → 09:00 · 펜션 → 딴뚝식당',
      color: '#8d6e63', day: 2,
      path: [[36.4172, 126.4215], [36.4200, 126.4150], [36.4260, 126.4060], [36.4400, 126.3900],
             [36.4700, 126.3700], [36.5050, 126.3520], [36.5095, 126.3560]],
    },
    {
      id: 'leg7', from: 'gegukji', to: 'bye', label: '10:20 → 10:30 · 딴뚝식당 → 버스터미널',
      color: '#5c6bc0', day: 2,
      path: [[36.5095, 126.3560], [36.5110, 126.3545], [36.5120, 126.3530]],
    },
  ],

  // 출조일 물때 (바다타임 영목항 기준 — 구매항에서 가장 가까운 관측 지점)
  // 만조·간조 시각/조위만 실제 값이고, 그 사이 곡선은 코사인 보간한 추정치입니다.
  tide: {
    date: '10월 23일 (금)',
    mul: '4물',
    mulNote: '4물은 조금 이후 사리 쪽으로 물살이 점점 세지는 중간 물때예요. 조차가 커지는 만큼 물흐름도 살아 있는 편.',
    station: '영목항',
    extremes: [
      { t: '02:28', cm: 717, type: 'high' },
      { t: '08:56', cm: 215, type: 'low' },
      { t: '14:56', cm: 729, type: 'high' },
      { t: '21:08', cm: 181, type: 'low' },
    ],
    // 곡선 양 끝을 그리기 위한 전날/다음날 추정 극값 (표시는 안 함)
    edges: [{ t: '-03:40', cm: 190 }, { t: '27:15', cm: 720 }],
    sunrise: '06:49',
    sunset: '17:46',
    window: { from: '06:00', to: '11:00', label: '바하호 출조' },
    source: { label: '바다타임 · 영목항 물때표', url: 'https://www.badatime.com/354/daily' },
  },

  // 네이버지도 앱 길찾기 버튼 (URL Scheme, API 키 불필요). 출발 → 경유지(최대 5곳) → 도착
  naverRoutes: [
    { label: '1일차 새벽 이동', stops: ['jamsil', 'byeongjeom', 'port'] },
    { label: '하선 후 마트 → 펜션', stops: ['port', 'mart', 'pension'] },
    { label: '2일차 해장 → 터미널', stops: ['pension', 'gegukji', 'bye'] },
  ],

  // 네이버지도에서 캡처한 경로 이미지. images/ 폴더에 넣고 여기에 추가하면 지도 아래에 표시됩니다.
  // 예: { src: 'images/naver-day1.jpg', caption: '1일차 · 잠실 → 구매항 (네이버지도)' }
  routeImages: [],

  checklist: [
    '신분증 (승선명부 필수)',
    '멀미약 — 출항 30분 전 (05:30 도착하면 바로)',
    '헤드랜턴 (일출 06:49 전 출항)',
    '쭈꾸미·갑오징어 에기, 봉돌 (선사 대여 여부 확인)',
    '낚시 장갑 · 모자 · 선글라스 · 선크림',
    '방한복 · 우비 (10월 새벽 바다는 꽤 춥다)',
    '아이스박스 + 얼음 + 지퍼백',
    '보조배터리',
    '바베큐 고기 · 쌈채소 · 술 · 라면',
    '노트북 · 충전기 · 마우스 · 멀티탭',
  ],
};
