(() => {
  'use strict';

  const start = () => {
    const body = document.body;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const page = [...body.classList].find(name => name.startsWith('page-')) || '';
    const hero = document.querySelector('.page-hero');
    const heroContent = hero?.querySelector('.hero-content');

    const toast = (() => {
      const el = document.createElement('div');
      el.className = 'experience-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
      let timer;
      return message => {
        clearTimeout(timer);
        el.textContent = message;
        el.classList.add('show');
        timer = setTimeout(() => el.classList.remove('show'), 1800);
      };
    })();

    async function copyText(text, message = 'Copied!') {
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      toast(message);
    }

    function animateIn(element, options = {}) {
      if (!element || reduced || !element.animate) return;
      const {
        delay = 0,
        x = 0,
        y = 20,
        scale = .98,
        duration = 560
      } = options;
      element.animate([
        { opacity: 0, transform: `translate(${x}px,${y}px) scale(${scale})`, filter: 'blur(5px)' },
        { opacity: 1, transform: 'translate(0,0) scale(1)', filter: 'blur(0)' }
      ], { duration, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    }

    function onView(elements, callback, threshold = .12) {
      const list = [...elements].filter(Boolean);
      if (!list.length) return;
      if (reduced || !('IntersectionObserver' in window)) {
        list.forEach(callback);
        return;
      }
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          callback(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold, rootMargin: '0px 0px -4% 0px' });
      list.forEach(item => observer.observe(item));
    }

    function createModal() {
      const modal = document.createElement('div');
      modal.className = 'experience-modal';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="experience-dialog" role="dialog" aria-modal="true" aria-label="Image spotlight">
          <button class="experience-close" type="button" aria-label="Close">×</button>
          <img alt="">
          <div class="experience-dialog-copy"><h3></h3><p></p></div>
        </div>`;
      document.body.appendChild(modal);
      const image = modal.querySelector('img');
      const title = modal.querySelector('h3');
      const description = modal.querySelector('p');
      const closeButton = modal.querySelector('.experience-close');
      let previousFocus = null;

      const close = () => {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        previousFocus?.focus?.({ preventScroll: true });
      };
      const open = ({ src, alt, heading, text }, trigger) => {
        previousFocus = trigger || document.activeElement;
        image.src = src;
        image.alt = alt || heading || '';
        title.textContent = heading || alt || 'Spotlight';
        description.textContent = text || '';
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        closeButton.focus({ preventScroll: true });
      };
      closeButton.addEventListener('click', close);
      modal.addEventListener('click', event => { if (event.target === modal) close(); });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal.classList.contains('open')) close();
      });
      return { open, close };
    }

    const modal = createModal();

    /* Shared hero personality. */
    const pageWords = {
      'page-projects': 'BUILD',
      'page-about': 'STORY',
      'page-games': 'PLAY',
      'page-interests': 'DISCOVER',
      'page-social': 'CONNECT'
    };
    if (hero) {
      const glow = document.createElement('span');
      glow.className = 'experience-glow';
      const word = document.createElement('span');
      word.className = 'experience-word';
      word.textContent = pageWords[page] || 'DREI';
      const orbit = document.createElement('span');
      orbit.className = 'experience-orbit';
      hero.prepend(glow, word, orbit);

      hero.addEventListener('pointermove', event => {
        const rect = hero.getBoundingClientRect();
        hero.style.setProperty('--xp-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
        hero.style.setProperty('--xp-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
      });
    }

    const headline = heroContent?.querySelector('h1');
    if (headline && !reduced) {
      const words = headline.textContent.trim().split(/\s+/);
      headline.textContent = '';
      words.forEach((wordText, index) => {
        const span = document.createElement('span');
        span.className = 'headline-word';
        span.textContent = wordText;
        headline.append(span, document.createTextNode(index === words.length - 1 ? '' : ' '));
        span.animate([
          { opacity: 0, transform: 'translateY(18px) rotate(1.5deg)', filter: 'blur(5px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0)' }
        ], { duration: 480, delay: 150 + index * 58, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
      });
    }

    document.querySelectorAll('.card').forEach((card, index) => {
      card.classList.add('experience-card');
      card.style.setProperty('--xp-card-index', index);
    });

    /* Projects: filterable animated gallery. */
    if (page === 'page-projects') {
      const section = document.querySelector('.section');
      const grid = section?.querySelector('.grid');
      const cards = [...(grid?.querySelectorAll('.card') || [])];
      const categories = {
        'DREI Music': 'web',
        'Memory Game': 'games',
        'Jumping Hanni': 'games',
        'Online Resume': 'tools',
        'Slot Machine': 'games',
        'DREI QR': 'tools'
      };

      cards.forEach(card => {
        const title = card.querySelector('h3')?.textContent.trim() || '';
        card.dataset.category = categories[title] || 'web';
        const media = card.querySelector('.media');
        if (media) {
          const status = document.createElement('span');
          status.className = 'project-status';
          status.textContent = title === 'DREI Music' ? 'Featured' : 'Completed';
          media.appendChild(status);
        }
        const arrow = document.createElement('span');
        arrow.className = 'project-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '↗';
        card.appendChild(arrow);
      });

      if (hero && grid) {
        const toolbar = document.createElement('div');
        toolbar.className = 'experience-toolbar';
        toolbar.innerHTML = `
          <div class="filter-group" aria-label="Filter projects">
            <button class="filter-btn" type="button" data-filter="all" aria-pressed="true">All</button>
            <button class="filter-btn" type="button" data-filter="games" aria-pressed="false">Games</button>
            <button class="filter-btn" type="button" data-filter="tools" aria-pressed="false">Tools</button>
            <button class="filter-btn" type="button" data-filter="web" aria-pressed="false">Web</button>
          </div>
          <span class="project-result" aria-live="polite">${cards.length} projects shown</span>`;
        hero.after(toolbar);
        animateIn(toolbar, { y: 12, delay: 260 });
        const result = toolbar.querySelector('.project-result');

        toolbar.querySelectorAll('.filter-btn').forEach(button => {
          button.addEventListener('click', () => {
            const filter = button.dataset.filter;
            toolbar.querySelectorAll('.filter-btn').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
            let shown = 0;
            cards.forEach((card, index) => {
              const match = filter === 'all' || card.dataset.category === filter;
              if (match) {
                shown += 1;
                card.hidden = false;
                if (!reduced) card.animate([
                  { opacity: 0, transform: 'translateY(12px) scale(.96)' },
                  { opacity: 1, transform: 'none' }
                ], { duration: 360, delay: index * 35, easing: 'cubic-bezier(.22,1,.36,1)' });
              } else {
                card.hidden = true;
              }
            });
            result.textContent = `${shown} project${shown === 1 ? '' : 's'} shown`;
          });
        });
      }
    }

    /* About: counters, timeline and copy email. */
    if (page === 'page-about') {
      if (hero) {
        const stats = document.createElement('section');
        stats.className = 'experience-stats';
        stats.innerHTML = `
          <div class="experience-stat"><strong data-target="10">0</strong><span>Academic recognitions</span></div>
          <div class="experience-stat"><strong data-target="5">0</strong><span>Listed skills</span></div>
          <div class="experience-stat"><strong data-target="1">0</strong><span>AI seminar</span></div>`;
        hero.after(stats);
        animateIn(stats, { y: 12, delay: 250 });

        onView(stats.querySelectorAll('[data-target]'), number => {
          const target = Number(number.dataset.target || 0);
          if (reduced) { number.textContent = String(target); return; }
          const started = performance.now();
          const duration = 850;
          const tick = now => {
            const progress = Math.min(1, (now - started) / duration);
            number.textContent = String(Math.round(target * (1 - Math.pow(1 - progress, 3))));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }, .3);
      }

      const timeline = document.querySelector('.timeline');
      if (timeline) {
        const progress = document.createElement('span');
        progress.className = 'timeline-progress';
        timeline.prepend(progress);
        onView([timeline], item => item.classList.add('is-active'), .18);
      }

      document.querySelectorAll('.info-box').forEach(box => {
        if (!box.textContent.includes('@')) return;
        const email = box.querySelector('p')?.textContent.trim();
        if (!email) return;
        const button = document.createElement('button');
        button.className = 'copy-mini';
        button.type = 'button';
        button.textContent = 'Copy email';
        button.addEventListener('click', () => copyText(email, 'Email copied!'));
        box.appendChild(button);
      });
    }

    /* Games: HUD and image spotlight. */
    if (page === 'page-games') {
      if (hero) {
        const hud = document.createElement('div');
        hud.className = 'game-hud';
        hud.innerHTML = `
          <span class="game-hud-label">PLAYER LOADOUT</span>
          <span class="game-chip">PC</span>
          <span class="game-chip">PlayStation 5</span>
          <span class="game-chip">Action + Adventure</span>
          <span class="game-chip">2 linked accounts</span>`;
        hero.after(hud);
        animateIn(hud, { y: 12, delay: 250 });
      }

      document.querySelectorAll('.card:not(a)').forEach(card => {
        const image = card.querySelector('.media img');
        if (!image) return;
        const hint = document.createElement('span');
        hint.className = 'view-artwork';
        hint.textContent = 'View artwork';
        card.querySelector('.media')?.appendChild(hint);
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `View ${card.querySelector('h3')?.textContent || image.alt}`);
        const open = () => modal.open({
          src: image.currentSrc || image.src,
          alt: image.alt,
          heading: card.querySelector('h3')?.textContent || image.alt,
          text: 'Gaming favorite from my collection.'
        }, card);
        card.addEventListener('click', open);
        card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
      });
    }

    /* Interests: random fact and mobile spotlight carousel. */
    if (page === 'page-interests') {
      const facts = [
        'My K-pop favorites come from five different groups.',
        'My playlist mixes R&B, soft rock and classic pop.',
        'My movie picks combine aviation, superheroes and action.',
        'Music and films are a major source of visual inspiration for me.'
      ];
      if (hero) {
        const consoleBox = document.createElement('div');
        consoleBox.className = 'interest-console';
        consoleBox.innerHTML = `<p class="interest-fact" aria-live="polite">${facts[0]}</p><button class="random-fact-btn" type="button">Another fact ✦</button>`;
        hero.after(consoleBox);
        animateIn(consoleBox, { y: 12, delay: 250 });
        let factIndex = 0;
        consoleBox.querySelector('button').addEventListener('click', () => {
          factIndex = (factIndex + 1) % facts.length;
          const fact = consoleBox.querySelector('.interest-fact');
          if (!reduced) fact.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
          fact.textContent = facts[factIndex];
        });
      }

      document.querySelectorAll('.section').forEach(section => {
        const category = section.querySelector('.section-title')?.textContent.trim() || 'Favorite';
        section.querySelectorAll('.card').forEach(card => {
          const media = card.querySelector('.media');
          const image = media?.querySelector('img');
          if (!media || !image) return;
          const chip = document.createElement('span');
          chip.className = 'category-chip';
          chip.textContent = category.replace('Favorite ', '').replace(' favorites', '');
          media.appendChild(chip);
          card.tabIndex = 0;
          card.setAttribute('role', 'button');
          const open = () => modal.open({
            src: image.currentSrc || image.src,
            alt: image.alt,
            heading: card.querySelector('h3')?.textContent || image.alt,
            text: `${card.querySelector('p')?.textContent || category} · ${category}`
          }, card);
          card.addEventListener('click', open);
          card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
        });
      });
    }

    /* Social: availability, copy email and platform badges. */
    if (page === 'page-social') {
      if (hero) {
        const bar = document.createElement('div');
        bar.className = 'social-connect-bar';
        bar.innerHTML = `
          <div class="social-status"><span class="social-status-dot" aria-hidden="true"></span><span>Available for collaboration</span></div>
          <button class="copy-email-btn" type="button">Copy my email</button>`;
        hero.after(bar);
        animateIn(bar, { y: 12, delay: 250 });
        bar.querySelector('button').addEventListener('click', () => copyText('deguzmanleiandreic@gmail.com', 'Email copied!'));
      }

      document.querySelectorAll('.social-card').forEach((card, index) => {
        const name = card.querySelector('h3')?.textContent.trim() || 'Social';
        const badge = document.createElement('span');
        badge.className = 'platform-badge';
        badge.textContent = name;
        card.appendChild(badge);
        onView([card], element => animateIn(element, { x: index % 2 ? 24 : -24, y: 0, delay: (index % 2) * 55 }), .1);
      });
    }

    /* Give sections a subtle one-time motion without ever hiding content. */
    onView(document.querySelectorAll('.section'), section => {
      if (section.dataset.xpAnimated) return;
      section.dataset.xpAnimated = '1';
      animateIn(section, { y: 16, duration: 520 });
    }, .06);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
