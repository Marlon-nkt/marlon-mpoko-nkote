/* =========================================================
   Portfom — interactions
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Signale que JS est actif : c'est seulement à ce moment que .reveal
     passe en état masqué (voir style.css). Sans JS, rien n'est caché. */
  document.documentElement.classList.add('js');

  var revealables = [].slice.call(document.querySelectorAll('.reveal'));
  var pending = revealables.slice();

  revealables.forEach(function (el) {
    if (el.dataset.delay) el.style.setProperty('--d', el.dataset.delay);
  });

  /* ---------- Révélation ---------- */
  function show(el) {
    if (el.classList.contains('is-visible')) return;
    el.classList.add('is-visible');

    var index = pending.indexOf(el);
    if (index > -1) pending.splice(index, 1);
  }

  function showAll() {
    revealables.forEach(show);
  }

  /* Contrôle géométrique : révèle tout ce qui est entré dans le champ.
     Sert de complément fiable à l'IntersectionObserver (onglet en
     arrière-plan au chargement, ancre profonde, redimensionnement...). */
  function checkPending() {
    if (!pending.length) return;
    var trigger = window.innerHeight * 0.88;
    pending.slice().forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < trigger && rect.bottom > 0) show(el);
    });
  }

  if (reduceMotion) {
    showAll();
  } else if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    revealables.forEach(function (el) { observer.observe(el); });
  } else {
    checkPending();
  }

  /* =========================================================
     AJUSTEMENT DES TITRES — réduire plutôt que couper.
     Un mot plus long que sa colonne était soit rogné, soit cassé
     en deux (« COMMUNICATION » réclame 283 px dans une colonne de
     250). Plutôt que d'insérer une césure, on rétrécit le texte
     juste assez pour que le mot le plus long tienne sur sa ligne.
     ========================================================= */
  var SEL_AJUSTE = 'h1, h2, h3, h4, [class*="__title"], [class*="__label"],' +
                   ' [class*="__name"], [class*="__company"], [class*="__nom"]';
  var RATIO_MIN = 0.60;    /* en deçà, le titre deviendrait illisible */

  /* Le mètre : un span hors écran auquel on prête les styles du texte
     à mesurer. Un canvas ne saurait pas rendre letter-spacing ni
     text-transform, qui pèsent lourd sur ces titres capitales. */
  var regle = null;

  function metre() {
    if (regle) return regle;
    regle = document.createElement('span');
    regle.setAttribute('aria-hidden', 'true');
    regle.style.cssText = 'position:absolute;left:-9999px;top:0;' +
                          'white-space:pre;visibility:hidden;pointer-events:none;';
    document.body.appendChild(regle);
    return regle;
  }

  var PROPS = ['fontFamily', 'fontWeight', 'fontStyle', 'fontSize', 'fontStretch',
               'letterSpacing', 'wordSpacing', 'textTransform', 'fontVariant'];

  function preterStyles(cible, cs) {
    for (var i = 0; i < PROPS.length; i++) cible.style[PROPS[i]] = cs[PROPS[i]];
  }

  /* Largeur du mot le plus large, chaque nœud de texte étant mesuré
     avec le style de son propre parent : un titre peut contenir un
     petit numéro en exposant qu'il ne faut pas mesurer en corps 40. */
  function largeurMot(el) {
    var m = metre();
    var max = 0;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var noeud;

    while ((noeud = walker.nextNode())) {
      var texte = noeud.nodeValue;
      if (!texte || !texte.trim()) continue;

      var parent = noeud.parentElement;
      if (!parent) continue;
      var cs = window.getComputedStyle(parent);
      if (cs.display === 'none') continue;

      preterStyles(m, cs);

      var mots = texte.trim().split(/\s+/);
      for (var i = 0; i < mots.length; i++) {
        m.textContent = mots[i];
        var w = m.getBoundingClientRect().width;
        if (w > max) max = w;
      }
    }
    return max;
  }

  function placeDispo(el) {
    var cs = window.getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  function ajuster(el) {
    el.style.fontSize = '';                 /* toujours repartir de la taille CSS */

    var dispo = placeDispo(el);
    if (!(dispo > 24)) return;              /* élément masqué ou en ligne : on passe */

    var mot = largeurMot(el);
    if (!mot || mot <= dispo) return;       /* tout tient déjà */

    var base = parseFloat(window.getComputedStyle(el).fontSize);
    if (!base) return;
    var plancher = base * RATIO_MIN;

    /* La largeur est proportionnelle au corps (letter-spacing en em),
       une seule règle de trois suffit presque toujours ; les deux
       passes suivantes rattrapent les arrondis et les unités en px. */
    var taille = base * (dispo / mot) * 0.99;

    for (var passe = 0; passe < 3; passe++) {
      taille = Math.max(taille, plancher);
      el.style.fontSize = taille.toFixed(2) + 'px';
      if (taille <= plancher) return;

      dispo = placeDispo(el);
      if (largeurMot(el) <= dispo) return;
      taille *= 0.96;
    }
  }

  var titres = [].slice.call(document.querySelectorAll(SEL_AJUSTE));

  function ajusterTout() {
    for (var i = 0; i < titres.length; i++) ajuster(titres[i]);
    if (regle) regle.textContent = '';       /* on ne laisse pas traîner le dernier mot mesuré */
  }

  if (titres.length) {
    /* Les polices sont chargées à distance : mesurer avant leur arrivée
       reviendrait à mesurer la police de repli. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajusterTout);
    window.addEventListener('load', ajusterTout);   /* les images posées, les colonnes sont définitives */
    ajusterTout();

    var minuteur = null;
    window.addEventListener('resize', function () {
      clearTimeout(minuteur);
      minuteur = setTimeout(ajusterTout, 150);
    }, { passive: true });
  }

  /* =========================================================
     LECTEURS — l'iframe n'est créée qu'au clic.
     Le composant .player sert aux pages projet ; la page
     audiovisuel a le sien (.vid__frame), traité par son script.
     ========================================================= */
  document.querySelectorAll('.player[data-yt]').forEach(function (cadre) {
    cadre.addEventListener('click', function () {
      if (cadre.dataset.charge) return;
      cadre.dataset.charge = '1';

      var lecteur = document.createElement('iframe');
      lecteur.src = 'https://www.youtube-nocookie.com/embed/' + cadre.dataset.yt + '?autoplay=1&rel=0';
      lecteur.title = cadre.getAttribute('data-titre') || 'Vidéo';
      lecteur.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      lecteur.setAttribute('allowfullscreen', '');
      lecteur.referrerPolicy = 'strict-origin-when-cross-origin';

      cadre.innerHTML = '';
      cadre.appendChild(lecteur);
      cadre.classList.add('is-playing');
    });
  });

  /* ---------- Fil de progression + filet sous le header ---------- */
  var bar = document.querySelector('.progress__bar');
  var header = document.querySelector('.site-header');
  var ticking = false;

  function onFrame() {
    ticking = false;

    var scrolled = window.scrollY;

    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(scrolled / max, 1) : 0) + ')';
    }

    if (header) header.classList.toggle('is-scrolled', scrolled > 8);

    checkPending();
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onFrame);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('load', schedule);
  document.addEventListener('visibilitychange', schedule);

  onFrame();
})();
