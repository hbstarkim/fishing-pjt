# 안면도 쭈꾸미 원정대 🦑

구매항 · 피싱게이트 바하호 쭈꾸미/갑오징어 낚시 1박 2일 일정 모바일 페이지.
빌드 과정 없는 정적 사이트(HTML/CSS/JS)라 Vercel에 그대로 배포하면 됩니다.

## 구성

| 파일 | 내용 |
| --- | --- |
| `data.js` | **일정·좌표·사진·경로·준비물 데이터 (수정은 여기서만)** |
| `app.js` | 지도/타임라인 렌더링 |
| `styles.css` | 스타일 |
| `vendor/leaflet/` | 지도 라이브러리 Leaflet 1.9.4 (저장소에 포함, CDN 불필요) |
| `scripts/build-routes.mjs` | 실제 도로 경로를 한 번 계산해 `data/routes.json`에 저장 |

## API 키 없이 지도 띄우는 방식

- **지도**: Leaflet + OpenStreetMap 타일 → 키·가입·과금 없음
- **경로선**: `data.js`의 경유점으로 그린 대략적인 선. `node scripts/build-routes.mjs`를 한 번 실행하면
  OSRM(키 불필요)으로 실제 도로 경로를 받아 `data/routes.json`에 저장하고, 페이지는 이 정적 파일만 읽음
  → 방문할 때마다 API를 호출하지 않음
- **길찾기**: 각 일정 카드의 네이버지도/카카오맵 버튼(장소명 검색 링크) → 정확한 위치·내비는 앱에서
- **네이버 전체 경로**: 지도 아래 초록 버튼 → 네이버지도 앱 URL Scheme(`nmap://route/car`)으로 출발·경유지·도착이 채워진 길찾기를 엶 (키 불필요)
- **네이버 경로 캡처**: 앱에서 캡처한 이미지를 `images/`에 넣고 `data.js`의 `routeImages`에 추가하면 지도 아래에 표시
- **사진**: Wikimedia Commons 이미지를 직접 링크 (불러오기 실패 시 이모지 카드로 대체)

## 수정 포인트

- 출발 날짜: `data.js`의 `startDate` (현재 2026-10-23) → D-day + 여행 당일 "지금 여기" 표시
- 좌표는 주소 기준 추정치 — 핀이 어긋나면 `lat/lng` 수정 후 `node scripts/build-routes.mjs` 재실행

## 로컬 실행

```bash
python3 -m http.server 8000   # http://localhost:8000
```
