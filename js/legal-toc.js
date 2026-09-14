// ============================================================
// Lockd — Sommaire des pages légales (conditions-utilisation.html,
// politique-confidentialite.html)
//
// Surligne l'entrée du sommaire correspondant à la section visible
// à l'écran (desktop et repli mobile), et laisse le repli mobile se
// refermer une fois qu'on a cliqué un lien — sans ça il reste ouvert
// et mange l'écran sur la section suivante.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const sections = Array.from(document.querySelectorAll('.legal-content > section[id]'));
  const tocLinks = Array.from(document.querySelectorAll('.legal-toc a[href^="#"]'));
  if (!sections.length || !tocLinks.length) return;

  const linksById = new Map();
  tocLinks.forEach((link) => {
    const id = link.getAttribute('href').slice(1);
    linksById.set(id, link);
  });

  let activeId = null;
  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    tocLinks.forEach((link) => link.classList.remove('is-active'));
    const link = linksById.get(id);
    if (link) link.classList.add('is-active');
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
  );
  sections.forEach((section) => observer.observe(section));

  // Repli mobile : on referme après un clic pour retrouver la section.
  const mobileToc = document.querySelector('.legal-toc-mobile');
  if (mobileToc) {
    mobileToc.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        setTimeout(() => { mobileToc.open = false; }, 120);
      });
    });
  }
});
