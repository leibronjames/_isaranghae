(() => {
  'use strict';

  const intro = document.getElementById('intro');
  const lamp = document.getElementById('lamp');
  const pull = document.getElementById('pullCord');
  const particles = document.getElementById('dustParticles');
  const enter = document.getElementById('enterBtn');
  const skip = document.getElementById('skipIntro');
  const replay = document.getElementById('replayIntro');
  if (!intro || !lamp || !pull || !enter || !skip) return;

  let dragging = false;
  let startY = 0;
  let distance = 0;
  let activated = false;
  let activePointerId = null;

  const safeSessionGet = key => {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  };
  const safeSessionSet = (key, value) => {
    try { sessionStorage.setItem(key, value); } catch (_) {}
  };

  const buildParticles = () => {
    if (!particles || particles.childElementCount) return;
    const count = window.innerWidth <= 700 ? 24 : 42;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement('span');
      particle.className = 'dust';
      particle.style.setProperty('--x', `${18 + Math.random() * 64}%`);
      particle.style.setProperty('--y', `${22 + Math.random() * 66}%`);
      particle.style.setProperty('--size', `${1 + Math.random() * 2.5}px`);
      particle.style.setProperty('--duration', `${3.5 + Math.random() * 4.5}s`);
      particle.style.setProperty('--delay', `${-Math.random() * 5}s`);
      fragment.appendChild(particle);
    }
    particles.appendChild(fragment);
  };

  const dispatchDashboardReady = () => {
    document.body.classList.add('dashboard-ready');
    document.dispatchEvent(new CustomEvent('drei:dashboard-ready'));
  };

  const resetCord = () => {
    pull.style.setProperty('--drag', '0px');
    distance = 0;
  };

  const resetIntro = () => {
    activated = false;
    dragging = false;
    activePointerId = null;
    resetCord();
    intro.classList.remove('is-exiting','is-activated','flickering','light-on','welcome-visible');
    lamp.classList.remove('swing','brand-on');
    pull.classList.remove('pulling');
    pull.style.pointerEvents = '';
  };

  const showIntro = () => {
    resetIntro();
    intro.hidden = false;
    document.body.classList.add('intro-active');
    requestAnimationFrame(() => intro.classList.remove('is-exiting'));
  };

  const exitIntro = (remember = true) => {
    if (remember) safeSessionSet('dreiIntroPlayed', 'yes');
    intro.classList.add('is-exiting');
    document.body.classList.remove('intro-active');
    dispatchDashboardReady();
    window.setTimeout(() => { intro.hidden = true; }, 470);
  };

  const activate = () => {
    if (activated) return;
    activated = true;
    dragging = false;
    pull.classList.add('pulling');
    pull.style.pointerEvents = 'none';
    intro.classList.add('is-activated','flickering');
    lamp.classList.add('swing');
    resetCord();

    window.setTimeout(() => {
      intro.classList.add('light-on');
      lamp.classList.add('brand-on');
    }, 320);

    window.setTimeout(() => {
      intro.classList.remove('flickering');
      intro.classList.add('welcome-visible');
    }, 820);
  };

  const pointerY = event => event.clientY;

  pull.addEventListener('pointerdown', event => {
    if (activated) return;
    dragging = true;
    activePointerId = event.pointerId;
    startY = pointerY(event);
    pull.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  pull.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== activePointerId || activated) return;
    distance = Math.max(0, Math.min(82, pointerY(event) - startY));
    pull.style.setProperty('--drag', `${distance}px`);
    event.preventDefault();
  });

  const finishPull = event => {
    if (!dragging || (activePointerId !== null && event.pointerId !== activePointerId)) return;
    dragging = false;
    activePointerId = null;
    if (distance >= 48) activate();
    else resetCord();
  };

  pull.addEventListener('pointerup', finishPull);
  pull.addEventListener('pointercancel', finishPull);
  pull.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  });

  enter.addEventListener('click', () => exitIntro(true));
  skip.addEventListener('click', () => exitIntro(true));
  replay?.addEventListener('click', showIntro);

  buildParticles();

  if (safeSessionGet('dreiIntroPlayed') === 'yes') {
    intro.hidden = true;
    document.body.classList.remove('intro-active');
    dispatchDashboardReady();
  } else {
    showIntro();
  }
})();
