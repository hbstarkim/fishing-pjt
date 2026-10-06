// 실제 도로 경로를 한 번만 계산해서 data/routes.json 에 저장합니다.
// 페이지는 이 정적 파일만 읽으므로 방문할 때마다 외부 API를 호출하지 않습니다.
//
//   node scripts/build-routes.mjs
//
// OSRM 공개 데모 서버(키 불필요)를 사용합니다. data.js 좌표를 고친 뒤 다시 실행하세요.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const ctx = { window: {}, encodeURIComponent };
vm.runInNewContext(await readFile(new URL('data.js', root), 'utf8'), ctx);
const { stops, legs } = ctx.window.TRIP;
const byId = Object.fromEntries(stops.map((s) => [s.id, s]));

const routes = {};
for (const leg of legs) {
  if (leg.sea) continue;
  const a = byId[leg.from];
  const b = byId[leg.to];
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { 'User-Agent': 'fishing-trip-page/1.0' } });
  const json = await res.json();
  if (json.code !== 'Ok') {
    console.warn(`✗ ${leg.id}: ${json.code}`);
    continue;
  }
  const r = json.routes[0];
  // [lng,lat] → [lat,lng], 소수점 5자리(약 1m)로 줄이고 점 개수 솎아내기
  const pts = r.geometry.coordinates.map(([x, y]) => [+y.toFixed(5), +x.toFixed(5)]);
  const step = Math.max(1, Math.floor(pts.length / 400));
  routes[leg.id] = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  console.log(`✓ ${leg.id}: ${(r.distance / 1000).toFixed(1)}km, ${Math.round(r.duration / 60)}분`);
  await new Promise((r) => setTimeout(r, 1100)); // 데모 서버 이용 정책: 초당 1회
}

await mkdir(new URL('data/', root), { recursive: true });
await writeFile(new URL('data/routes.json', root), JSON.stringify(routes));
console.log('→ data/routes.json 저장 완료');
