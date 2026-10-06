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
  colorOf.bye = '#8d6e63';

  /* ---------------- header ---------------- */
  $('#trip-title').textContent = T.title;
  $('#trip-subtitle').textContent = T.subtitle;
  document.title = T.title;

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
    if (day === 'island') return L.latLngBounds(T.stops.filter((s) => s.lat < 36.6).map((s) => [s.lat, s.lng]));
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
