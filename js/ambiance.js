/* =========================================================
   Atmosphère cinématique
   Deux choses pilotées au défilement, à partir des sections
   portant data-teinte / data-plan :
     — la teinte de la brume colorée ;
     — le plan photographique de fond, en fondu enchaîné.
   Générique : s'active sur toute page contenant .cine
   ========================================================= */
(function () {
  'use strict';

  var decor = document.querySelector('.cine');
  if (!decor) return;

  var brume = decor.querySelector('.cine__brume');
  var calques = [].slice.call(decor.querySelectorAll('.cine__plan'));
  var zones = [].slice.call(document.querySelectorAll('[data-teinte], [data-plan]'));

  /* ---------- Teinte et plan de fond ---------- */
  var actif = 0, planCourant = null, teinteCourante = null;

  zones.forEach(function (z) {
    if (z.dataset.plan) { var im = new Image(); im.src = z.dataset.plan; }
  });

  function zoneActive() {
    var seuil = window.innerHeight * 0.45;
    var choisie = zones[0];
    zones.forEach(function (z) {
      if (z.getBoundingClientRect().top <= seuil) choisie = z;
    });
    return choisie;
  }

  function majDecor() {
    if (!zones.length) return;
    var z = zoneActive();

    var teinte = z.dataset.teinte;
    if (teinte && teinte !== teinteCourante) {
      teinteCourante = teinte;
      /* posée sur le décor entier et non sur la seule brume : la couche
         de colorisation (.cine__scrim::after) doit hériter des mêmes
         valeurs pour que toutes les nappes parlent la même chromie. */
      decor.style.setProperty('--teinte', teinte);
      if (z.dataset.froid) decor.style.setProperty('--froid', z.dataset.froid);
      if (brume) {
        brume.style.setProperty('--teinte', teinte);
        if (z.dataset.froid) brume.style.setProperty('--froid', z.dataset.froid);
      }
    }

    var plan = z.dataset.plan;
    if (calques.length === 2 && plan && plan !== planCourant) {
      planCourant = plan;
      var suivant = 1 - actif;
      calques[suivant].style.backgroundImage = 'url("' + plan + '")';
      calques[suivant].classList.add('is-on');
      calques[actif].classList.remove('is-on');
      actif = suivant;
    }
  }

  /* ---------- Boucle ---------- */
  var enAttente = false;

  function planifier() {
    if (enAttente) return;
    enAttente = true;
    requestAnimationFrame(function () {
      enAttente = false;
      majDecor();
    });
  }

  window.addEventListener('scroll', planifier, { passive: true });
  window.addEventListener('resize', planifier, { passive: true });
  window.addEventListener('load', planifier);

  majDecor();
})();
