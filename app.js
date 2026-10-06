(() => {
  const T = window.TRIP;
  const byId = Object.fromEntries(T.stops.map((s) => [s.id, s]));
  const $ = (sel) => document.querySelector(sel);
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 각 일정의 색 = 그 일정으로 "도착하는" 경로의 색 (시간대별 색상)
  const colorOf = {};
  T.legs.forEach((l) => { if (!l.sea && !colorOf[l.to]) colorOf[l.to] = l.color; });
  colorOf.jamsil = T.legs[0].color;
  colorOf.boat = T.legs.find((l) => l.sea)?.color || '#1e88e5';
  colorOf.bbq = '#e53950';
  colorOf.game = '#ab47bc';

  /* ---------------- header ---------------- */
  $('#trip-title').textContent = T.title;
  $('#trip-subtitle').textContent = T.subtitle;
  document.title = T.title;
  const boat = T.stops.find((s) => s.isSea);
  if (boat) $('#boat-chip').textContent = `⛴ ${boat.time}–${boat.end}`;

  const start = T.startDate ? new Date(`${T.startDate}T00:00:00+09:00`) : null;
  const stopDate = (s) => {
    if (!start) return null;
    const [h, m] = s.time.split(':').map(Number);
    return new Date(start.getTime() + (s.day - 1) * 864e5 + (h * 60 + m) * 6e4);
  };
  let nowStopId = null;
  if (start) {
    const now = new Date();
    const days = Math.ceil((start - now) / 864e5);
    const chip = $('#dday-chip');
    const fmt = start.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
    if (days > 0) chip.textContent = `📅 ${fmt} · D-${days}`;
    else if (days > -2) { chip.textContent = `🔥 여행 중!`; chip.classList.add('live'); }
    else chip.textContent = `📅 ${fmt} · 다녀옴`;
    // 지금 진행 중인 일정 = 시작 시각이 지난 마지막 일정
    T.stops.forEach((s) => { if (stopDate(s) <= now) nowStopId = s.id; });
    const last = stopDate(T.stops[T.stops.length - 1]);
    if (now - last > 6 * 36e5) nowStopId = null;
  }

  /* ---------------- map ---------------- */
  const map = L.map('map', { zoomControl: false, attributionControl: true, tap: true });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  }).addTo(map);

  const markers = {};
  T.stops.forEach((s, i) => {
    if (s.noPin) return; // 같은 장소의 다른 일정(예: 펜션 게임 타임)은 핀을 공유
    const icon = L.divIcon({
      className: '',
      html: `<div class="pin${s.id === nowStopId ? ' now' : ''}" style="background:${colorOf[s.id]}"><span>${s.icon}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [4, 36],
      popupAnchor: [14, -34],
    });
    const m = L.marker([s.lat, s.lng], { icon, riseOnHover: true, zIndexOffset: 100 - i })
      .bindPopup(
        `<div class="popup-time">Day ${s.day} · ${s.time}${s.end ? ` – ${s.end}` : ''}</div>
         <div class="popup-title">${esc(s.title)}</div>
         <button class="popup-link" data-goto="${s.id}">일정 보기 ↓</button>`,
      );
    m.addTo(map);
    markers[s.id] = m;
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

  T.stops.filter((s) => s.noPin).forEach((s) => {
    const twin = T.stops.find((o) => !o.noPin && o.lat === s.lat && o.lng === s.lng);
    if (twin) markers[s.id] = markers[twin.id];
  });

  const lines = {};
  const drawLegs = (routes = {}) => {
    Object.values(lines).forEach((l) => l.remove());
    T.legs.forEach((leg) => {
      const pts = routes[leg.id] || leg.path;
      // 흰 테두리 + 색 선 두 겹으로 그려서 지도 위에서 잘 보이게
      const casing = L.polyline(pts, { color: '#fff', weight: 8, opacity: 0.9, interactive: false });
      const line = L.polyline(pts, {
        color: leg.color, weight: 5, opacity: 0.95,
        dashArray: leg.sea ? '2 10' : null, lineCap: 'round',
      }).bindTooltip(leg.label, { sticky: true });
      lines[leg.id] = L.layerGroup([casing, line]).addTo(map);
    });
    Object.values(markers).forEach((m) => m.setZIndexOffset(1000));
  };
  drawLegs();

  // scripts/build-routes.mjs 로 미리 만들어 둔 실제 도로 경로가 있으면 교체 (정적 파일, API 호출 없음)
  fetch('data/routes.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((routes) => {
      if (!routes) return;
      drawLegs(routes);
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
  const fit = (day) => map.fitBounds(boundsFor(day), { padding: [28, 28] });
  fit('all');

  document.querySelectorAll('.seg-btn').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
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
    map.fitBounds(L.latLngBounds(leg.path), { padding: [40, 40], maxZoom: 13 });
  });

  // 내 위치 (브라우저 기본 기능, 외부 API 없음)
  let me;
  $('#locate-btn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('이 브라우저는 위치 기능을 지원하지 않아요.');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const ll = [coords.latitude, coords.longitude];
        if (me) me.setLatLng(ll);
        else me = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#ff6b4a', fillOpacity: 1 }).addTo(map).bindTooltip('나');
        map.setView(ll, 13);
      },
      () => alert('위치를 가져오지 못했어요.'),
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
    $('#tide').hidden = false;
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

    // --- SVG ---
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
    g += `<rect x="${X(0)}" y="${M.t}" width="${X(sr) - X(0)}" height="${ih}" fill="#0b2545" opacity=".05"/>`;
    g += `<rect x="${X(ss)}" y="${M.t}" width="${X(24) - X(ss)}" height="${ih}" fill="#0b2545" opacity=".05"/>`;
    // 출조 시간대
    g += `<rect x="${X(w0)}" y="${M.t}" width="${X(w1) - X(w0)}" height="${ih}" fill="#16b8a6" opacity=".14" rx="4"/>`;
    g += `<text class="band-lbl" x="${(X(w0) + X(w1)) / 2}" y="${M.t - 8}" text-anchor="middle">${esc(td.window.label)}</text>`;
    // y 그리드 (m)
    for (let v = 0; v <= yMax; v += 200) {
      g += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e8e4dc" stroke-width="1"/>`;
      g += `<text x="${M.l - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v / 100}m</text>`;
    }
    // x 축 (시각)
    [0, 6, 12, 18, 24].forEach((h) => {
      g += `<text x="${X(h)}" y="${H - 6}" text-anchor="${h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}">${h}시</text>`;
    });
    g += `<text x="${X(sr)}" y="${M.t + ih - 4}" text-anchor="middle">☀︎ ${td.sunrise}</text>`;
    g += `<text x="${X(ss)}" y="${M.t + ih - 4}" text-anchor="middle">☾ ${td.sunset}</text>`;
    // 곡선
    g += `<path d="${area}" fill="var(--tide)" opacity=".1"/>`;
    g += `<path d="${line}" fill="none" stroke="var(--tide)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    // 만조·간조 점 + 라벨
    ext.forEach((e) => {
      const x = X(e.h), y = Y(e.cm);
      const up = e.type === 'high';
      const anchor = x < M.l + 30 ? 'start' : x > W - M.r - 30 ? 'end' : 'middle';
      g += `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--tide)" stroke="#fff" stroke-width="2"/>`;
      g += `<text class="lbl" x="${x}" y="${up ? y - 9 : y + 17}" text-anchor="${anchor}">${e.t} ${(e.cm / 100).toFixed(1)}m</text>`;
    });
    // hover 레이어
    g += `<line id="tide-x" x1="0" x2="0" y1="${M.t}" y2="${M.t + ih}" stroke="#1b1f2a" stroke-width="1" opacity="0"/>`;
    g += `<circle id="tide-dot" r="5" fill="var(--tide)" stroke="#fff" stroke-width="2" opacity="0"/>`;
    g += `<rect id="tide-hit" x="${M.l}" y="0" width="${iw}" height="${H}" fill="transparent"/>`;

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
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderTide, 150); });

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
      alert('네이버지도 앱 길찾기는 휴대폰에서 열 수 있어요.');
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

  /* ---------------- timeline ---------------- */
  const mapLinks = (s) => {
    const q = encodeURIComponent(s.mapQuery || s.place);
    return {
      naver: `https://map.naver.com/p/search/${q}`,
      kakao: `https://map.kakao.com/link/search/${q}`,
    };
  };

  const photoHTML = (s) => {
    const ps = s.photos || [];
    if (s.isSea && ps.length > 1) {
      return `<div class="photos two">${ps.map((p) => figure(s, [p])).join('')}</div>`;
    }
    return `<div class="photos">${figure(s, ps)}</div>`;
  };
  // 후보 사진을 순서대로 시도하고, 전부 실패하면 이모지 카드로 대체
  function figure(s, candidates) {
    if (!candidates.length) return `<figure class="photo fallback">${s.icon}</figure>`;
    const [first] = candidates;
    const data = esc(JSON.stringify(candidates));
    return `<figure class="photo" data-cands="${data}" data-i="0" data-icon="${s.icon}">
        <img src="${first.src}" alt="${esc(first.caption)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        <figcaption><a href="${first.page}" target="_blank" rel="noopener">${esc(first.caption)} ↗</a></figcaption>
      </figure>`;
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
            <p class="opt-meta">⏰ ${esc(o.hours)}<br>💡 ${esc(o.note)} · <span class="opt-addr">${esc(o.address)}</span></p>
            <div class="opt-actions">
              <button class="btn" data-fly-opt="${o.id}">🗺 위치</button>
              <a class="btn naver" href="${l.naver}" target="_blank" rel="noopener">네이버</a>
              <a class="btn kakao" href="${l.kakao}" target="_blank" rel="noopener">카카오</a>
            </div>
          </li>`;
        }).join('')}</ul>`).join('')}
    </div>`;
  }

  const days = [...new Set(T.stops.map((s) => s.day))];
  const dayLabel = { 1: '첫째 날', 2: '둘째 날' };
  $('#timeline').innerHTML = days
    .map((d) => {
      const items = T.stops.filter((s) => s.day === d);
      return `<div class="day-head"><h2>Day ${d}</h2><span>${dayLabel[d] || ''}${start ? ' · ' + new Date(start.getTime() + (d - 1) * 864e5).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }) : ''}</span></div>
      <ol class="tl">${items.map((s) => {
        const links = mapLinks(s);
        return `<li class="tl-item${s.id === nowStopId ? ' is-now' : ''}" id="stop-${s.id}" style="--c:${colorOf[s.id]}">
          <div class="tl-dot">${s.icon}</div>
          <div class="tl-time">${s.time}${s.end ? ` – ${s.end}` : ''}${s.id === nowStopId ? '<span class="now-badge">지금 여기</span>' : ''}</div>
          <article class="card tl-card">
            ${photoHTML(s)}
            <div class="tl-body">
              <h3>${esc(s.title)}${s.who ? `<span class="tl-who">${esc(s.who)}</span>` : ''}</h3>
              <p class="tl-desc">${esc(s.desc)}</p>
              ${s.address ? `<p class="tl-addr">📍 ${esc(s.address)}</p>` : ''}
              <div class="tl-actions">
                <button class="btn primary" data-fly="${s.id}">🗺 위치 보기</button>
                ${s.isSea ? '' : `<a class="btn naver" href="${links.naver}" target="_blank" rel="noopener">네이버지도</a>
                <a class="btn kakao" href="${links.kakao}" target="_blank" rel="noopener">카카오맵</a>`}
              </div>
              ${optionsHTML(s)}
            </div>
          </article>
        </li>`;
      }).join('')}</ol>`;
    })
    .join('');

  // 이미지 로드 실패 시 다음 후보 → 최종 실패 시 이모지 대체
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    const fig = img.closest('.photo[data-cands]');
    if (!fig) return;
    const cands = JSON.parse(fig.dataset.cands);
    const i = Number(fig.dataset.i) + 1;
    if (i < cands.length) {
      fig.dataset.i = i;
      img.src = cands[i].src;
      img.alt = cands[i].caption;
      const a = fig.querySelector('figcaption a');
      a.href = cands[i].page;
      a.textContent = `${cands[i].caption} ↗`;
    } else {
      fig.className = 'photo fallback';
      fig.innerHTML = fig.dataset.icon;
    }
  }, true);

  const flash = (el) => {
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  };

  document.addEventListener('click', (e) => {
    const fly = e.target.closest('[data-fly]');
    if (fly) {
      const s = byId[fly.dataset.fly];
      $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
      map.flyTo([s.lat, s.lng], s.isSea ? 12 : 15, { duration: 0.8 });
      setTimeout(() => markers[s.id].openPopup(), 850);
      return;
    }
    const flyOpt = e.target.closest('[data-fly-opt]');
    if (flyOpt) {
      const o = optById[flyOpt.dataset.flyOpt];
      $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
      map.flyTo([o.lat, o.lng], 15, { duration: 0.8 });
      setTimeout(() => optMarkers[o.id].openPopup(), 850);
      return;
    }
    const goOpt = e.target.closest('[data-goto-opt]');
    if (goOpt) {
      const el = document.getElementById(`opt-${goOpt.dataset.gotoOpt}`);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flash(el);
      return;
    }
    const go = e.target.closest('[data-goto]');
    if (go) {
      const el = document.getElementById(`stop-${go.dataset.goto}`);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      flash(el);
    }
  });

  /* ---------------- checklist (이 기기에만 저장) ---------------- */
  const KEY = 'trip-checklist-v1';
  let checked = {};
  try { checked = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  $('#checklist').innerHTML = T.checklist
    .map((c, i) => `<li><label><input type="checkbox" data-i="${i}" ${checked[i] ? 'checked' : ''}><span>${esc(c)}</span></label></li>`)
    .join('');
  $('#checklist').addEventListener('change', (e) => {
    checked[e.target.dataset.i] = e.target.checked;
    try { localStorage.setItem(KEY, JSON.stringify(checked)); } catch {}
  });

  if (nowStopId) {
    setTimeout(() => map.setView([byId[nowStopId].lat, byId[nowStopId].lng], 12), 400);
  }
})();
