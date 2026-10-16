/* AURUM interaction engine — vanilla JS + GSAP/ScrollTrigger (optional enhancement) */
(() => {
  'use strict';
  const d = document, root = d.documentElement, body = d.body;
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const G = window.gsap && window.ScrollTrigger;
  const lerp = (a, b, t) => a + (b - a) * t;
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, sx: innerWidth / 2, sy: innerHeight / 2, vx: 0, vy: 0, on: false };

  /* ---------- text splitting ---------- */
  function splitChars(el) {
    const t = el.textContent; el.textContent = ''; el.setAttribute('aria-label', t);
    [...t].forEach(c => { const s = d.createElement('span'); s.className = 'ch' + (c === ' ' ? ' sp' : ''); s.setAttribute('aria-hidden', 'true'); s.textContent = c === ' ' ? '\u00a0' : c; el.appendChild(s); });
    return $$('.ch', el);
  }
  function splitWords(el) {
    const t = el.textContent.trim(); el.setAttribute('aria-label', t); el.textContent = '';
    t.split(/\s+/).forEach((w, i, a) => { const o = d.createElement('span'); o.className = 'w'; o.setAttribute('aria-hidden', 'true'); const n = d.createElement('span'); n.className = 'wi'; n.textContent = w; o.appendChild(n); el.appendChild(o); if (i < a.length - 1) el.appendChild(d.createTextNode(' ')); });
    return $$('.wi', el);
  }
  const chars = $$('[data-split]').map(splitChars);
  const heads = $$('.section-head h2').map(splitWords);

  /* ---------- nav ---------- */
  const nav = $('#nav'), toggle = $('#navToggle'), links = $('#navLinks'), ind = $('#navInd');
  const navAnchors = $$('a', links);
  toggle.addEventListener('click', () => {
    const o = links.classList.toggle('is-open'); toggle.setAttribute('aria-expanded', o);
    body.style.overflow = o ? 'hidden' : '';
  });
  navAnchors.forEach(a => a.addEventListener('click', () => { links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); body.style.overflow = ''; }));
  addEventListener('keydown', e => { if (e.key === 'Escape' && links.classList.contains('is-open')) toggle.click(); });
  function moveInd(a) {
    if (!a || !ind || innerWidth <= 820) return;
    ind.style.width = a.offsetWidth + 'px'; ind.style.transform = `translateX(${a.offsetLeft}px)`; ind.style.opacity = 1;
  }
  let activeA = null;
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    activeA = navAnchors.find(a => a.getAttribute('href') === '#' + e.target.id);
    navAnchors.forEach(a => a.classList.toggle('active', a === activeA)); moveInd(activeA);
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id], #contact').forEach(s => spy.observe(s));
  new IntersectionObserver(es => { if (es[0].isIntersecting && ind) { ind.style.opacity = 0; navAnchors.forEach(a => a.classList.remove('active')); } }).observe($('#top'));
  navAnchors.forEach(a => { a.addEventListener('mouseenter', () => moveInd(a)); a.addEventListener('mouseleave', () => moveInd(activeA)); });
  addEventListener('resize', () => moveInd(activeA));

  /* ---------- scroll progress + nav state ---------- */
  const bar = $('#progress');
  function onScroll() {
    const max = root.scrollHeight - innerHeight;
    bar.style.transform = `scaleY(${max > 0 ? scrollY / max : 0})`;
    nav.classList.toggle('scrolled', scrollY > 60);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  $('#toTop').addEventListener('click', () => scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }));

  /* ---------- pointer tracking ---------- */
  addEventListener('pointermove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
  }, { passive: true });

  /* ---------- atmosphere: layered gold dust + reactive light ---------- */
  const ac = $('#atmos'), ax = ac.getContext('2d');
  let W, H, DPR, stars = [];
  function sizeCanvas(c) { DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; c.width = W * DPR; c.height = H * DPR; }
  function seed() {
    const n = W < 820 ? 70 : 170;
    stars = Array.from({ length: n }, () => { const z = [.25, .55, 1][(Math.random() * 3) | 0]; return { x: Math.random() * W, y: Math.random() * H, z, r: z * 1.3 + .2, s: z * (.08 + Math.random() * .2), p: Math.random() * 6.28 }; });
  }
  const trail = $('#trail'), tx = trail.getContext('2d');
  function resize() { sizeCanvas(ac); trail.width = W * DPR; trail.height = H * DPR; seed(); }
  resize(); addEventListener('resize', resize);
  let scrollV = 0, lastY = scrollY, tNow = 0;
  function drawAtmos(t) {
    ax.setTransform(DPR, 0, 0, DPR, 0, 0); ax.clearRect(0, 0, W, H);
    const g = ax.createRadialGradient(mouse.sx, mouse.sy, 0, mouse.sx, mouse.sy, 380);
    g.addColorStop(0, 'rgba(212,175,105,.16)'); g.addColorStop(.4, 'rgba(146,112,45,.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ax.fillStyle = g; ax.fillRect(0, 0, W, H);
    ax.globalCompositeOperation = 'lighter';
    const px = (mouse.sx / W - .5), py = (mouse.sy / H - .5), sv = scrollV;
    for (const s of stars) {
      s.y -= s.s + sv * s.z * .35; if (s.y < -4) s.y = H + 4; if (s.y > H + 4) s.y = -4;
      const x = s.x - px * 60 * s.z, y = s.y - py * 40 * s.z;
      const dx = x - mouse.sx, dy = y - mouse.sy, near = Math.max(0, 1 - Math.hypot(dx, dy) / 220);
      const a = (.25 + .25 * Math.sin(t / 900 + s.p)) * s.z + near * .7;
      ax.fillStyle = `rgba(243,221,164,${Math.min(a, 1)})`;
      ax.beginPath(); ax.arc(x - dx * near * .06, y - dy * near * .06, s.r + near * 1.2, 0, 6.283); ax.fill();
    }
    ax.globalCompositeOperation = 'source-over';
  }

  /* ---------- cursor system ---------- */
  const cur = $('#cursor'), core = $('.cursor-core', cur), ring = $('.cursor-ring', cur), label = $('.cursor-label', cur);
  const useCursor = FINE && !RM;
  const parts = [];
  let rx = mouse.x, ry = mouse.y, cx = mouse.x, cy = mouse.y;
  if (useCursor) {
    root.classList.add('has-cursor');
    d.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor],a,button');
      cur.classList.remove('is-link', 'is-light');
      if (!t) return;
      const v = t.dataset.cursor;
      if (v && v !== 'light') { label.textContent = v; cur.classList.add('is-link'); }
      else cur.classList.add('is-light');
    });
    d.addEventListener('pointerdown', () => cur.classList.add('is-down'));
    d.addEventListener('pointerup', () => cur.classList.remove('is-down'));
    d.documentElement.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));
    d.documentElement.addEventListener('pointerenter', () => cur.classList.remove('is-hidden'));
  }
  function drawCursor() {
    mouse.vx = mouse.x - mouse.sx; mouse.vy = mouse.y - mouse.sy;
    mouse.sx = lerp(mouse.sx, mouse.x, .12); mouse.sy = lerp(mouse.sy, mouse.y, .12);
    cx = lerp(cx, mouse.x, .55); cy = lerp(cy, mouse.y, .55);
    const prx = rx, pry = ry; rx = lerp(rx, mouse.x, .16); ry = lerp(ry, mouse.y, .16);
    const sp = Math.hypot(rx - prx, ry - pry), ang = Math.atan2(ry - pry, rx - prx);
    const stretch = Math.min(sp / 40, .35);
    core.style.transform = `translate(${cx}px,${cy}px)`;
    ring.style.transform = `translate(${rx}px,${ry}px) rotate(${ang}rad) scale(${1 + stretch},${1 - stretch * .6})`;
    /* gold particle trail, speed-reactive */
    const n = Math.min(Math.floor(sp / 5), 4);
    for (let i = 0; i < n && parts.length < 140; i++)
      parts.push({ x: cx + (Math.random() - .5) * 6, y: cy + (Math.random() - .5) * 6, vx: (Math.random() - .5) * 1.2 - mouse.vx * .01, vy: (Math.random() - .5) * 1.2 + .3, l: 1, r: 1 + Math.random() * 2.2 + Math.min(sp / 30, 2) });
    tx.setTransform(DPR, 0, 0, DPR, 0, 0); tx.clearRect(0, 0, W, H); tx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.l -= .024; if (p.l <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx; p.y += p.vy; p.vy += .015;
      tx.fillStyle = `rgba(243,221,164,${p.l * .8})`; tx.shadowColor = 'rgba(212,175,105,.9)'; tx.shadowBlur = 8;
      tx.beginPath(); tx.arc(p.x, p.y, p.r * p.l, 0, 6.283); tx.fill();
    }
    tx.shadowBlur = 0;
  }

  /* ---------- magnetic elements ---------- */
  if (FINE && !RM) $$('[data-magnetic]').forEach(el => {
    el.style.transition = 'transform .6s cubic-bezier(.2,1.6,.3,1)';
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      el.style.transition = 'transform .15s linear';
      el.style.transform = `translate(${dx * .32}px,${dy * .4}px) scale(1.04)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transition = 'transform .7s cubic-bezier(.2,1.6,.3,1)'; el.style.transform = ''; });
  });

  /* ---------- card lighting + 3D tilt ---------- */
  if (FINE && !RM) {
    $$('.card').forEach(c => {
      c.dataset.cursor = 'light';
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%');
        c.style.setProperty('--ry', (x - .5) * 5 + 'deg'); c.style.setProperty('--rx', (.5 - y) * 4 + 'deg');
      });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
    $$('.chip').forEach(c => c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px'); }));
  }

  /* ---------- hero: orb parallax, lighting, panel tilt ---------- */
  const orb = $('#orb'), panel = $('.hero-panel'), glow = $('.contact-glow'), footer = $('#contact');
  function heroFX() {
    const px = mouse.sx / W - .5, py = mouse.sy / H - .5;
    if (scrollY < innerHeight * 1.2) {
      orb.style.setProperty('--ry', px * 14 + 'deg'); orb.style.setProperty('--rx', -py * 10 + 'deg');
      orb.style.setProperty('--lx', 32 + px * 30 + '%'); orb.style.setProperty('--ly', 28 + py * 30 + '%');
      if (panel && FINE) panel.style.transform = `perspective(900px) rotateY(${px * -8}deg) rotateX(${py * 6}deg)`;
    }
    const fr = footer.getBoundingClientRect();
    if (fr.top < innerHeight && fr.bottom > 0) {
      footer.style.setProperty('--mx', (mouse.sx / W * 100) + '%'); footer.style.setProperty('--my', Math.max(0, Math.min(100, (mouse.sy - fr.top) / 8)) + '%');
    }
  }

  /* touch: drive the same lights from touch position / scroll */
  addEventListener('touchmove', e => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; }, { passive: true });

  /* ---------- main loop ---------- */
  let running = true;
  d.addEventListener('visibilitychange', () => { running = !d.hidden; if (running) requestAnimationFrame(loop); });
  function loop(t) {
    if (!running) return;
    const y = scrollY; scrollV = lerp(scrollV, Math.max(-6, Math.min(6, (y - lastY) * .08)), .2); lastY = y;
    mouse.sx = lerp(mouse.sx, mouse.x, .08); /* base smoothing for atmosphere */
    drawAtmos(t); if (useCursor) drawCursor(); heroFX();
    requestAnimationFrame(loop);
  }
  if (RM) { drawAtmos(0); } else requestAnimationFrame(loop);

  /* ---------- scroll choreography (GSAP) ---------- */
  function choreograph() {
    if (!G || RM) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    /* hero transforms as you scroll */
    gsap.to('.l1', { xPercent: -14, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 } });
    gsap.to('.l2', { xPercent: 10, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 } });
    gsap.to('.hero-orb', { yPercent: 18, scale: 1.25, opacity: .25, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-lower', { y: -60, opacity: 0, scrollTrigger: { trigger: '.hero', start: '35% top', end: 'bottom top', scrub: true } });
    /* section heads + rule lines */
    heads.forEach(w => gsap.from(w, { yPercent: 115, rotate: 4, duration: 1.1, stagger: .07, ease: 'expo.out', scrollTrigger: { trigger: w[0].closest('.section-head'), start: 'top 82%' } }));
    $$('.section').forEach(s => gsap.fromTo(s, { '--line': 0 }, { '--line': 1, ease: 'none', scrollTrigger: { trigger: s, start: 'top 85%', end: 'top 40%', scrub: true } }));
    /* cards */
    $$('.card').forEach(c => gsap.from(c, { autoAlpha: 0, '--ty': '90px', duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'top 88%' }, clearProps: '' }));
    $$('.card .readout b').forEach(b => {
      const m = b.textContent.match(/^([\d.]+)(.*)$/); if (!m || b.textContent.includes('+')) return;
      const end = parseFloat(m[1]), dec = (m[1].split('.')[1] || '').length, o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: b, start: 'top 92%', once: true }, onUpdate: () => b.textContent = o.v.toFixed(dec) + m[2] });
    });
    /* timeline gold line draws with scroll */
    const tl = $('.timeline');
    gsap.fromTo(tl, { '--p': 0 }, { '--p': 1, ease: 'none', scrollTrigger: { trigger: tl, start: 'top 70%', end: 'bottom 70%', scrub: true } });
    $$('.timeline-item').forEach(i => gsap.from(i, { autoAlpha: 0, x: 50, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: i, start: 'top 85%' } }));
    /* horizontal movement: other projects (desktop) */
    mm.add('(min-width:821px)', () => {
      const row = $('.chip-row'), sec = $('.section-other');
      gsap.to(row, { x: () => -(row.scrollWidth - (innerWidth - parseFloat(getComputedStyle(sec).paddingLeft) * 2)), ease: 'none', scrollTrigger: { trigger: row, start: 'top 85%', end: 'top 20%', scrub: .8, invalidateOnRefresh: true } });
    });
    /* skills + marquee strip react to scroll */
    gsap.from('.skill-cloud li', { autoAlpha: 0, y: 70, rotate: 3, duration: 1, stagger: .05, ease: 'expo.out', scrollTrigger: { trigger: '.skill-cloud', start: 'top 80%' } });
    gsap.fromTo('.skill-strip-track', { x: 0 }, { x: '-45%', ease: 'none', scrollTrigger: { trigger: '.skill-strip', start: 'top bottom', end: 'bottom top', scrub: true } });
    /* contact finale */
    gsap.from(chars[2] || [], { yPercent: 110, duration: 1.4, stagger: .04, ease: 'expo.out', scrollTrigger: { trigger: '.contact-title', start: 'top 85%' } });
    gsap.from('.contact-mail,.footer-links,.footer-bar', { autoAlpha: 0, y: 40, stagger: .12, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.contact-mail', start: 'top 92%' } });
    gsap.fromTo('.contact-glow', { scale: .6, opacity: .3 }, { scale: 1.1, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#contact', start: 'top bottom', end: 'top 20%', scrub: true } });
    addEventListener('load', () => ScrollTrigger.refresh());
  }

  /* ---------- intro ---------- */
  function heroIn() {
    body.classList.remove('is-loading');
    if (G && !RM) {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.from(chars[0].concat(chars[1]), { yPercent: 115, rotate: 6, duration: 1.5, stagger: .035 }, 0)
        .from('.hero-eyebrow', { autoAlpha: 0, x: -30, duration: 1 }, .3)
        .from('.hero-role', { autoAlpha: 0, y: 24, duration: 1 }, .7)
        .from('.hero-statement', { autoAlpha: 0, y: 24, duration: 1 }, .85)
        .from('.hero-cta .btn', { autoAlpha: 0, y: 24, stagger: .1, duration: 1 }, 1)
        .from('.hero-orb', { scale: .6, autoAlpha: 0, duration: 2.2 }, .1)
        .from('.hero-panel', { autoAlpha: 0, duration: 1.6 }, 1.1)
        .from('.strat-path,.bench-path', { strokeDashoffset: 700, duration: 2.2, ease: 'power2.inOut' }, 1.3)
        .from('.scroll-cue,.ticker', { autoAlpha: 0, duration: 1 }, 1.6);
    }
    choreograph();
  }
  const pre = $('#preloader'), cnt = $('#preCount'), line = $('#preLine');
  let seen = false; try { seen = sessionStorage.getItem('aurum-seen') === '1'; } catch (e) {}
  if (RM || seen) { pre.remove(); heroIn(); }
  else {
    let ready = false, t0 = performance.now(), finished = false;
    const MIN = 1900;
    const markReady = () => { ready = true; };
    (d.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r))).then(() => (d.fonts ? d.fonts.ready : 0)).then(markReady, markReady);
    setTimeout(markReady, 4000); /* never block access */
    const finish = () => { if (finished) return; finished = true; try { sessionStorage.setItem('aurum-seen', '1'); } catch (e) {} pre.classList.add('done'); setTimeout(heroIn, 350); setTimeout(() => pre.remove(), 1400); };
    pre.addEventListener('click', finish); addEventListener('keydown', finish, { once: true });
    (function tick(now) {
      let p = Math.min((now - t0) / MIN, 1); p = 1 - Math.pow(1 - p, 3);
      if (!ready) p = Math.min(p, .92);
      cnt.textContent = String(Math.round(p * 100)).padStart(3, '0'); line.style.transform = `scaleX(${p})`;
      if (p >= 1 && ready) setTimeout(finish, 250); else if (!finished) requestAnimationFrame(tick);
    })(t0);
  }
})();
