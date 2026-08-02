/* =========================================================
   Page Audiovisuel — timecode, formes d'onde, éclairage des clips
   Chargé après main.js, uniquement sur audiovisuel.html.
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var FPS = 25;
  var DUREE_TOTALE = 4 * 60 + 12;   // la page entière représente 4 min 12 s

  /* ---------- Formatage timecode HH:MM:SS:FF ---------- */
  function timecode(secondes) {
    var total = Math.max(0, secondes);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = Math.floor(total % 60);
    var f = Math.floor((total % 1) * FPS);
    var p2 = function (n) { return n < 10 ? '0' + n : '' + n; };
    return p2(h) + ':' + p2(m) + ':' + p2(s) + ':' + p2(f);
  }

  /* ---------- Formes d'onde générées ---------- */
  // Suite déterministe : même dessin à chaque chargement, pas de Math.random.
  function amplitude(i) {
    var a = Math.sin(i * 0.55) * 0.5 + Math.sin(i * 1.7) * 0.28 + Math.sin(i * 0.13) * 0.22;
    return Math.round((Math.abs(a) * 0.78 + 0.12) * 100);
  }

  var ondes = [].slice.call(document.querySelectorAll('.wave'));

  function dessinerOndes() {
    ondes.forEach(function (wave) {
      var largeur = wave.clientWidth || 900;
      var nb = Math.max(24, Math.min(120, Math.floor(largeur / 11)));
      if (wave.dataset.nb === String(nb)) return;   // rien à refaire
      wave.dataset.nb = String(nb);

      var decalage = parseInt(wave.dataset.seed || '0', 10);
      var html = '';
      for (var i = 0; i < nb; i++) {
        html += '<i style="--h:' + amplitude(i + decalage) + '%;--i:' + i + '"></i>';
      }
      wave.innerHTML = html;
    });
  }

  dessinerOndes();

  /* ---------- Lecteurs YouTube chargés à la demande ----------
     La miniature reste locale ; l'iframe n'est créée qu'au clic.
     Huit lecteurs chargés d'emblée auraient plombé la page. */
  document.querySelectorAll('.vid__frame[data-yt], .vid__frame[data-src]').forEach(function (cadre) {
    cadre.addEventListener('click', function () {
      if (cadre.dataset.charge) return;
      var titre = cadre.getAttribute('data-titre') || 'Vidéo';
      var lecteur;

      if (cadre.dataset.src) {
        // fichier hébergé ici : lecteur natif
        lecteur = document.createElement('video');
        lecteur.src = cadre.dataset.src;
        lecteur.controls = true;
        lecteur.autoplay = true;
        lecteur.playsInline = true;
        lecteur.setAttribute('aria-label', titre);
        lecteur.className = 'vid__player';
      } else {
        lecteur = document.createElement('iframe');
        lecteur.src = 'https://www.youtube-nocookie.com/embed/' + cadre.dataset.yt + '?autoplay=1&rel=0';
        lecteur.title = titre;
        lecteur.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        lecteur.setAttribute('allowfullscreen', '');
        lecteur.referrerPolicy = 'strict-origin-when-cross-origin';
      }

      cadre.dataset.charge = '1';
      cadre.innerHTML = '';
      cadre.appendChild(lecteur);
      cadre.closest('.vid').classList.add('is-playing');
    });
  });

  /* ---------- Timecodes des clips, déduits de leur position réelle ---------- */
  var clips = [].slice.call(document.querySelectorAll('.clip'));

  function poserTimecodes() {
    // On rapporte les clips à la hauteur totale du document, pas à la hauteur
    // défilable : sinon le dernier clip, qui dépasse le dernier écran,
    // se retrouve écrasé sur la fin de la bobine et affiche une durée nulle.
    var hauteurUtile = document.documentElement.scrollHeight;
    if (hauteurUtile <= 0) return;

    clips.forEach(function (clip) {
      var champ = clip.querySelector('.clip__tc');
      if (!champ) return;

      var haut = clip.offsetTop;
      var bas = haut + clip.offsetHeight;
      var tcIn = timecode(Math.min(haut / hauteurUtile, 1) * DUREE_TOTALE);
      var tcOut = timecode(Math.min(bas / hauteurUtile, 1) * DUREE_TOTALE);

      champ.textContent = tcIn + '  →  ' + tcOut;

      var barre = clip.querySelector('.clip__bar');
      if (barre) {
        var part = Math.min((bas - haut) / hauteurUtile, 1);
        barre.style.setProperty('--w', Math.round(30 + part * 65) + '%');
      }
    });
  }

  /* ---------- Afficheur de timecode ---------- */
  var lecture = document.querySelector('.tc-hud__time');

  function majTimecode() {
    if (!lecture) return;
    var hauteurUtile = document.documentElement.scrollHeight - window.innerHeight;
    var avance = hauteurUtile > 0 ? Math.min(window.scrollY / hauteurUtile, 1) : 0;
    lecture.textContent = timecode(avance * DUREE_TOTALE);
  }

  /* ---------- Clip actif : allume la barre de durée ---------- */
  function eclairerClips() {
    var milieu = window.innerHeight * 0.62;
    clips.forEach(function (clip) {
      var r = clip.getBoundingClientRect();
      clip.classList.toggle('is-lit', r.top < milieu && r.bottom > 0);
    });
  }

  /* ---------- Boucle ---------- */
  var enAttente = false;

  function surTrame() {
    enAttente = false;
    majTimecode();
    eclairerClips();
  }

  function planifier() {
    if (enAttente) return;
    enAttente = true;
    requestAnimationFrame(surTrame);
  }

  window.addEventListener('scroll', planifier, { passive: true });
  window.addEventListener('resize', function () {
    dessinerOndes();
    poserTimecodes();
    planifier();
  }, { passive: true });
  window.addEventListener('load', function () { poserTimecodes(); planifier(); });

  poserTimecodes();
  surTrame();

  if (reduceMotion) {
    clips.forEach(function (c) { c.classList.add('is-lit'); });
  }
})();
