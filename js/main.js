// ============================================================
// Lockd — Landing page interactions
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Nav bar: transparent at top, tinted once scrolled ----------
  const nav = document.querySelector('.nav');
  if (nav) {
    // La barre reste transparente tant qu'on est sur le fond bleu du hero.
    const hero = document.querySelector('.hero');
    const syncNavState = () => {
      const scrolled = hero
        ? hero.getBoundingClientRect().bottom <= nav.offsetHeight
        : window.scrollY > 24;
      nav.classList.toggle('nav--scrolled', scrolled);
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

  // ---------- Hero : l'iPhone se couche et ses écrans ressortent en relief ----------
  const csContainer = document.getElementById('containerScroll');
  const csPhone = document.getElementById('csPhone');
  const csFit = document.querySelector('.iphone-stage');
  if (csContainer && csPhone && csFit) {
    const pages = csPhone.querySelectorAll('.ui-page');
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = csContainer.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const raw = span > 0 ? -rect.top / span : 1;
      const p = reduced ? 0.6 : ease(Math.min(1, Math.max(0, raw)));
      csPhone.style.transform = `rotateX(${55 * p}deg) rotateZ(${-14 * p}deg) translateX(${-200 * p}px)`;
      const narrow = window.innerWidth <= 900;
      const colW = narrow ? window.innerWidth - 32 : csFit.parentElement.clientWidth / 2;
      const fit = Math.min(1, (window.innerHeight - (narrow ? 420 : 110)) / 640, colW / (320 + 360 * p));
      csFit.style.transform = `translateY(${28 + 20 * p}px) scale(${fit * (1 - 0.16 * p)})`;
      // Les écrans sortent de l'iPhone en éventail : chacun plus haut et plus décalé
      pages.forEach((el) => {
        const i = Number(el.dataset.i) || 0;
        // Au repos, « Tu t'es engagé » (le dernier écran) couvre les autres : il s'éloigne le premier.
        el.style.transform = `translate3d(${i * 150 * p}px, ${-i * 30 * p}px, ${(i * 70 + 4) * p + 2 + i}px)`;
      });
      csPhone.classList.toggle('is-lifted', p > 0.15);
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
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
