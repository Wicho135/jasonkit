'use strict';

/**
 * Comportamiento común del sitio.
 */
(() => {
  const year = document.getElementById('year');

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const nav = document.querySelector('.site-nav');
  const activeLink = nav ? nav.querySelector('[aria-current="page"]') : null;

  if (nav && activeLink && nav.scrollWidth > nav.clientWidth) {
    activeLink.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
})();
