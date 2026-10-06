(() => {
  const T = window.TRIP;
  const byId = Object.fromEntries(T.stops.map((s) => [s.id, s]));
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = document.documentElement;
  const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();

  const desktopMQ = matchMedia('(min-width: 960px)');
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  const isDesktop = () => desktopMQ.matches;
  const smooth = () => (reduceMQ.matches ? 'auto' : 'smooth');

  /* ---------------- 시각 (?now=2026-10-23T04:50 으로 여행 당일 미리보기) ---------------- */
  const nowParam = new URLSearchParams(location.search).get('now');
  const loadedAt = Date.now();
  const simBase = nowParam ? new Date(/([zZ]|[+-]\d\d:?\d\d)$/.test(nowParam) ? nowParam : `${nowParam}+09:00`) : null;
  const now = () => (simBase && !isNaN(simBase) ? new Date(simBase.getTime() + (Date.now() - loadedAt)) : new Date());

  const start = T.startDate ? new Date(`${T.startDate}T00:00:00+09:00`) : null;
  const atTime = (day, hm) => {
    const [h, m] = hm.split(':').map(Number);
    return new Date(start.getTime() + (day - 1) * 864e5 + (h * 60 + m) * 6e4);
  };
  const stopDate = (s) => (start ? atTime(s.day, s.time) : null);
  const stopEnd = (s) => (start && s.end ? atTime(s.day, s.end) : null);

  // 각 일정의 색 = 그 일정으로 "도착하는" 경로의 색 (시간대별 색상)
  const colorOf = {};
  T.legs.forEach((l) => { if (!l.sea && !colorOf[l.to]) colorOf[l.to] = l.color; });
  colorOf.jamsil = T.legs[0].color;
  colorOf.boat = T.legs.find((l) => l.sea)?.color || '#1e88e5';
  colorOf.bbq = '#e53950';
  colorOf.game = '#ab47bc';

  /* ---------------- 토스트 ---------------- */
  let toastT;
  const toast = (msg, ms = 1800) => {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.hidden = true; }, ms);
  };

  /* ---------------- header ---------------- */
  $('#trip-title').textContent = T.title;
  $('#trip-subtitle').textContent = T.subtitle;
  document.title = T.title;
  const boat = T.stops.find((s) => s.isSea);
  if (boat) $('#boat-chip').textContent = `⛴ ${boat.time}–${boat.end}`;

  function updateDday(t) {
    if (!start) return;
    const chip = $('#dday-chip');
    const days = Math.ceil((start - t) / 864e5);
    const fmt = start.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
    chip.classList.toggle('live', days <= 0 && days > -2);
    if (days > 0) chip.textContent = `📅 ${fmt} · D-${days}`;
    else if (days > -2) chip.textContent = '🔥 여행 중!';
    else chip.textContent = `📅 ${fmt} · 다녀옴`;
  }

  // 지금 진행 중인 일정 = 시작 시각이 지난 마지막 일정 (마지막 일정 후 6시간까지)
  function computeNowStop(t) {
    if (!start) return null;
    let id = null;
    T.stops.forEach((s) => { if (stopDate(s) <= t) id = s.id; });
    const last = T.stops[T.stops.length - 1];
    if (t - (stopEnd(last) || stopDate(last)) > 6 * 36e5) return null;
    return id;
  }
  let nowStopId = computeNowStop(now());

  /* ---------------- 테마 (자동 / 라이트 / 다크) ---------------- */
  const THEME_KEY = 'trip-theme';
  const themeLabel = { auto: '🌓 자동', light: '☀️ 라이트', dark: '🌙 다크' };
  let mapReady = false;
  function applyTheme(pref) {
    const dark = pref === 'dark' || (pref === 'auto' && darkMQ.matches);
    root.dataset.mode = dark ? 'dark' : 'light';
    root.dataset.pref = pref;
    $('#theme-btn').textContent = themeLabel[pref];
    $('meta[name="theme-color"]').content = dark ? '#0c131e' : '#0b2545';
    if (mapReady) drawLegs(); // 경로 테두리 색을 배경에 맞춤
  }
  let themePref = root.dataset.pref || 'auto';
  $('#theme-btn').addEventListener('click', () => {
    themePref = { auto: 'light', light: 'dark', dark: 'auto' }[themePref];
    try { localStorage.setItem(THEME_KEY, themePref); } catch {}
    applyTheme(themePref);
    toast(`화면 테마: ${themeLabel[themePref]}`);
  });
  darkMQ.addEventListener('change', () => { if (themePref === 'auto') applyTheme('auto'); });
  applyTheme(themePref);

  /* ---------------- map ---------------- */
  const map = L.map('map', { zoomControl: false, attributionControl: true, tap: true });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  }).addTo(map);

  // 사용자가 지도를 직접 만지는 중에는 스크롤 연동으로 지도를 옮기지 않음
  let lastUserMap = 0;
  ['mousedown', 'touchstart', 'wheel'].forEach((ev) =>
    $('#map').addEventListener(ev, () => { lastUserMap = Date.now(); }, { passive: true }));
  const flyTo = (ll, z) => (reduceMQ.matches ? map.setView(ll, z) : map.flyTo(ll, z, { duration: 0.8 }));

  const markers = {};
  T.stops.forEach((s, i) => {
    if (s.noPin) return; // 같은 장소의 다른 일정(예: 펜션 바베큐·게임)은 핀을 공유
    const icon = L.divIcon({
      className: '',
      html: `<div class="pin${s.id === nowStopId ? ' now' : ''}" data-pin="${s.id}" style="background:${colorOf[s.id]}"><span>${s.icon}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [4, 36],
      popupAnchor: [14, -34],
    });
    markers[s.id] = L.marker([s.lat, s.lng], { icon, riseOnHover: true, zIndexOffset: 1000 - i })
      .bindPopup(
        `<div class="popup-time">Day ${s.day} · ${s.time}${s.end ? ` – ${s.end}` : ''}</div>
         <div class="popup-title">${esc(s.title)}</div>
         <button class="popup-link" data-goto="${s.id}">일정 보기 ↓</button>`,
      )
      .addTo(map);
  });
  T.stops.filter((s) => s.noPin).forEach((s) => {
    const twin = T.stops.find((o) => !o.noPin && o.lat === s.lat && o.lng === s.lng);
    if (twin) markers[s.id] = markers[twin.id];
  });

  // 점심 후보 등 선택지 — 작은 🍽 핀
  const optById = {};
  const optMarkers = {};
  T.stops.forEach((s) => (s.options || []).forEach((o) => {
    optById[o.id] = { ...o, stopId: s.id };
    optMarkers[o.id] = L.marker([o.lat, o.lng], {
      icon: L.divIcon({ className: '', html: `<div class="mini-pin${o.pick ? ' pick' : ''}">🍽</div>`, iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12] }),
      zIndexOffset: -100,
    })
      .bindPopup(
        `<div class="popup-time">점심 후보 · ${esc(o.area)}</div>
         <div class="popup-title">${esc(o.name)}</div>
         <div class="popup-time" style="margin:-4px 0 8px">${esc(o.menu)}</div>
         <button class="popup-link" data-goto-opt="${o.id}">후보 보기 ↓</button>`,
      )
      .addTo(map);
  }));

  const pinEl = (id) => markers[id]?.getElement()?.querySelector('.pin');
  let activePinId = null;
  function setActivePin(id) {
    if (activePinId) pinEl(activePinId)?.classList.remove('active');
    activePinId = id;
    pinEl(id)?.classList.add('active');
  }

  const lines = {};
  let routes = {};
  function drawLegs() {
    Object.values(lines).forEach((l) => l.remove());
    const casingColor = css('--casing') || '#fff';
    T.legs.forEach((leg) => {
      const pts = routes[leg.id] || leg.path;
      // 테두리 + 색 선 두 겹으로 그려서 지도 위에서 잘 보이게
      const casing = L.polyline(pts, { color: casingColor, weight: 8, opacity: 0.9, interactive: false });
      const line = L.polyline(pts, {
        color: leg.color, weight: 5, opacity: 0.95,
        dashArray: leg.sea ? '2 10' : null, lineCap: 'round',
      }).bindTooltip(leg.label, { sticky: true });
      lines[leg.id] = L.layerGroup([casing, line]).addTo(map);
    });
  }
  drawLegs();
  mapReady = true;

  // scripts/build-routes.mjs 로 미리 만들어 둔 실제 도로 경로가 있으면 교체 (정적 파일, API 호출 없음)
  fetch('data/routes.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      if (!json) return;
      routes = json;
      drawLegs();
      $('#map-note').textContent = '경로는 실제 도로 기준(OSRM)으로 미리 계산해 둔 경로예요.';
    })
    .catch(() => {});

  const boundsFor = (day) => {
    if (day === 'island') {
      const pts = T.stops.filter((s) => s.lat < 36.6).map((s) => [s.lat, s.lng]);
      Object.values(optById).forEach((o) => pts.push([o.lat, o.lng]));
      return L.latLngBounds(pts);
    }
    const pts = [];
    T.stops.filter((s) => day === 'all' || s.day === Number(day)).forEach((s) => pts.push([s.lat, s.lng]));
    T.legs.filter((l) => day === 'all' || (l.day || 1) === Number(day)).forEach((l) => pts.push(...l.path));
    return L.latLngBounds(pts);
  };
  let currentFit = 'all';
  const fit = (day) => { currentFit = day; map.fitBounds(boundsFor(day), { padding: [28, 28] }); };
  fit('all');

  $$('.seg-btn').forEach((b) =>
    b.addEventListener('click', () => {
      $$('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      lastUserMap = Date.now();
      fit(b.dataset.day);
    }),
  );

  // 범례: 누르면 해당 구간으로 이동
  $('#legend').innerHTML = T.legs
    .map((l) => `<li><button data-leg="${l.id}" style="color:${l.color}">
        <i class="sw${l.sea ? ' dashed' : ''}" style="background:${l.color}"></i>
        <span style="color:var(--ink)">${esc(l.label)}</span></button></li>`)
    .join('');
  $('#legend').addEventListener('click', (e) => {
    const b = e.target.closest('[data-leg]');
    if (!b) return;
    const leg = T.legs.find((l) => l.id === b.dataset.leg);
    lastUserMap = Date.now();
    map.fitBounds(L.latLngBounds(leg.path), { padding: [40, 40], maxZoom: 13 });
  });

  // 내 위치 (브라우저 기본 기능, 외부 API 없음)
  let me;
  $('#locate-btn').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('이 브라우저는 위치 기능을 지원하지 않아요.');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const ll = [coords.latitude, coords.longitude];
        if (me) me.setLatLng(ll);
        else me = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#ff6b4a', fillOpacity: 1 }).addTo(map).bindTooltip('나');
        lastUserMap = Date.now();
        map.setView(ll, 13);
      },
      () => toast('위치를 가져오지 못했어요.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });

  /* ---------------- 물때 그래프 ---------------- */
  const toH = (hm) => {
    const neg = hm.startsWith('-');
    const [h, m] = hm.replace('-', '').split(':').map(Number);
    return (neg ? -1 : 1) * (h + m / 60);
  };
  const fmtH = (x) => {
    const m = Math.round(x * 60);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  function renderTide() {
    const td = T.tide;
    if (!td) return;
    $('#sec-tide').hidden = false;
    $('#tide-mul').textContent = td.mul;
    if (td.mulNote) $('#tide-mulnote').textContent = td.mulNote;
    $('#tide-sub').innerHTML = `${esc(td.date)} · ${esc(td.station)} 기준 · <a href="${td.source.url}" target="_blank" rel="noopener">${esc(td.source.label)} ↗</a>`;

    const ext = td.extremes.map((e) => ({ ...e, h: toH(e.t) }));
    const knots = [...td.edges.map((e) => ({ ...e, h: toH(e.t) })), ...ext].sort((a, b) => a.h - b.h);
    // 만조·간조 사이를 반주기 코사인으로 보간
    const level = (x) => {
      for (let i = 0; i < knots.length - 1; i++) {
        const a = knots[i], b = knots[i + 1];
        if (x >= a.h && x <= b.h) return a.cm + (b.cm - a.cm) * (1 - Math.cos(Math.PI * (x - a.h) / (b.h - a.h))) / 2;
      }
      return knots[knots.length - 1].cm;
    };
    const rising = (x) => level(x + 0.05) > level(x);

    const highs = ext.filter((e) => e.type === 'high');
    const lows = ext.filter((e) => e.type === 'low');
    const range = (Math.max(...ext.map((e) => e.cm)) - Math.min(...ext.map((e) => e.cm))) / 100;
    const w0 = toH(td.window.from), w1 = toH(td.window.to);
    $('#tide-stats').innerHTML = `
      <div><dt>만조</dt><dd>${highs.map((e) => e.t).join('<br>')}</dd></div>
      <div><dt>간조</dt><dd>${lows.map((e) => e.t).join('<br>')}</dd></div>
      <div><dt>최대 조차</dt><dd>${range.toFixed(1)}<small>m</small></dd></div>`;
    const inWin = ext.filter((e) => e.h >= w0 && e.h <= w1);
    $('#tide-note').innerHTML = `⛴ <b>${td.window.from}–${td.window.to} 출조</b> · ` + (inWin.length
      ? inWin.map((e) => `${e.t} ${e.type === 'high' ? '만조' : '간조'}(${(e.cm / 100).toFixed(1)}m)`).join(', ') +
        ` 전후로 물이 돌아요. ${rising(w0) ? '들물' : '날물'}로 시작해 ${rising(w1 - 0.01) ? '들물' : '날물'}로 마무리.`
      : `${rising(w0) ? '들물' : '날물'} 구간이에요.`);

    // --- SVG (색은 CSS 변수라 라이트/다크 전환 시 다시 그릴 필요 없음) ---
    const box = $('#tide-chart');
    const W = Math.max(300, box.clientWidth);
    const H = 190;
    const M = { l: 30, r: 8, t: 26, b: 22 };
    const iw = W - M.l - M.r, ih = H - M.t - M.b;
    const yMax = Math.ceil(Math.max(...knots.map((k) => k.cm)) / 200) * 200;
    const X = (h) => M.l + (h / 24) * iw;
    const Y = (cm) => M.t + ih - (cm / yMax) * ih;
    const pts = [];
    for (let m = 0; m <= 24 * 60; m += 10) pts.push([X(m / 60), Y(level(m / 60))]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const area = `${line}L${X(24)},${Y(0)}L${X(0)},${Y(0)}Z`;
    const sr = toH(td.sunrise), ss = toH(td.sunset);

    let g = '';
    // 밤 시간대 (일출 전 / 일몰 후)
    g += `<rect x="${X(0)}" y="${M.t}" width="${X(sr) - X(0)}" height="${ih}" style="fill:var(--night-wash)"/>`;
    g += `<rect x="${X(ss)}" y="${M.t}" width="${X(24) - X(ss)}" height="${ih}" style="fill:var(--night-wash)"/>`;
    // 출조 시간대
    g += `<rect x="${X(w0)}" y="${M.t}" width="${X(w1) - X(w0)}" height="${ih}" rx="4" style="fill:var(--band)"/>`;
    g += `<text class="band-lbl" x="${(X(w0) + X(w1)) / 2}" y="${M.t - 8}" text-anchor="middle">${esc(td.window.label)}</text>`;
    // y 그리드 (m)
    for (let v = 0; v <= yMax; v += 200) {
      g += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--tide-grid)" stroke-width="1"/>`;
      g += `<text x="${M.l - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v / 100}m</text>`;
    }
    // x 축 (시각)
    [0, 6, 12, 18, 24].forEach((h) => {
      g += `<text x="${X(h)}" y="${H - 6}" text-anchor="${h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}">${h}시</text>`;
    });
    g += `<text x="${X(sr)}" y="${M.t + ih - 4}" text-anchor="middle">☀︎ ${td.sunrise}</text>`;
    g += `<text x="${X(ss)}" y="${M.t + ih - 4}" text-anchor="middle">☾ ${td.sunset}</text>`;
    // 곡선
    g += `<path d="${area}" style="fill:var(--tide)" opacity=".1"/>`;
    g += `<path d="${line}" fill="none" style="stroke:var(--tide)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    // 만조·간조 점 + 라벨
    ext.forEach((e) => {
      const x = X(e.h), y = Y(e.cm);
      const up = e.type === 'high';
      const anchor = x < M.l + 30 ? 'start' : x > W - M.r - 30 ? 'end' : 'middle';
      g += `<circle cx="${x}" cy="${y}" r="4.5" style="fill:var(--tide);stroke:var(--card)" stroke-width="2"/>`;
      g += `<text class="lbl" x="${x}" y="${up ? y - 9 : y + 17}" text-anchor="${anchor}">${e.t} ${(e.cm / 100).toFixed(1)}m</text>`;
    });
    // hover 레이어
    g += `<line id="tide-x" x1="0" x2="0" y1="${M.t}" y2="${M.t + ih}" style="stroke:var(--ink)" stroke-width="1" opacity="0"/>`;
    g += `<circle id="tide-dot" r="5" style="fill:var(--tide);stroke:var(--card)" stroke-width="2" opacity="0"/>`;
    g += `<rect x="${M.l}" y="0" width="${iw}" height="${H}" fill="transparent"/>`;

    box.querySelector('svg')?.remove();
    box.insertAdjacentHTML('afterbegin',
      `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(td.date)} ${esc(td.station)} 조위 그래프: 만조 ${highs.map((e) => e.t).join(', ')}, 간조 ${lows.map((e) => e.t).join(', ')}">${g}</svg>`);

    const svg = box.querySelector('svg');
    const tip = $('#tide-tip');
    const vx = $('#tide-x'), dot = $('#tide-dot');
    const show = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const h = Math.min(24, Math.max(0, ((px - M.l) / iw) * 24));
      const hh = Math.round(h * 6) / 6; // 10분 단위
      const cm = level(hh);
      const x = X(hh);
      vx.setAttribute('x1', x); vx.setAttribute('x2', x); vx.setAttribute('opacity', '.35');
      dot.setAttribute('cx', x); dot.setAttribute('cy', Y(cm)); dot.setAttribute('opacity', '1');
      tip.hidden = false;
      tip.textContent = `${fmtH(hh)} · ${(cm / 100).toFixed(1)}m · ${rising(hh) ? '들물 ↑' : '날물 ↓'}`;
      tip.style.left = `${Math.min(Math.max((x / W) * r.width, 70), r.width - 70)}px`;
      tip.style.top = `${(Y(cm) / H) * r.height - 34}px`;
    };
    const hide = () => { tip.hidden = true; vx.setAttribute('opacity', '0'); dot.setAttribute('opacity', '0'); };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
  }
  renderTide();

  /* ---------------- 네이버지도 앱 길찾기 (URL Scheme) ---------------- */
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const nmapRoute = (ids) => {
    const pts = ids.map((id) => byId[id]);
    const s = pts[0];
    const d = pts[pts.length - 1];
    const q = new URLSearchParams({
      slat: s.lat, slng: s.lng, sname: s.place,
      dlat: d.lat, dlng: d.lng, dname: d.place,
    });
    pts.slice(1, -1).slice(0, 5).forEach((v, i) => {
      q.set(`v${i + 1}lat`, v.lat);
      q.set(`v${i + 1}lng`, v.lng);
      q.set(`v${i + 1}name`, v.place);
    });
    q.set('appname', location.hostname || 'fishing-trip');
    // URLSearchParams는 공백을 '+'로 바꾸는데 앱에 따라 그대로 보이므로 %20으로
    return `nmap://route/car?${q.toString().replace(/\+/g, '%20')}`;
  };
  $('#naver-routes').innerHTML = (T.naverRoutes || [])
    .map((r, i) => `<button class="naver-btn" data-nroute="${i}"><b>N</b>${esc(r.label)}</button>`)
    .join('');
  $('#naver-routes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nroute]');
    if (!b) return;
    const r = T.naverRoutes[b.dataset.nroute];
    if (!isMobile) {
      toast('네이버지도 앱 길찾기는 휴대폰에서 열 수 있어요.', 2400);
      return;
    }
    location.href = nmapRoute(r.stops);
    // 앱이 없으면 페이지가 그대로 남아 있으므로 스토어로 안내
    setTimeout(() => {
      if (document.hidden) return;
      location.href = /Android/i.test(navigator.userAgent)
        ? 'market://details?id=com.nhn.android.nmap'
        : 'https://apps.apple.com/kr/app/id311867728';
    }, 1800);
  });

  // 네이버지도 캡처 이미지
  if ((T.routeImages || []).length) {
    $('#shots').innerHTML = T.routeImages
      .map((im) => `<figure><a href="${im.src}" target="_blank"><img src="${im.src}" alt="${esc(im.caption)}" loading="lazy"></a><figcaption>${esc(im.caption)}</figcaption></figure>`)
      .join('');
    $('#route-shots').hidden = false;
  }

  /* ---------------- timeline (접히는 카드) ---------------- */
  const mapLinks = (s) => {
    const q = encodeURIComponent(s.mapQuery || s.place);
    return {
      naver: `https://map.naver.com/p/search/${q}`,
      kakao: `https://map.kakao.com/link/search/${q}`,
    };
  };
  const withWidth = (src, w) => (w ? src.replace(/width=\d+/, `width=${w}`) : src);

  // 후보 사진을 순서대로 시도하고, 전부 실패하면 이모지로 대체 (data-cands)
  function figure(s, candidates) {
    if (!candidates.length) return `<figure class="photo fallback">${s.icon}</figure>`;
    const [first] = candidates;
    return `<figure class="photo" data-cands="${esc(JSON.stringify(candidates))}" data-i="0" data-icon="${s.icon}">
        <img src="${first.src}" alt="${esc(first.caption)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        <figcaption><a href="${first.page}" target="_blank" rel="noopener">${esc(first.caption)} ↗</a></figcaption>
      </figure>`;
  }
  const photoHTML = (s) => {
    const ps = s.photos || [];
    if (s.isSea && ps.length > 1) return `<div class="photos two">${ps.map((p) => figure(s, [p])).join('')}</div>`;
    return `<div class="photos">${figure(s, ps)}</div>`;
  };
  function thumbHTML(s) {
    const ps = s.photos || [];
    if (!ps.length) return `<span class="thumb" aria-hidden="true">${s.icon}</span>`;
    return `<span class="thumb" aria-hidden="true" data-cands="${esc(JSON.stringify(ps))}" data-i="0" data-icon="${s.icon}" data-w="240">
        <img src="${withWidth(ps[0].src, 240)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`;
  }

  // 점심 후보 목록 (지역별로 묶어서)
  function optionsHTML(s) {
    if (!s.options?.length) return '';
    const areas = [...new Set(s.options.map((o) => o.area))];
    return `<div class="opts">
      <h4>🍽 점심 후보 <span>${s.options.length}곳</span></h4>
      ${areas.map((a) => `<p class="opt-area">${esc(a)}</p>
        <ul>${s.options.filter((o) => o.area === a).map((o) => {
          const l = mapLinks({ place: o.name, mapQuery: o.mapQuery });
          return `<li class="opt${o.pick ? ' pick' : ''}" id="opt-${o.id}">
            <div class="opt-name">${esc(o.name)}${o.pick ? '<span class="opt-badge">추천</span>' : ''}</div>
            <p class="opt-menu">${esc(o.menu)}</p>
            <p class="opt-meta">⏰ ${esc(o.hours)}<br>💡 ${esc(o.note)} · ${esc(o.address)}</p>
            <div class="opt-actions">
              <button class="btn" data-fly-opt="${o.id}">🗺 위치</button>
              <a class="btn naver" href="${l.naver}" target="_blank" rel="noopener">네이버</a>
              <a class="btn kakao" href="${l.kakao}" target="_blank" rel="noopener">카카오</a>
            </div>
          </li>`;
        }).join('')}</ul>`).join('')}
    </div>`;
  }

  function cardHTML(s) {
    const links = mapLinks(s);
    const sub = [
      s.place,
      s.options ? `🍽 점심 후보 ${s.options.length}곳` : '',
      s.steps ? `🔪 손질 ${s.steps.length}단계` : '',
    ].filter(Boolean).join(' · ');
    const isNow = s.id === nowStopId;
    return `<li class="tl-item${isNow ? ' is-now' : ''}" id="stop-${s.id}" data-id="${s.id}" style="--c:${colorOf[s.id]}">
      <div class="tl-dot" aria-hidden="true">${s.icon}</div>
      <article class="card tl-card">
        <button class="tl-head" type="button" aria-expanded="false" aria-controls="det-${s.id}">
          ${thumbHTML(s)}
          <span class="tl-head-text">
            <span class="tl-time">${s.time}${s.end ? ` – ${s.end}` : ''}${s.who ? `<span class="tl-who">${esc(s.who)}</span>` : ''}${isNow ? '<span class="now-badge">지금 여기</span>' : ''}</span>
            <span class="tl-title">${esc(s.title)}</span>
            <span class="tl-sub">${esc(sub)}</span>
          </span>
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        <div class="tl-detail" id="det-${s.id}" inert>
          <div class="tl-detail-inner">
            ${photoHTML(s)}
            <div class="tl-body">
              <p class="tl-desc">${esc(s.desc)}</p>
              ${s.steps ? `<ol class="tl-steps">${s.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
              ${s.tips ? `<ul class="tl-tips">${s.tips.map((t) => `<li>💡 ${esc(t)}</li>`).join('')}</ul>` : ''}
              ${s.address ? `<p class="tl-addr">📍 ${esc(s.address)}</p>` : ''}
              <div class="tl-actions">
                <button class="btn primary" data-fly="${s.id}">🗺 위치 보기</button>
                ${s.isSea ? '' : `<a class="btn naver" href="${links.naver}" target="_blank" rel="noopener">네이버지도</a>
                <a class="btn kakao" href="${links.kakao}" target="_blank" rel="noopener">카카오맵</a>`}
              </div>
              ${optionsHTML(s)}
            </div>
          </div>
        </div>
      </article>
    </li>`;
  }

  const days = [...new Set(T.stops.map((s) => s.day))];
  const dayLabel = { 1: '첫째 날', 2: '둘째 날' };
  const dayDate = (d) => (start ? ' · ' + new Date(start.getTime() + (d - 1) * 864e5).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }) : '');
  $('#timeline').innerHTML = days
    .map((d) => `<section class="day" aria-label="Day ${d}">
        <div class="day-head"><h3>Day ${d}</h3><span>${dayLabel[d] || ''}${dayDate(d)}</span></div>
        <ol class="tl">${T.stops.filter((s) => s.day === d).map(cardHTML).join('')}</ol>
      </section>`)
    .join('');

  const items = $$('.tl-item');
  function setOpen(item, open) {
    item.classList.toggle('open', open);
    item.querySelector('.tl-head').setAttribute('aria-expanded', open);
    item.querySelector('.tl-detail').inert = !open;
  }
  const syncToggleAll = () => {
    $('#toggle-all').textContent = items.every((i) => i.classList.contains('open')) ? '모두 접기' : '모두 펼치기';
  };
  // PC는 처음부터 펼쳐서, 폰은 접어서 (진행 중인 일정만 펼침)
  items.forEach((it) => setOpen(it, isDesktop() || it.dataset.id === nowStopId));
  syncToggleAll();
  $('#toggle-all').addEventListener('click', () => {
    const openAll = !items.every((i) => i.classList.contains('open'));
    items.forEach((it) => setOpen(it, openAll));
    syncToggleAll();
  });

  // 이미지 로드 실패 시 다음 후보 → 최종 실패 시 이모지 대체 (큰 사진·썸네일 공통)
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    const box = img.closest('[data-cands]');
    if (!box) return;
    const cands = JSON.parse(box.dataset.cands);
    const i = Number(box.dataset.i) + 1;
    if (i < cands.length) {
      box.dataset.i = i;
      img.src = withWidth(cands[i].src, box.dataset.w);
      const a = box.querySelector('figcaption a');
      if (a) {
        img.alt = cands[i].caption;
        a.href = cands[i].page;
        a.textContent = `${cands[i].caption} ↗`;
      }
    } else {
      box.classList.add('fallback');
      box.innerHTML = box.dataset.icon;
    }
  }, true);

  const flash = (el) => {
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  };

  // 지도에서 위치 보여주기 — 폰은 지도까지 스크롤, PC는 지도가 항상 보이므로 그대로
  function showOnMap(ll, zoom, marker) {
    if (!isDesktop()) $('#sec-map').scrollIntoView({ behavior: smooth(), block: 'start' });
    lastUserMap = Date.now();
    flyTo(ll, zoom);
    setTimeout(() => marker?.openPopup(), reduceMQ.matches ? 50 : 850);
  }
  function openAndScroll(stopId, target) {
    const item = document.getElementById(`stop-${stopId}`);
    const wasOpen = item.classList.contains('open');
    setOpen(item, true);
    syncToggleAll();
    const el = target || item;
    setTimeout(() => {
      el.scrollIntoView({ behavior: smooth(), block: target ? 'center' : 'start', inline: 'center' });
      flash(el);
    }, wasOpen ? 0 : 320);
  }

  document.addEventListener('click', (e) => {
    const head = e.target.closest('.tl-head');
    if (head) {
      const item = head.closest('.tl-item');
      setOpen(item, !item.classList.contains('open'));
      syncToggleAll();
      return;
    }
    const fly = e.target.closest('[data-fly]');
    if (fly) {
      const s = byId[fly.dataset.fly];
      showOnMap([s.lat, s.lng], s.isSea ? 12 : 15, markers[s.id]);
      return;
    }
    const flyOpt = e.target.closest('[data-fly-opt]');
    if (flyOpt) {
      const o = optById[flyOpt.dataset.flyOpt];
      showOnMap([o.lat, o.lng], 15, optMarkers[o.id]);
      return;
    }
    const goOpt = e.target.closest('[data-goto-opt]');
    if (goOpt) {
      const o = optById[goOpt.dataset.gotoOpt];
      map.closePopup();
      openAndScroll(o.stopId, document.getElementById(`opt-${o.id}`));
      return;
    }
    const go = e.target.closest('[data-goto]');
    if (go) {
      map.closePopup();
      openAndScroll(go.dataset.goto);
    }
  });

  /* ---------------- PC: 일정 스크롤 ↔ 지도 연동 ---------------- */
  let activeId = null;
  let syncT;
  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    setActivePin(id);
    if (!isDesktop()) return;
    items.forEach((el) => el.classList.toggle('active', el.dataset.id === id));
    if (Date.now() - lastUserMap < 5000) return; // 지도를 직접 보고 있으면 방해하지 않기
    clearTimeout(syncT);
    syncT = setTimeout(() => {
      const s = byId[id];
      flyTo([s.lat, s.lng], s.isSea ? 11 : 13);
    }, 150);
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.dataset.id); });
  }, { rootMargin: '-35% 0px -60% 0px' });
  items.forEach((el) => io.observe(el));

  /* ---------------- 폰: 하단 탭바 ---------------- */
  const tabs = $$('.tabbar a');
  const tabIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) tabs.forEach((a) => a.classList.toggle('active', a.dataset.tab === en.target.id));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  tabs.forEach((a) => { const sec = document.getElementById(a.dataset.tab); if (sec) tabIO.observe(sec); });

  /* ---------------- 여행 당일 모드 (상단 진행 바) ---------------- */
  const seq = T.stops.map((s) => ({ s, at: stopDate(s), end: stopEnd(s) }));
  const dur = (ms) => {
    const m = Math.max(1, Math.round(ms / 6e4));
    const h = Math.floor(m / 60);
    return h ? `${h}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`;
  };
  let liveTarget = null;
  function updateLive() {
    const t = now();
    updateDday(t);

    // "지금 여기" 표시 갱신
    const ns = computeNowStop(t);
    if (ns !== nowStopId) {
      nowStopId = ns;
      items.forEach((el) => {
        const on = el.dataset.id === ns;
        el.classList.toggle('is-now', on);
        el.querySelector('.now-badge')?.remove();
        if (on) el.querySelector('.tl-time').insertAdjacentHTML('beforeend', '<span class="now-badge">지금 여기</span>');
      });
      $$('.pin.now').forEach((p) => p.classList.remove('now'));
      if (ns) pinEl(ns)?.classList.add('now');
    }

    const bar = $('#live');
    if (!start) { bar.hidden = true; return; }
    const first = seq[0].at;
    const lastX = seq[seq.length - 1];
    const last = lastX.end || lastX.at;
    const show = t >= first - 6 * 36e5 && t <= last.getTime() + 3 * 36e5;
    bar.hidden = !show;
    if (show) {
      const cur = [...seq].reverse().find((x) => x.at <= t);
      const next = seq.find((x) => x.at > t);
      // 진행률은 "오늘" 일정 기준
      const day = cur ? cur.s.day : next.s.day;
      const dayStops = seq.filter((x) => x.s.day === day);
      const dStart = dayStops[0].at;
      const dEnd = Math.max(...dayStops.map((x) => (x.end || x.at).getTime()));
      const frac = Math.min(1, Math.max(0, (t - dStart) / (dEnd - dStart)));
      let text;
      if (!cur) {
        text = `🚗 출발까지 ${dur(next.at - t)} <small>${next.s.time} ${esc(next.s.title)}</small>`;
        liveTarget = next.s.id;
      } else if (cur.end && t < cur.end) {
        text = `${cur.s.icon} ${esc(cur.s.title)} 중 · 끝까지 ${dur(cur.end - t)}`;
        liveTarget = cur.s.id;
      } else if (next) {
        text = `⏱ 다음: ${next.s.icon} ${esc(next.s.title)} · ${dur(next.at - t)} 후 <small>${next.s.time}</small>`;
        liveTarget = next.s.id;
      } else {
        text = '👋 원정 끝! 다들 수고했어요';
        liveTarget = cur.s.id;
      }
      $('#live-text').innerHTML = text;
      $('#live-pct').textContent = `Day ${day} · ${Math.round(frac * 100)}%`;
      $('#live-fill').style.width = `${frac * 100}%`;
    }
    root.style.setProperty('--live-h', show ? `${bar.offsetHeight}px` : '0px');
  }
  $('#live').addEventListener('click', () => { if (liveTarget) openAndScroll(liveTarget); });
  updateLive();
  setInterval(updateLive, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateLive(); });

  /* ---------------- checklist (이 기기에만 저장) ---------------- */
  // 항목 문구를 키로 저장 → 항목을 추가/순서 변경해도 기존 체크가 엉뚱한 줄로 밀리지 않음
  const KEY = 'trip-checklist-v2';
  let checked = {};
  try { checked = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  const groups = T.checklist.map((g) => (typeof g === 'string' ? { items: [g] } : g));
  const itemHTML = (c) =>
    `<li><label><input type="checkbox" data-key="${esc(c)}" ${checked[c] ? 'checked' : ''}><span>${esc(c)}</span></label></li>`;
  $('#checklist').innerHTML = groups
    .map((g) => `${g.group ? `<li class="check-group">${esc(g.group)}</li>` : ''}${g.items.map(itemHTML).join('')}`)
    .join('');
  $('#checklist').addEventListener('change', (e) => {
    checked[e.target.dataset.key] = e.target.checked;
    try { localStorage.setItem(KEY, JSON.stringify(checked)); } catch {}
  });

  /* ---------------- 화면 크기 변화 ---------------- */
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { renderTide(); map.invalidateSize(); updateLive(); }, 150);
  });
  desktopMQ.addEventListener('change', () => {
    setTimeout(() => { map.invalidateSize(); fit(currentFit); }, 50);
    if (!isDesktop()) items.forEach((el) => el.classList.remove('active'));
  });

  if (nowStopId) {
    setTimeout(() => map.setView([byId[nowStopId].lat, byId[nowStopId].lng], 12), 400);
  }

  /* ---------------- 오프라인 (PWA) ---------------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('offline', () => toast('📴 오프라인 — 저장해둔 일정·지도로 보여줄게요', 2600));
  window.addEventListener('online', () => toast('📶 다시 연결됐어요'));
})();
