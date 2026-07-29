(() => {
  'use strict';

  let motionStarted = false;
  let chartsStarted = false;

  const startMotion = () => {
    if (motionStarted) return;
    motionStarted = true;
    document.body.classList.add('dashboard-ready');

    const reveals = [...document.querySelectorAll('.reveal')];
    reveals.forEach(section => {
      section.classList.add('reveal-pending');
      const items = section.querySelectorAll('.dashboard-panel,.goal,.bible-card,.featured-copy,.featured-visual,.section-title,.section-sub');
      items.forEach((item, index) => {
        item.classList.add('stagger-ready');
        item.style.setProperty('--stagger', String(Math.min(index, 8)));
      });
    });

    const showSection = section => {
      section.classList.remove('reveal-pending');
      section.classList.add('is-visible');

      if (section.querySelector('.goal-list')) {
        section.querySelectorAll('.goal-fill').forEach(fill => {
          fill.style.width = fill.dataset.width || '0%';
        });
      }
    };

    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          showSection(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      reveals.forEach(section => observer.observe(section));
    } else {
      reveals.forEach(showSection);
    }

    // Safety fallback: content can never remain invisible.
    window.setTimeout(() => reveals.forEach(showSection), 1800);
  };

  const updateClock = () => {
    const date = document.getElementById('liveDate');
    const time = document.getElementById('liveTime');
    if (!date || !time) return;
    const now = new Date();
    date.textContent = now.toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    time.textContent = now.toLocaleTimeString('en-PH', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const setDailyVerse = () => {
    const text = document.getElementById('dailyVerse');
    const reference = document.getElementById('verseReference');
    if (!text || !reference) return;

    const verses = [
      ['For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.','Jeremiah 29:11'],
      ['I can do all things through Christ who strengthens me.','Philippians 4:13'],
      ['Trust in the Lord with all your heart and lean not on your own understanding.','Proverbs 3:5'],
      ['The Lord is my shepherd; I shall not want.','Psalm 23:1'],
      ['Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.','Joshua 1:9'],
      ['Commit to the Lord whatever you do, and he will establish your plans.','Proverbs 16:3'],
      ['When I am afraid, I put my trust in you.','Psalm 56:3'],
      ['Let all that you do be done in love.','1 Corinthians 16:14'],
      ['The Lord is my strength and my shield; my heart trusts in him, and he helps me.','Psalm 28:7'],
      ['With God all things are possible.','Matthew 19:26'],
      ['Your word is a lamp for my feet, a light on my path.','Psalm 119:105'],
      ['Cast all your anxiety on him because he cares for you.','1 Peter 5:7']
    ];
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((today - yearStart) / 86400000);
    const verse = verses[dayOfYear % verses.length];
    text.textContent = `“${verse[0]}”`;
    reference.textContent = verse[1];
  };

  const createCharts = () => {
    if (chartsStarted || !window.Chart) return;
    const projectCanvas = document.getElementById('projectChart');
    const skillCanvas = document.getElementById('skillChart');
    if (!projectCanvas || !skillCanvas) return;
    chartsStarted = true;

    const chartText = '#111111';
    const chartGrid = 'rgba(0,0,0,.08)';
    const softPink = '#ecb7c5';
    const palePink = '#f6d6de';
    const deepPink = '#d98ea2';
    const lightGray = '#dedede';
    const darkGray = '#6b6b6b';

    new Chart(projectCanvas, {
      type: 'bar',
      data: {
        labels: ['Browser Games','Web Tools','Portfolio Pages','School Projects'],
        datasets: [{
          label: 'Projects',
          data: [3,1,1,1],
          backgroundColor: [softPink,palePink,deepPink,lightGray],
          borderRadius: 12,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { displayColors: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, color: darkGray }, grid: { color: chartGrid } },
          x: { ticks: { color: chartText }, grid: { display: false } }
        }
      }
    });

    new Chart(skillCanvas, {
      type: 'doughnut',
      data: {
        labels: ['HTML','CSS','JavaScript','Database','UI Design'],
        datasets: [{
          data: [30,25,30,10,5],
          backgroundColor: [softPink,palePink,deepPink,lightGray,'#111111'],
          borderColor: '#ffffff',
          borderWidth: 5,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { color: chartText, usePointStyle: true, padding: 18 } }
        }
      }
    });
  };

  document.addEventListener('drei:dashboard-ready', startMotion);

  document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    window.setInterval(updateClock, 1000);
    setDailyVerse();
    createCharts();
    if (document.body.classList.contains('dashboard-ready')) startMotion();
  });
})();
