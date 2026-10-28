/* BBQ — Riyadh 2027 */
(() => {
  'use strict';

  const de = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = [...document.querySelectorAll('section[data-web]')];
  const dots = [...document.querySelectorAll('[data-dot]')];
  const navLinks = [...document.querySelectorAll('[data-nav]')];
  const header = document.querySelector('.site-header-1');
  const counter = document.querySelector('[data-counter]');
  const prevBtn = document.querySelector('[data-prev]');
  const nextBtn = document.querySelector('[data-next]');
  const hint = document.querySelector('[data-hint]');
  const TILT = 0.5; // mouse-tilt strength (0 = off, 1 = full)
  const mobile = window.matchMedia('(max-width: 899px)');

  // Desktop: each slide is a 1920×1080 canvas fitted to the viewport.
  // Mobile: slides reflow on a 720px-wide canvas scaled to the screen width.
  let lastW = 0;
  const fit = () => {
    const w = de.clientWidth, h = window.innerHeight;
    if (mobile.matches) {
      const s = w / 720;
      de.style.setProperty('--s', s.toFixed(5));
      de.style.setProperty('--sw', '720px');
      de.style.setProperty('--sh', 'auto');
      if (w !== lastW) de.style.setProperty('--mh', (h / s).toFixed(2) + 'px'); // ignore URL-bar resizes
    } else {
      const s = Math.min(w / 1920, h / 1080);
      de.style.setProperty('--s', s.toFixed(5));
      de.style.setProperty('--sw', (w / s).toFixed(2) + 'px');
      de.style.setProperty('--sh', Math.min(h / s, 1440).toFixed(2) + 'px');
    }
    lastW = w;
  };
  fit();
  window.addEventListener('resize', fit);

  // Animated number counters
  const countUp = (section) => {
    if (reduce) return;
    section.querySelectorAll('[data-count]').forEach((el) => {
      const node = el.firstChild;
      if (!node || node.nodeType !== 3) return;
      const final = el.dataset.final || node.nodeValue;
      el.dataset.final = final;
      const m = final.match(/^(\D*)([\d,]+(?:\.\d+)?)(.*)$/);
      if (!m) return;
      const target = parseFloat(m[2].replace(/,/g, ''));
      const dec = (m[2].split('.')[1] || '').length;
      const commas = m[2].includes(',');
      const t0 = performance.now() + 450;
      const dur = 1600;
      const step = (t) => {
        const k = Math.min(1, Math.max(0, (t - t0) / dur));
        const e = 1 - Math.pow(2, -10 * k);
        let v = (target * e).toFixed(dec);
        if (commas) v = Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        node.nodeValue = k >= 1 ? final : m[1] + v + m[3];
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };

  // Play each slide's entrance every time it comes into view
  if (reduce || !('IntersectionObserver' in window)) {
    sections.forEach((s) => s.setAttribute('data-active', ''));
  } else {
    sections.forEach((s) => s.setAttribute('data-armed', ''));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const s = en.target;
        const need = Math.min(en.boundingClientRect.height, window.innerHeight) * 0.5;
        if (en.isIntersecting && en.intersectionRect.height >= need && !s.hasAttribute('data-active')) {
          s.setAttribute('data-active', '');
          countUp(s);
        } else if (!en.isIntersecting) {
          s.removeAttribute('data-active');
        }
      });
    }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
    sections.forEach((s) => io.observe(s));
  }

  // Slide navigation
  let idx = 0;
  let lockUntil = 0;
  const go = (i) => {
    idx = Math.max(0, Math.min(sections.length - 1, i));
    lockUntil = performance.now() + 900;
    const top = sections[idx].getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    hint && hint.setAttribute('data-gone', '');
  };

  document.querySelectorAll('[data-target]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      go(Number(el.dataset.target) - 1);
    });
  });
  prevBtn && prevBtn.addEventListener('click', () => go(idx - 1));
  nextBtn && nextBtn.addEventListener('click', () => go(idx + 1));

  // Keyboard: → ↓ PageDown Space = next · ← ↑ PageUp Shift+Space = previous · Home / End
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    let n = null;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': n = idx + 1; break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': n = idx - 1; break;
      case ' ': n = e.shiftKey ? idx - 1 : idx + 1; break;
      case 'Home': n = 0; break;
      case 'End': n = sections.length - 1; break;
    }
    if (n === null) return;
    e.preventDefault();
    go(n);
  });

  // Mouse-driven 3D tilt
  let tx = 0, ty = 0, cx = 0, cy = 0;
  window.addEventListener('pointermove', (e) => {
    const k = mobile.matches || e.pointerType !== 'mouse' ? 0 : TILT;
    tx = ((e.clientX / window.innerWidth) * 2 - 1) * k;
    ty = ((e.clientY / window.innerHeight) * 2 - 1) * k;
  });

  // Highlight the header link for the current chapter
  const navTargets = navLinks.map((a) => Number(a.dataset.target));
  const setNav = (slide) => {
    let on = -1;
    navTargets.forEach((t, i) => { if (slide >= t) on = i; });
    navLinks.forEach((a, i) => a.toggleAttribute('data-on', i === on));
  };

  // Frame loop: tilt easing, scroll progress, parallax, rail state
  let shown = -1;
  const loop = () => {
    if (!reduce) {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      de.style.setProperty('--mx', cx.toFixed(4));
      de.style.setProperty('--my', cy.toFixed(4));
    }
    const max = Math.max(1, de.scrollHeight - window.innerHeight);
    de.style.setProperty('--prog', Math.min(1, window.scrollY / max).toFixed(4));

    const vh = window.innerHeight;
    let best = 0, bestD = Infinity;
    sections.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      if (!reduce && r.bottom > -200 && r.top < vh + 200) {
        const sp = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
        s.style.setProperty('--sp', sp.toFixed(4));
      }
      const d = Math.abs(r.top + r.height / 2 - vh / 2);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (performance.now() > lockUntil) idx = best;

    if (best !== shown) {
      shown = best;
      dots.forEach((d, i) => d.toggleAttribute('data-on', i === best));
      if (counter) counter.textContent = String(best + 1).padStart(2, '0');
      if (prevBtn) prevBtn.disabled = best === 0;
      if (nextBtn) nextBtn.disabled = best === sections.length - 1;
      header && header.toggleAttribute('data-solid', best > 0);
      if (best > 0 && hint) hint.setAttribute('data-gone', '');
      setNav(best + 1);
    }
    requestAnimationFrame(loop);
  };
  loop();
})();
