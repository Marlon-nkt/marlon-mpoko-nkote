/* =========================================================
   Sommaire latéral
   Se construit tout seul à partir des sections portant un
   attribut data-sommaire="Libellé". Aucune liste à maintenir :
   ajouter une rubrique dans le HTML suffit.
   ========================================================= */
(function () {
  'use strict';

  var sections = [].slice.call(document.querySelectorAll('[data-sommaire]'));
  if (sections.length < 2) return;               // un seul repère, aucun intérêt

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Construction ---------- */
  var nav = document.createElement('nav');
  nav.className = 'sommaire';
  nav.setAttribute('aria-label', 'Sommaire de la page');

  var total = sections.length < 10 ? '0' + sections.length : String(sections.length);

  var compteur = document.createElement('span');
  compteur.className = 'sommaire__compteur';
  compteur.setAttribute('aria-hidden', 'true');
  compteur.innerHTML = '<b>01</b><i>' + total + '</i>';
  nav.appendChild(compteur);

  var items = sections.map(function (section, i) {
    if (!section.id) section.id = 'rubrique-' + (i + 1);

    var lien = document.createElement('a');
    lien.className = 'sommaire__item';
    lien.href = '#' + section.id;

    var numero = (i + 1) < 10 ? '0' + (i + 1) : String(i + 1);
    lien.innerHTML =
      '<span class="sommaire__num" aria-hidden="true">' + numero + '</span>' +
      '<span class="sommaire__tick" aria-hidden="true"></span>' +
      '<span class="sommaire__label">' + section.dataset.sommaire + '</span>';

    nav.appendChild(lien);
    return { lien: lien, section: section, numero: numero };
  });

  document.body.appendChild(nav);

  /* ---------- Rubrique active ---------- */
  // On retient la dernière section dont le haut est passé au-dessus
  // du tiers supérieur de l'écran : c'est celle qu'on est en train de lire.
  function majActive() {
    var seuil = window.innerHeight * 0.34;
    var actif = 0;

    items.forEach(function (item, i) {
      if (item.section.getBoundingClientRect().top <= seuil) actif = i;
    });

    // en tout bas de page, on force la dernière
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      actif = items.length - 1;
    }

    items.forEach(function (item, i) {
      item.lien.classList.toggle('is-active', i === actif);
      if (i === actif) {
        item.lien.setAttribute('aria-current', 'true');
      } else {
        item.lien.removeAttribute('aria-current');
      }
    });

    compteur.firstChild.textContent = items[actif].numero;
  }

  /* ---------- Défilement au clic ---------- */
  items.forEach(function (item) {
    item.lien.addEventListener('click', function (e) {
      e.preventDefault();
      var haut = item.section.getBoundingClientRect().top + window.scrollY;
      var entete = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--header-h'), 10) || 54;

      window.scrollTo({
        top: Math.max(0, haut - entete - 24),
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    });
  });

  /* ---------- Boucle ---------- */
  var enAttente = false;

  function planifier() {
    if (enAttente) return;
    enAttente = true;
    requestAnimationFrame(function () {
      enAttente = false;
      majActive();
    });
  }

  window.addEventListener('scroll', planifier, { passive: true });
  window.addEventListener('resize', planifier, { passive: true });
  window.addEventListener('load', planifier);

  majActive();
})();
