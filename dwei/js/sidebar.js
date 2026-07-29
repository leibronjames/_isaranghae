(() => {
  'use strict';

  // Prevent the closed drawer from animating during the first page paint.
  document.documentElement.classList.add('drei-nav-preload');
  document.documentElement.classList.remove('drei-nav-ready');

  const MOBILE_MAX = 760;
  const sidebar = document.getElementById('sidebar');
  const main = document.querySelector('.main');
  const menu = document.getElementById('mobileMenu');
  const collapse = document.getElementById('collapseBtn');
  if (!sidebar || !main || !menu) return;

  let overlay = document.querySelector('.mobile-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    document.body.appendChild(overlay);
  }

  const safeGet = key => {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  };
  const safeSet = (key, value) => {
    try { localStorage.setItem(key, value); } catch (_) {}
  };

  /*
    Do not lock the page with body { position: fixed }.
    That method can make mobile browsers jump or smoothly scroll the cards.
    Overflow locking keeps the exact scroll position untouched.
  */
  const lockPage = () => {
    document.documentElement.classList.add('drei-scroll-locked');
    document.body.classList.add('drei-nav-open');
  };

  const unlockPage = () => {
    document.documentElement.classList.remove('drei-scroll-locked');
    document.body.classList.remove('drei-nav-open');
  };

  const setMobileState = open => {
    const isMobile = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
    const shouldOpen = isMobile && Boolean(open);

    sidebar.classList.toggle('open', shouldOpen);
    overlay.classList.toggle('show', shouldOpen);
    menu.setAttribute('aria-expanded', String(shouldOpen));
    menu.setAttribute('aria-label', shouldOpen ? 'Close navigation menu' : 'Open navigation menu');
    menu.textContent = shouldOpen ? '×' : '☰';

    if (shouldOpen) lockPage();
    else unlockPage();
  };

  // Stop only background touch scrolling. The drawer can still scroll normally.
  document.addEventListener('touchmove', event => {
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(event.target)) return;
    event.preventDefault();
  }, { passive: false });

  menu.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    setMobileState(!sidebar.classList.contains('open'));
  });

  overlay.addEventListener('click', () => setMobileState(false));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMobileState(false);
  });

  sidebar.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches) {
        setMobileState(false);
      }
    });
  });

  if (collapse) {
    collapse.addEventListener('click', () => {
      if (window.innerWidth <= MOBILE_MAX) return;
      const collapsed = sidebar.classList.toggle('collapsed');
      main.classList.toggle('sidebar-expanded', collapsed);
      safeSet('drei-sidebar-collapsed', collapsed ? '1' : '0');
      collapse.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    });
  }

  if (window.innerWidth > MOBILE_MAX && safeGet('drei-sidebar-collapsed') === '1') {
    sidebar.classList.add('collapsed');
    main.classList.add('sidebar-expanded');
    collapse?.setAttribute('aria-label', 'Expand sidebar');
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > MOBILE_MAX || sidebar.classList.contains('open')) {
      setMobileState(false);
    }
  }, { passive: true });

  window.addEventListener('pageshow', () => setMobileState(false));

  // Mobile always starts fully closed before transitions are enabled.
  setMobileState(false);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.classList.remove('drei-nav-preload');
    document.documentElement.classList.add('drei-nav-ready');
  }));
})();
