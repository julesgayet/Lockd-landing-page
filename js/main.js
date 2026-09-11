// ============================================================
// Lockd — Landing page interactions
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Nav bar: transparent at top, tinted once scrolled ----------
  const nav = document.querySelector('.nav');
  if (nav) {
    const SCROLL_THRESHOLD = 24;
    const syncNavState = () => {
      nav.classList.toggle('nav--scrolled', window.scrollY > SCROLL_THRESHOLD);
    };
    syncNavState();
    window.addEventListener('scroll', syncNavState, { passive: true });
  }

  // ---------- Mobile menu ----------
  const burger = document.getElementById('burgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(isOpen));
      burger.classList.toggle('is-open', isOpen);
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---------- Nav pill (sliding highlight on hover) ----------
  const navPill = document.getElementById('navPill');
  if (navPill) {
    const cursor = navPill.querySelector('.nav__cursor');
    const links = navPill.querySelectorAll('a');
    links.forEach((link) => {
      link.addEventListener('mouseenter', () => {
        cursor.style.left = link.offsetLeft + 'px';
        cursor.style.width = link.offsetWidth + 'px';
        cursor.style.opacity = '1';
      });
    });
    navPill.addEventListener('mouseleave', () => {
      cursor.style.opacity = '0';
    });
  }

  // ---------- Hero rotating word ----------
  const rotatingWord = document.getElementById('rotatingWord');
  if (rotatingWord && !reduced) {
    const words = [
      'la salle de sport',
      'se lever tôt',
      'les repas faits maison',
      'la marche quotidienne',
      'un mode de vie sain !'
    ];
    let i = 0;
    setInterval(() => {
      rotatingWord.classList.add('is-leaving');
      setTimeout(() => {
        i = (i + 1) % words.length;
        rotatingWord.textContent = words[i];
        rotatingWord.classList.remove('is-leaving');
        rotatingWord.classList.add('is-entering');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => rotatingWord.classList.remove('is-entering'));
        });
      }, 300);
    }, 2600);
  }

  // ---------- Tilt cards (lean toward the cursor, glow follows) ----------
  if (!reduced) {
    const MAX_TILT = 6;
    document.querySelectorAll('.tilt').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        card.style.setProperty('--tilt-x', `${(0.5 - y) * MAX_TILT}deg`);
        card.style.setProperty('--tilt-y', `${(x - 0.5) * MAX_TILT}deg`);
        card.style.setProperty('--glow-x', `${x * 100}%`);
        card.style.setProperty('--glow-y', `${y * 100}%`);
        card.style.setProperty('--glow-opacity', '1');
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
        card.style.setProperty('--glow-opacity', '0');
      });
    });
  }

  // ---------- Steps timeline (draws in once, on scroll) ----------
  const stepsTimeline = document.getElementById('stepsTimeline');
  if (stepsTimeline && 'IntersectionObserver' in window) {
    if (reduced) {
      stepsTimeline.classList.add('is-shown');
    } else {
      const timelineObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              stepsTimeline.classList.add('is-shown');
              timelineObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.6 }
      );
      timelineObserver.observe(stepsTimeline);
    }
  }

  // ---------- Scroll reveal ----------
  // Cards with their own `.tilt` transform (goal-tile, trust-card) only fade
  // in: animating translateY on top of tilt's own perspective transform
  // would mean two mechanisms fighting over the same CSS property.
  const riseTargets = document.querySelectorAll('.step, .stat-card, .faq-item');
  const fadeTargets = document.querySelectorAll('.goal-tile.tilt, .trust-card.tilt');

  riseTargets.forEach((el) => el.classList.add('reveal-rise'));
  fadeTargets.forEach((el) => el.classList.add('reveal-fade'));

  if ('IntersectionObserver' in window && (riseTargets.length || fadeTargets.length)) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            el.style.transitionDelay = `${(i % 4) * 80}ms`;
            el.classList.add('is-visible');
            revealObserver.unobserve(el);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    riseTargets.forEach((el) => revealObserver.observe(el));
    fadeTargets.forEach((el) => revealObserver.observe(el));
  }

  // ---------- Placeholder legal links ----------
  document.querySelectorAll('a[data-placeholder="true"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
    });
  });
});
