// ============================================================
// Lockd — effet « roulette » sur les liens de la barre de nav
// Au survol, chaque lettre défile verticalement à travers des caractères
// aléatoires avant de s'arrêter sur la bonne, avec un léger décalage
// lettre par lettre (comme une machine à sous).
// ============================================================
(() => {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const REEL_LENGTH = 8; // caractères aléatoires avant la lettre finale
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const randomChar = () => CHARS[Math.floor(Math.random() * CHARS.length)];

  document.querySelectorAll('.nav__links a, .nav__mobile a').forEach((link) => {
    const original = link.textContent;

    link.innerHTML = Array.from(original).map((ch) => {
      if (ch === ' ') return ' ';
      const isLower = ch === ch.toLowerCase() && ch !== ch.toUpperCase();
      const reel = Array.from({ length: REEL_LENGTH }, () => {
        const c = randomChar();
        return isLower ? c.toLowerCase() : c;
      }).concat(ch);
      const spans = reel.map((c) => `<span>${c}</span>`).join('');
      // La case reçoit ensuite la largeur de la lettre réelle : sans ça, elle
      // prendrait celle du caractère aléatoire le plus large de sa colonne —
      // différent à chaque rechargement — et l'espacement sautait d'un essai
      // à l'autre.
      return `<span class="rls-char" data-final="${ch}"><span class="rls-char__reel" style="transform: translateY(-${REEL_LENGTH * 1.4}em)">${spans}</span></span>`;
    }).join('');

    // Chaque case prend la largeur de sa lettre finale, mesurée hors écran
    // avec la même police, plutôt que celle — aléatoire — de son contenu.
    const measurer = document.createElement('span');
    measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;top:-9999px;left:-9999px;';
    measurer.style.font = getComputedStyle(link).font;
    document.body.appendChild(measurer);
    link.querySelectorAll('.rls-char').forEach((box) => {
      measurer.textContent = box.dataset.final;
      box.style.width = `${measurer.getBoundingClientRect().width}px`;
    });
    measurer.remove();

    if (reduced) return;
    const reels = link.querySelectorAll('.rls-char__reel');
    if (!reels.length) return;

    link.addEventListener('mouseenter', () => {
      reels.forEach((reel, i) => {
        // Repart du haut de la colonne, puis redescend jusqu'à la lettre finale,
        // avec un léger décalage pour un effet de vague lettre par lettre.
        reel.style.transition = 'none';
        reel.style.transform = 'translateY(0)';
        // Force le reflow pour que le "none" soit bien appliqué avant de ranimer.
        void reel.offsetHeight;
        reel.style.transition = `transform .6s cubic-bezier(.2,.85,.3,1) ${i * 35}ms`;
        reel.style.transform = `translateY(-${REEL_LENGTH * 1.4}em)`;
      });
    });
  });
})();
