(() => {
  'use strict';

  /* Remove any stale transition classes from older cached versions. */
  document.body.classList.remove('page-enter', 'page-leave', 'page-is-leaving');

  /* Keep the closed drawer completely off-screen until its initial state is applied. */
  document.documentElement.classList.add('drei-nav-preload');
  document.documentElement.classList.remove('drei-nav-ready');

  const MOBILE_MAX = 760;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sidebar = document.getElementById('sidebar');
  const menu = document.getElementById('mobileMenu');
  const main = document.querySelector('.main');
  const collapse = document.getElementById('collapseBtn');
  const intro = document.getElementById('intro');

  const getOverlay = () => {
    let item = document.querySelector('.mobile-overlay');
    if (!item) {
      item = document.createElement('div');
      item.className = 'mobile-overlay';
      document.body.appendChild(item);
    }
    return item;
  };

  const overlay = sidebar ? getOverlay() : null;

  if (menu) menu.onclick = null;
  if (overlay) overlay.onclick = null;
  if (collapse) collapse.onclick = null;

  function introIsBlocking() {
    return Boolean(intro && !intro.classList.contains('hide'));
  }

  /*
    Keep the page at its current position without body { position: fixed }.
    Fixed-body locking can trigger a visible mobile scroll jump, especially
    when the document uses scroll-behavior:smooth.
  */
  function lockPageAtCurrentPosition() {
    document.documentElement.classList.add('drei-scroll-locked');
    document.body.classList.add('drei-nav-open');
  }

  function unlockPageAndRestorePosition() {
    document.documentElement.classList.remove('drei-scroll-locked');
    document.body.classList.remove('drei-nav-open');
    document.body.style.overflow = introIsBlocking() ? 'hidden' : '';
  }

  function applyMobileState(open, { restoreFocus = false } = {}) {
    if (!sidebar) return;
    const mobile = window.innerWidth <= MOBILE_MAX;
    const shouldOpen = mobile && Boolean(open);

    sidebar.classList.toggle('open', shouldOpen);
    overlay?.classList.toggle('show', shouldOpen);
    document.body.classList.toggle('drei-nav-open', shouldOpen);

    if (menu) {
      menu.setAttribute('aria-expanded', String(shouldOpen));
      menu.setAttribute('aria-label', shouldOpen ? 'Close navigation menu' : 'Open navigation menu');
      menu.textContent = shouldOpen ? '×' : '☰';
    }

    if (shouldOpen) lockPageAtCurrentPosition();
    else unlockPageAndRestorePosition();

    if (!shouldOpen && restoreFocus && menu) {
      requestAnimationFrame(() => menu.focus({ preventScroll: true }));
    }
  }

  /* Always start fully closed on phones, then enable drawer transitions. */
  applyMobileState(false);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.classList.remove('drei-nav-preload');
    document.documentElement.classList.add('drei-nav-ready');
  }));

  // Prevent the page behind the drawer from moving while allowing the drawer itself to scroll.
  document.addEventListener('touchmove', event => {
    if (!sidebar?.classList.contains('open')) return;
    if (sidebar.contains(event.target)) return;
    event.preventDefault();
  }, { passive: false });

  menu?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    applyMobileState(!sidebar?.classList.contains('open'));
  });

  overlay?.addEventListener('click', () => applyMobileState(false, { restoreFocus: true }));

  sidebar?.querySelectorAll('.nav a').forEach((link, index) => {
    link.style.setProperty('--drei-nav-index', index);
    /* Close the drawer, then let the browser navigate immediately. */
    link.addEventListener('click', () => applyMobileState(false));
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar?.classList.contains('open')) {
      applyMobileState(false, { restoreFocus: true });
    }
  });

  collapse?.addEventListener('click', () => {
    if (!sidebar || !main || window.innerWidth <= MOBILE_MAX) return;
    const collapsed = sidebar.classList.toggle('collapsed');
    main.classList.toggle('sidebar-expanded', collapsed);
    try { localStorage.setItem('drei-sidebar-collapsed', collapsed ? '1' : '0'); } catch (_) {}
  });

  if (window.innerWidth > MOBILE_MAX && sidebar && main) {
    try {
      if (localStorage.getItem('drei-sidebar-collapsed') === '1') {
        sidebar.classList.add('collapsed');
        main.classList.add('sidebar-expanded');
      }
    } catch (_) {}
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth <= MOBILE_MAX) {
      sidebar?.classList.remove('collapsed');
      main?.classList.remove('sidebar-expanded');
    }
    applyMobileState(false);
  }, { passive: true });

  window.addEventListener('pageshow', () => {
    document.body.classList.remove('page-enter', 'page-leave', 'page-is-leaving', 'drei-nav-open');
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
    if (menu) {
      menu.textContent = '☰';
      menu.setAttribute('aria-expanded', 'false');
    }
    unlockPageAndRestorePosition();
  });

  /* Fast hero and content motion. */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.add('motion-ready');
  }));

  const revealTargets = [];
  const addReveal = (element, delay = 0, type = '') => {
    if (!element || element.classList.contains('drei-reveal')) return;
    element.classList.add('drei-reveal');
    if (type) element.classList.add(type);
    element.style.setProperty('--drei-delay', `${Math.min(delay, 260)}ms`);
    revealTargets.push(element);
  };

  document.querySelectorAll('.section').forEach((section, sectionIndex) => {
    addReveal(section.querySelector(':scope > .section-title'), 0, sectionIndex % 2 ? 'from-right' : 'from-left');
    addReveal(section.querySelector(':scope > .section-sub'), 45);

    section.querySelectorAll('.card').forEach((card, index) => {
      addReveal(card, index * 55, 'drei-card-reveal');
    });

    section.querySelectorAll('.panel,.bible-card,.featured-project').forEach((item, index) => {
      addReveal(item, index * 55);
    });
  });

  document.querySelectorAll('.timeline-item,.info-box,.skill,.goal,.dashboard-panel,.stat-card,.featured-copy,.featured-visual').forEach((item, index) => {
    addReveal(item, (index % 5) * 48, item.classList.contains('stat-card') ? 'drei-card-reveal' : '');
  });

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealTargets.forEach(target => target.classList.add('is-visible'));
  } else {
    document.documentElement.classList.add('drei-motion');
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -5% 0px' });
    revealTargets.forEach(target => revealObserver.observe(target));
  }

  /* Subtle desktop tilt. */
  const finePointer = window.matchMedia('(hover:hover) and (pointer:fine)');
  document.querySelectorAll('.card').forEach(card => {
    card.classList.add('drei-interactive-card');
    if (!finePointer.matches || reducedMotion.matches) return;

    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty('--drei-tilt-x', `${((0.5 - y) * 4.5).toFixed(2)}deg`);
      card.style.setProperty('--drei-tilt-y', `${((x - 0.5) * 4.5).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--drei-tilt-x', '0deg');
      card.style.setProperty('--drei-tilt-y', '0deg');
    });
  });

  /* Ripple feedback does not intercept or delay navigation. */
  document.querySelectorAll('button,.primary-btn,.visit,.enter-btn').forEach(control => {
    control.classList.add('drei-pressable');
    control.addEventListener('pointerdown', event => {
      if (reducedMotion.matches) return;
      const rect = control.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'drei-ripple';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      control.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  });

  const progress = document.createElement('div');
  progress.className = 'drei-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<div class="drei-progress-bar"></div>';
  document.body.appendChild(progress);
  const progressBar = progress.firstElementChild;

  const backTop = document.createElement('button');
  backTop.className = 'drei-back-top drei-pressable';
  backTop.type = 'button';
  backTop.setAttribute('aria-label', 'Back to top');
  backTop.textContent = '↑';
  document.body.appendChild(backTop);
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' }));

  let ticking = false;
  const updateScrollUI = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    progressBar.style.width = `${Math.min(100, (scrollTop / maxScroll) * 100)}%`;
    backTop.classList.toggle('show', scrollTop > 520 && maxScroll > 600);
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateScrollUI);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', updateScrollUI, { passive: true });
  updateScrollUI();

  /* Safety: nothing may remain hidden if an observer is delayed. */
  window.setTimeout(() => {
    revealTargets.forEach(item => item.classList.add('is-visible'));
  }, 1100);
})();
