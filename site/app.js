const packageButton = document.querySelector('[data-copy]');
const copyFeedback = document.querySelector('.copy-feedback');

if (packageButton && copyFeedback) {
  packageButton.addEventListener('click', async () => {
    const value = packageButton.dataset.copy;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await Promise.race([
        navigator.clipboard.writeText(value),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Clipboard timeout')), 900)),
      ]);
      copyFeedback.textContent = 'Package ID copied: aniraku.anime.app';
    } catch {
      copyFeedback.textContent = 'Package ID: aniraku.anime.app';
    }
  });
}

const sections = [...document.querySelectorAll('main section[id]')];
const dockLinks = [...document.querySelectorAll('.mobile-dock a')];

if ('IntersectionObserver' in window && sections.length && dockLinks.length) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.find((entry) => entry.isIntersecting);
    if (!visible) return;
    dockLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`);
    });
  }, { rootMargin: '-35% 0px -55% 0px' });

  sections.forEach((section) => observer.observe(section));
}
