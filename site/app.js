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

const dockLinks = [...document.querySelectorAll('.mobile-dock a')];
const sections = dockLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if ('IntersectionObserver' in window && sections.length && dockLinks.length) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    dockLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`);
    });
  }, { rootMargin: '-34% 0px -54% 0px', threshold: [0.1, 0.35] });
  sections.forEach((section) => observer.observe(section));
}

const faqItems = [...document.querySelectorAll('.faq-item')];
faqItems.forEach((item) => {
  item.addEventListener('toggle', () => {
    const control = item.querySelector('summary i');
    if (control) control.textContent = item.open ? '−' : '+';
    if (item.open) faqItems.forEach((other) => { if (other !== item) other.removeAttribute('open'); });
  });
});
