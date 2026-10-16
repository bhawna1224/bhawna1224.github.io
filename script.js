/* AURUM interaction engine — optimized.
   One shared frame loop (GSAP ticker when available, else rAF) drives atmosphere, cursor,
   trail and pointer lighting. Everything is dirty-flagged, sprite-based and layout-read-free. */
(() => {
  'use strict';
  const d = document, root = d.documentElement, body = d.body;
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const G = window.gsap && window.ScrollTrigger;
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, sx: innerWidth / 2, sy: innerHeight / 2 };
  let lastActive = 0; /* last time pointer/scroll did something — drives idle throttling */

  /* ---------- adaptive quality: 0 full · 1 reduced · 2 minimal ---------- */
  let tier = ((navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2) ? 1 : 0;
  const STAR_MULT = [1, .6, .35], TRAIL_MAX = [140, 90, 50];

  /* ---------- text splitting ---------- */
  function splitChars(el) {
    const t = el.textContent; el.textContent = ''; el.setAttribute('aria-label', t);
    const f = d.createDocumentFragment();
    [...t].forEach(c => { const s = d.createElement('span'); s.className = 'ch' + (c === ' ' ? ' sp' : ''); s.setAttribute('aria-hidden', 'true'); s.textContent = c === ' ' ? '\u00a0' : c; f.appendChild(s); });
    el.appendChild(f); return $$('.ch', el);
  }
  function splitWords(el) {
    const t = el.textContent.trim(); el.setAttribute('aria-label', t); el.textContent = '';
    const f = d.createDocumentFragment();
    t.split(/\s+/).forEach((w, i, a) => { const o = d.createElement('span'); o.className = 'w'; o.setAttribute('aria-hidden', 'true'); const n = d.createElement('span'); n.className = 'wi'; n.textContent = w; o.appendChild(n); f.appendChild(o); if (i < a.length - 1) f.appendChild(d.createTextNode(' ')); });
    el.appendChild(f); return $$('.wi', el);
  }
  const chars = $$('[data-split]').map(splitChars);
  const heads = $$('.section-head h2').map(splitWords);

  /* ---------- nav ---------- */
  const nav = $('#nav'), toggle = $('#navToggle'), links = $('#navLinks'), ind = $('#navInd');
  const navAnchors = $$('a', links);
  toggle.addEventListener('click', () => {
    const o = links.classList.toggle('is-open'); toggle.setAttribute('aria-expanded', o); body.style.overflow = o ? 'hidden' : '';
  });
  navAnchors.forEach(a => a.addEventListener('click', () => { links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); body.style.overflow = ''; }));
  addEventListener('keydown', e => { if (e.key === 'Escape' && links.classList.contains('is-open')) toggle.click(); });
  let activeA = null;
  function moveInd(a) { if (!a || !ind || innerWidth <= 820) return; ind.style.width = a.offsetWidth + 'px'; ind.style.transform = `translateX(${a.offsetLeft}px)`; ind.style.opacity = 1; }
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    activeA = navAnchors.find(a => a.getAttribute('href') === '#' + e.target.id);
    navAnchors.forEach(a => a.classList.toggle('active', a === activeA)); moveInd(activeA);
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id], #contact').forEach(s => spy.observe(s));
  navAnchors.forEach(a => { a.addEventListener('mouseenter', () => moveInd(a)); a.addEventListener('mouseleave', () => moveInd(activeA)); });
  addEventListener('resize', () => moveInd(activeA));

  /* ---------- visibility: pause offscreen decoration, mark sections once ---------- */
  const hero = $('#top'), footer = $('#contact');
  let heroVis = true, footVis = false;
  new IntersectionObserver(es => es.forEach(e => {
    if (e.target === hero) { heroVis = e.isIntersecting; hero.classList.toggle('is-off', !heroVis); if (!heroVis && ind) { /* keep nav state */ } else if (ind) { ind.style.opacity = 0; navAnchors.forEach(a => a.classList.remove('active')); activeA = null; } }
    else footVis = e.isIntersecting;
  }), { rootMargin: '100px' }).observe(hero);
  new IntersectionObserver(es => es.forEach(e => footVis = e.isIntersecting)).observe(footer);
  const secIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); secIO.unobserve(e.target); } }), { threshold: .05 });
  $$('.section').forEach(s => secIO.observe(s));

  /* ---------- pointer ---------- */
  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; lastActive = performance.now(); }, { passive: true });
  $('#toTop').addEventListener('click', () => scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }));

  /* ---------- canvases (DPR 1: particles are soft, DOM cursor stays crisp) ---------- */
  const ac = $('#atmos'), ax = ac.getContext('2d'), trail = $('#trail'), tx = trail.getContext('2d');
  let W = innerWidth, H = innerHeight, stars = [];
  function sprite(n, stops) {
    const c = d.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
    const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); stops.forEach(s => g.addColorStop(s[0], s[1]));
    x.fillStyle = g; x.fillRect(0, 0, n, n); return c;
  }
  const glowSp = sprite(32, [[0, 'rgba(255,240,200,1)'], [.25, 'rgba(243,221,164,.75)'], [1, 'rgba(212,175,105,0)']]);
  const lightSp = sprite(256, [[0, 'rgba(212,175,105,.16)'], [.4, 'rgba(146,112,45,.06)'], [1, 'rgba(0,0,0,0)']]);
  function seed() {
    const n = Math.round((W < 820 ? 70 : 170) * STAR_MULT[tier]);
    stars = Array.from({ length: n }, () => { const z = [.25, .55, 1][(Math.random() * 3) | 0]; return { x: Math.random() * W, y: Math.random() * H, z, r: z * 1.3 + .3, s: z * (.08 + Math.random() * .2), p: Math.random() * 6.28 }; });
  }
  let rt = 0;
  function resize() { W = innerWidth; H = innerHeight; ac.width = trail.width = W; ac.height = trail.height = H; seed(); }
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  resize();

  let scrollV = 0, lastY = scrollY, frame = 0;
  function drawAtmos(t) {
    ax.clearRect(0, 0, W, H);
    ax.globalCompositeOperation = 'source-over'; ax.globalAlpha = 1;
    ax.drawImage(lightSp, mouse.sx - 380, mouse.sy - 380, 760, 760);
    ax.globalCompositeOperation = 'lighter';
    const px = mouse.sx / W - .5, py = mouse.sy / H - .5;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.y -= s.s + scrollV * s.z * .35; if (s.y < -4) s.y = H + 4; else if (s.y > H + 4) s.y = -4;
      const x = s.x - px * 60 * s.z, y = s.y - py * 40 * s.z;
      const dx = x - mouse.sx, dy = y - mouse.sy, dist2 = dx * dx + dy * dy;
      const near = dist2 < 48400 ? 1 - Math.sqrt(dist2) / 220 : 0; /* 220px radius, sqrt only when close */
      const a = (.25 + .25 * Math.sin(t / 900 + s.p)) * s.z + near * .7, r = (s.r + near * 1.2) * 3;
      ax.globalAlpha = a > 1 ? 1 : a;
      ax.drawImage(glowSp, x - dx * near * .06 - r, y - dy * near * .06 - r, r * 2, r * 2);
    }
    ax.globalAlpha = 1; ax.globalCompositeOperation = 'source-over';
  }

  /* ---------- cursor + pooled gold trail ---------- */
  const cur = $('#cursor'), core = $('.cursor-core', cur), ring = $('.cursor-ring', cur), label = $('.cursor-label', cur);
  const useCursor = FINE && !RM;
  const POOL = Array.from({ length: 140 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, l: 0, r: 0 }));
  let live = 0, trailDirty = false, poolHead = 0;
  let rx = mouse.x, ry = mouse.y, cx = mouse.x, cy = mouse.y, pcx = -1, pcy = -1, prx = -1, pry = -1, pst = 0;
  if (useCursor) {
    root.classList.add('has-cursor');
    d.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor],a,button');
      cur.classList.remove('is-link', 'is-light'); if (!t) return;
      const v = t.dataset.cursor;
      if (v && v !== 'light') { label.textContent = v; cur.classList.add('is-link'); } else cur.classList.add('is-light');
    }, { passive: true });
    d.addEventListener('pointerdown', () => cur.classList.add('is-down'));
    d.addEventListener('pointerup', () => cur.classList.remove('is-down'));
    root.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));
    root.addEventListener('pointerenter', () => cur.classList.remove('is-hidden'));
  }
  function drawCursor() {
    cx = lerp(cx, mouse.x, .55); cy = lerp(cy, mouse.y, .55);
    const ox = rx, oy = ry; rx = lerp(rx, mouse.x, .16); ry = lerp(ry, mouse.y, .16);
    const sp = Math.hypot(rx - ox, ry - oy);
    /* skip DOM writes when the pointer has settled */
    if (Math.abs(cx - pcx) > .05 || Math.abs(cy - pcy) > .05) { core.style.transform = `translate(${cx}px,${cy}px)`; pcx = cx; pcy = cy; }
    if (Math.abs(rx - prx) > .05 || Math.abs(ry - pry) > .05 || sp > 0 || pst) {
      const st = Math.min(sp / 40, .35), ang = Math.atan2(ry - oy, rx - ox);
      ring.style.transform = `translate(${rx}px,${ry}px) rotate(${ang}rad) scale(${1 + st},${1 - st * .6})`; prx = rx; pry = ry; pst = sp > .01 ? 1 : 0;
    }
    /* spawn from the pool — no allocations */
    const cap = TRAIL_MAX[tier], n = Math.min((sp / 5) | 0, 4);
    for (let i = 0; i < n && live < cap; i++) {
      let p; for (let k = 0; k < POOL.length; k++) { poolHead = (poolHead + 1) % POOL.length; if (!POOL[poolHead].on) { p = POOL[poolHead]; break; } }
      if (!p) break;
      p.on = true; p.x = cx + (Math.random() - .5) * 6; p.y = cy + (Math.random() - .5) * 6; p.vx = (Math.random() - .5) * 1.2; p.vy = (Math.random() - .5) * 1.2 + .3; p.l = 1; p.r = 1 + Math.random() * 2.2 + Math.min(sp / 30, 2); live++;
    }
    if (!live) { if (trailDirty) { tx.clearRect(0, 0, W, H); trailDirty = false; } return; }
    tx.clearRect(0, 0, W, H); tx.globalCompositeOperation = 'lighter'; trailDirty = true;
    for (let i = 0; i < POOL.length; i++) {
      const p = POOL[i]; if (!p.on) continue;
      p.l -= .024; if (p.l <= 0) { p.on = false; live--; continue; }
      p.x += p.vx; p.y += p.vy; p.vy += .015;
      const r = p.r * p.l * 3.2; tx.globalAlpha = p.l * .85; tx.drawImage(glowSp, p.x - r, p.y - r, r * 2, r * 2);
    }
    tx.globalAlpha = 1;
  }

  /* ---------- magnetic elements (rect cached on enter, no reads on move) ---------- */
  if (FINE && !RM) $$('[data-magnetic]').forEach(el => {
    let r = null;
    el.addEventListener('pointerenter', () => { r = el.getBoundingClientRect(); el.classList.add('mag-on'); });
    el.addEventListener('pointermove', e => {
      if (!r) return;
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .32}px,${(e.clientY - r.top - r.height / 2) * .4}px) scale(1.04)`;
    });
    el.addEventListener('pointerleave', () => { el.classList.remove('mag-on'); el.style.transform = ''; r = null; });
  });

  /* ---------- card lighting + tilt: compositor-only, applied inside the shared loop ---------- */
  let tilt = null; /* {el, glow, l, t, w, h, x, y, card} */
  if (FINE && !RM) {
    $$('.card, .chip').forEach(el => {
      const isCard = el.classList.contains('card');
      if (isCard) el.dataset.cursor = 'light';
      const wrap = d.createElement('span'); wrap.className = 'glow-wrap'; wrap.setAttribute('aria-hidden', 'true'); const glow = d.createElement('i'); wrap.appendChild(glow); el.prepend(wrap);
      el.addEventListener('pointerenter', e => { const r = el.getBoundingClientRect(); tilt = { el, glow, card: isCard, l: r.left + scrollX, t: r.top + scrollY, w: r.width, h: r.height, x: e.pageX, y: e.pageY }; });
      el.addEventListener('pointermove', e => { if (tilt && tilt.el === el) { tilt.x = e.pageX; tilt.y = e.pageY; } }, { passive: true });
      el.addEventListener('pointerleave', () => { if (tilt && tilt.el === el) tilt = null; if (isCard) el.style.transform = ''; });
    });
  }
  function applyTilt() {
    const T = tilt; if (!T) return;
    const lx = T.x - T.l, ly = T.y - T.t;
    T.glow.style.transform = `translate(${lx}px,${ly}px)`;
    if (T.card && T.el.classList.contains('tilt-ready')) T.el.style.transform = `perspective(1100px) rotateX(${(.5 - ly / T.h) * 4}deg) rotateY(${(lx / T.w - .5) * 5}deg)`;
  }

  /* ---------- hero/footers lighting (transform writes only, only when visible & moving) ---------- */
  const stage = $('.orb-stage'), spec = $('.spec'), panel = $('.hero-panel'), cg = $('.contact-glow i');
  function lighting() {
    const moving = Math.abs(mouse.x - mouse.sx) > .4 || Math.abs(mouse.y - mouse.sy) > .4;
    if (!moving) return;
    const px = mouse.sx / W - .5, py = mouse.sy / H - .5;
    if (heroVis) {
      stage.style.transform = `rotateX(${(-py * 10).toFixed(2)}deg) rotateY(${(px * 14).toFixed(2)}deg)`;
      spec.style.transform = `translate(${(px * 60).toFixed(1)}%,${(py * 60).toFixed(1)}%)`;
      if (panel && FINE) panel.style.transform = `perspective(900px) rotateY(${(px * -8).toFixed(2)}deg) rotateX(${(py * 6).toFixed(2)}deg)`;
    }
    if (footVis && cg) cg.style.transform = `translate(${(px * 60).toFixed(1)}%,${(py * 30).toFixed(1)}%)`;
  }

  /* ---------- scroll progress (written in the loop, not in scroll handlers) ---------- */
  const bar = $('#progress'); let progY = -1, navScrolled = false;
  function scrollState() {
    const y = scrollY; if (y === progY) return; progY = y;
    const max = root.scrollHeight - innerHeight; bar.style.transform = `scaleY(${max > 0 ? y / max : 0})`;
    const s = y > 60; if (s !== navScrolled) { navScrolled = s; nav.classList.toggle('scrolled', s); }
  }

  /* ---------- frame monitor + adaptive quality ---------- */
  let ema = 16.7, slow = 0, born = performance.now(), last = born, fps = 60;
  function monitor(dt) {
    ema = lerp(ema, dt, .06); fps = 1000 / ema;
    if (performance.now() - born < 3500 || tier >= 2) return; /* ignore intro cost */
    slow = ema > 26 ? slow + 1 : 0;
    if (slow > 90) { tier++; slow = 0; ema = 16.7; seed(); } /* sustained <38fps → step quality down */
  }

  /* ---------- the one loop ---------- */
  function tick() {
    const now = performance.now(), dt = now - last; last = now; if (dt < 250) monitor(dt);
    const y = scrollY; const sv = y - lastY; lastY = y; if (sv) lastActive = now;
    scrollV = lerp(scrollV, clamp(sv * .08, -6, 6), .2);
    mouse.sx = lerp(mouse.sx, mouse.x, .12); mouse.sy = lerp(mouse.sy, mouse.y, .12);
    frame++;
    const idle = now - lastActive > 1200;
    if (!(idle && (frame & 1))) drawAtmos(now); /* ambient drift runs at ~30fps when the user is idle */
    if (useCursor) drawCursor();
    applyTilt(); lighting(); scrollState();
  }
  if (RM) { drawAtmos(0); scrollState(); addEventListener('scroll', scrollState, { passive: true }); }
  else if (G) gsap.ticker.add(tick);
  else (function raf() { if (!d.hidden) tick(); requestAnimationFrame(raf); })();
  if (RM) { /* static state needs the nav state too */ }

  /* ---------- scroll choreography ---------- */
  function choreograph() {
    if (!G || RM) { $$('.card').forEach(c => c.classList.add('tilt-ready')); return; }
    gsap.registerPlugin(ScrollTrigger); ScrollTrigger.config({ ignoreMobileResize: true });
    const mm = gsap.matchMedia();
    /* one hero scrub instead of four */
    gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: .6 } })
      .to('.l1', { xPercent: -14, ease: 'none' }, 0).to('.l2', { xPercent: 10, ease: 'none' }, 0)
      .to('.hero-orb', { yPercent: 18, scale: 1.25, ease: 'none' }, 0)
      .to('.hero-lower', { y: -60, opacity: 0, ease: 'none' }, .35);
    heads.forEach(w => gsap.from(w, { yPercent: 115, rotate: 4, duration: 1.1, stagger: .07, ease: 'expo.out', scrollTrigger: { trigger: w[0].closest('.section-head'), start: 'top 82%', once: true } }));
    $$('.card').forEach(c => gsap.from(c, { autoAlpha: 0, y: 90, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'top 88%', once: true },
      onComplete: () => { gsap.set(c, { clearProps: 'transform,opacity,visibility' }); c.classList.add('tilt-ready'); } }));
    $$('.card .readout b').forEach(b => {
      const m = b.textContent.match(/^([\d.]+)(.*)$/); if (!m || b.textContent.includes('+')) return;
      const end = parseFloat(m[1]), dec = (m[1].split('.')[1] || '').length, o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: b, start: 'top 92%', once: true }, onUpdate: () => { b.textContent = o.v.toFixed(dec) + m[2]; } });
    });
    const tl = $('.timeline'), fill = d.createElement('i'); fill.className = 'tl-fill'; tl.appendChild(fill);
    gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: tl, start: 'top 70%', end: 'bottom 70%', scrub: true } });
    $$('.timeline-item').forEach(i => gsap.from(i, { autoAlpha: 0, x: 50, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: i, start: 'top 85%', once: true } }));
    mm.add('(min-width:821px)', () => {
      const row = $('.chip-row'), sec = $('.section-other');
      gsap.to(row, { x: () => -(row.scrollWidth - (innerWidth - parseFloat(getComputedStyle(sec).paddingLeft) * 2)), ease: 'none', scrollTrigger: { trigger: row, start: 'top 85%', end: 'top 20%', scrub: .8, invalidateOnRefresh: true } });
    });
    gsap.from('.skill-cloud li', { autoAlpha: 0, y: 70, rotate: 3, duration: 1, stagger: .05, ease: 'expo.out', scrollTrigger: { trigger: '.skill-cloud', start: 'top 80%', once: true } });
    gsap.fromTo('.skill-strip-track', { x: 0 }, { x: '-45%', ease: 'none', scrollTrigger: { trigger: '.skill-strip', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from(chars[2] || [], { yPercent: 110, duration: 1.4, stagger: .04, ease: 'expo.out', scrollTrigger: { trigger: '.contact-title', start: 'top 85%', once: true } });
    gsap.from('.contact-mail,.footer-links,.footer-bar', { autoAlpha: 0, y: 40, stagger: .12, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.contact-mail', start: 'top 92%', once: true } });
    gsap.fromTo('.contact-glow', { scale: .6, opacity: .3 }, { scale: 1.1, opacity: 1, ease: 'none', scrollTrigger: { trigger: footer, start: 'top bottom', end: 'top 20%', scrub: true } });
    /* fonts swap can shift layout: re-measure once */
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  /* ---------- intro ---------- */
  function heroIn() {
    body.classList.remove('is-loading');
    if (G && !RM) {
      gsap.timeline({ defaults: { ease: 'expo.out' } })
        .from(chars[0].concat(chars[1]), { yPercent: 115, rotate: 6, duration: 1.3, stagger: .03 }, 0)
        .from('.hero-eyebrow', { autoAlpha: 0, x: -30, duration: .9 }, .2)
        .from('.hero-role', { autoAlpha: 0, y: 24, duration: .9 }, .5)
        .from('.hero-statement', { autoAlpha: 0, y: 24, duration: .9 }, .6)
        .from('.hero-cta .btn', { autoAlpha: 0, y: 24, stagger: .08, duration: .9 }, .7)
        .from('.orb-stage > *', { autoAlpha: 0, duration: 1.8, stagger: .15 }, 0)
        .from('.hero-panel', { autoAlpha: 0, duration: 1.2 }, .8)
        .from('.strat-path,.bench-path', { strokeDashoffset: 700, duration: 2, ease: 'power2.inOut' }, 1)
        .from('.scroll-cue,.ticker', { autoAlpha: 0, duration: .9 }, 1.2);
    }
    choreograph();
  }
  const pre = $('#preloader'), cnt = $('#preCount'), line = $('#preLine');
  let seen = false; try { seen = sessionStorage.getItem('aurum-seen') === '1'; } catch (e) {}
  if (RM || seen) { pre.remove(); heroIn(); }
  else {
    let ready = false, finished = false; const t0 = performance.now(), MIN = 1100;
    const markReady = () => { ready = true; };
    (d.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, { once: true }))).then(() => d.fonts ? d.fonts.ready : 0).then(markReady, markReady);
    setTimeout(markReady, 2000); /* never hold the page hostage */
    const finish = () => { if (finished) return; finished = true; try { sessionStorage.setItem('aurum-seen', '1'); } catch (e) {} pre.classList.add('done'); setTimeout(heroIn, 120); setTimeout(() => pre.remove(), 1300); };
    pre.addEventListener('click', finish); addEventListener('keydown', finish, { once: true });
    (function step(now) {
      let p = Math.min((now - t0) / MIN, 1); p = 1 - Math.pow(1 - p, 3); if (!ready) p = Math.min(p, .92);
      cnt.textContent = String((p * 100) | 0).padStart(3, '0'); line.style.transform = `scaleX(${p})`;
      if (p >= 1 && ready) setTimeout(finish, 100); else if (!finished) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- optional measurement HUD: add ?perf to the URL ---------- */
  if (/[?&]perf/.test(location.search)) {
    const hud = d.createElement('div'); hud.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:1001;font:11px/1.5 monospace;color:#F3DDA4;background:rgba(5,8,22,.9);padding:6px 10px;border:1px solid #D4AF69;pointer-events:none';
    d.body.appendChild(hud); let lt = 0, ltMax = 0;
    try { new PerformanceObserver(l => l.getEntries().forEach(e => { lt++; ltMax = Math.max(ltMax, e.duration); })).observe({ type: 'longtask', buffered: true }); } catch (e) {}
    setInterval(() => { hud.textContent = `fps ${fps.toFixed(0)} · frame ${ema.toFixed(1)}ms · tier ${tier} · stars ${stars.length} · trail ${live} · longtasks ${lt} (max ${ltMax.toFixed(0)}ms)`; }, 500);
  }
})();
