/* =========================================================
   ÉMULSION — la toile générative du fond
   ---------------------------------------------------------
   Le décor n'est plus un empilement de dégradés : c'est une
   seule image peinte en temps réel par la carte graphique.

   Le principe est photochimique plutôt que géométrique. Un champ
   de bruit est replié deux fois sur lui-même (« domain warping »),
   ce qui produit ces volutes d'encre dans l'eau qu'aucun dégradé
   CSS ne sait faire. On y ajoute ce qui signe une image de cinéma :
   des veines de lumière, une traînée anamorphique bleue, la
   halation qui bave autour des hautes lumières, et la dispersion
   chromatique qui écarte le rouge du bleu vers les bords du cadre.

   La chromie vient de la page : ambiance.js pose --teinte et
   --froid sur .cine au fil des sections, la toile les rejoint en
   fondu. Le défilement fait dériver le champ, comme un travelling.

   Sans WebGL, le script ne fait rien et les nappes CSS d'origine
   restent en place : le fond n'est jamais vide.
   ========================================================= */
(function () {
  'use strict';

  var decor = document.querySelector('.cine');
  if (!decor) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Le champ est très doux : le peindre à pleine résolution serait
     du gaspillage pur. On peint petit, le navigateur interpole, et
     le grain de la page (.grain) rend la finition. */
  var ECHELLE = 0.42;
  var FPS = 32;

  var toile = document.createElement('canvas');
  toile.className = 'cine__toile';
  toile.setAttribute('aria-hidden', 'true');

  var gl = null;
  try {
    var opts = { alpha: false, antialias: false, depth: false, stencil: false,
                 powerPreference: 'low-power', preserveDrawingBuffer: false };
    gl = toile.getContext('webgl', opts) || toile.getContext('experimental-webgl', opts);
  } catch (e) { gl = null; }
  if (!gl) return;

  /* ---------------------------------------------------------
     Le fragment shader — c'est là qu'est l'œuvre.
     --------------------------------------------------------- */
  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform float uScroll;',
    'uniform vec3  uChaud;',   /* la dominante de la section */
    'uniform vec3  uFroid;',   /* son contrepoint dans les ombres */
    'uniform vec3  uEclat;',   /* la couleur des hautes lumières */

    'float hash(vec2 p){',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
    '}',

    'float bruit(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',

    /* trois octaves suffisent : le champ est ensuite replié sur
       lui-même, ce qui lui rend toute la finesse qu'on économise ici */
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);',
    '  for (int i = 0; i < 3; i++){',
    '    v += a * bruit(p);',
    '    p = rot * p * 2.03;',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',

    /* Le pli : on ne lit pas le bruit en p mais en p déformé par
       du bruit, deux fois de suite. C\'est ce qui fait les volutes. */
    'float champ(vec2 p, float t, out float veine){',
    '  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.05)),',
    '                fbm(p + vec2(5.2, 1.3)));',
    '  vec2 r = vec2(fbm(p + 2.6 * q + vec2(1.7, 9.2) + t * 0.035),',
    '                fbm(p + 2.6 * q + vec2(8.3, 2.8) - t * 0.028));',
    /*  les veines : une crête de bruit, très resserrée — ce sont les
        filaments de lumière qui traversent la matière */
    '  float c = fbm(p * 1.5 + r * 2.2);',
    '  veine = pow(1.0 - abs(c * 2.0 - 1.0), 7.0);',
    '  return fbm(p + 3.2 * r);',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  vec2 p  = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
    '  float t = uTime;',

    /* le champ dérive lentement, et le défilement l\'emporte.
       L\'échelle décide de tout : trop large, on ne voit qu\'une tache ;
       à 2.6 on lit les volutes, leurs bords et leurs filaments. */
    '  vec2 base = p * 2.6 + vec2(t * 0.014, -uScroll * 1.15 + t * 0.022);',

    /* dispersion chromatique : le rouge et le bleu ne traversent pas
       la lentille au même endroit, l\'écart croît vers les bords */
    '  float bord = dot(p, p);',
    '  vec2 ecart = normalize(p + 1e-5) * (0.005 + 0.019 * bord);',

    '  float vR, vV, vB;',
    '  float fR = champ(base + ecart, t, vR);',
    '  float fV = champ(base,         t, vV);',
    '  float fB = champ(base - ecart, t, vB);',

    '  vec3 f = vec3(fR, fV, fB);',
    '  vec3 veine = vec3(vR, vV, vB);',

    /* Étalonnage en trois plages franches plutôt qu\'un fondu mou :
       le froid tient les creux, le chaud la masse, l\'éclat les crêtes.
       Ce sont les seuils resserrés qui font l\'image — un dégradé long
       redonnerait la bouillie qu\'on cherche justement à éviter. */
    '  vec3 col = uFroid * 0.72;',
    '  col = mix(col, uChaud, smoothstep(0.26, 0.56, f));',
    '  col = mix(col, uEclat, smoothstep(0.54, 0.82, f));',

    /* les filaments, additifs : ce sont eux qui donnent la matière */
    '  col += uEclat * veine * 0.95;',

    /* traînée anamorphique — l\'horizontale bleue des optiques ciné */
    '  float trainee = fbm(vec2(base.x * 0.22, base.y * 4.5) + vec2(t * 0.045, 0.0));',
    '  trainee = pow(max(trainee - 0.40, 0.0) * 1.9, 3.0);',
    '  col += vec3(0.42, 0.68, 1.00) * trainee * 0.85;',

    /* halation : le halo qui bave autour des hautes lumières */
    '  float haut = smoothstep(0.60, 0.98, fV);',
    '  col += uEclat * haut * haut * 0.55;',

    /* CLAIR-OBSCUR — c\'est cette passe qui fait la différence entre
       un papier peint et une image. Un second champ, très lent et très
       large, décide où la lumière a le droit d\'exister : l\'essentiel
       du cadre retombe dans le noir, et deux ou trois zones seulement
       reçoivent la lumière. Sans elle, tout brille et rien ne ressort. */
    '  float masque = fbm(base * 0.30 + vec2(t * 0.008, -t * 0.005));',
    '  masque = smoothstep(0.26, 0.70, masque);',
    '  col *= 0.09 + 2.15 * masque;',

    /* Courbe filmique — elle retient les hautes lumières sans éteindre
       la couleur. Le dénominateur reste haut pour ne pas délaver. */
    '  col = col / (col + 1.15) * 1.80;',
    '  col = pow(col, vec3(0.94, 1.00, 1.08));',   /* léger froid dans les noirs */

    /* on rend au gris ce qu\'il a perdu : saturation relancée */
    '  float gris = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col = mix(vec3(gris), col, 1.28);',

    /* vignettage optique */
    '  float vig = smoothstep(1.35, 0.20, length(p * vec2(0.86, 1.0)));',
    '  col *= 0.34 + 0.66 * vig;',

    /* respiration du noir : jamais un aplat mort */
    '  col += vec3(0.012, 0.011, 0.016);',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compiler(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }

  var vs = compiler(gl.VERTEX_SHADER, VERT);
  var fs = compiler(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  /* un seul triangle qui couvre l'écran : moins de sommets, pas de
     couture au milieu du quad */
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes    = gl.getUniformLocation(prog, 'uRes');
  var uTime   = gl.getUniformLocation(prog, 'uTime');
  var uScroll = gl.getUniformLocation(prog, 'uScroll');
  var uChaud  = gl.getUniformLocation(prog, 'uChaud');
  var uFroid  = gl.getUniformLocation(prog, 'uFroid');
  var uEclat  = gl.getUniformLocation(prog, 'uEclat');

  /* ---------- La toile prend la place des nappes CSS ---------- */
  decor.insertBefore(toile, decor.firstChild);
  decor.classList.add('has-toile');

  /* ---------- Chromie : lue sur .cine, rejointe en fondu ---------- */
  function versRGB(hex) {
    var h = (hex || '').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return null;
    var n = parseInt(h, 16);
    if (isNaN(n)) return null;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  /* l'éclat n'est pas la teinte : c'est ce qu'elle devient quand la
     lumière la traverse — désaturée vers le blanc chaud */
  function eclatDe(c) {
    return [Math.min(1, c[0] * 0.55 + 0.62),
            Math.min(1, c[1] * 0.55 + 0.50),
            Math.min(1, c[2] * 0.55 + 0.34)];
  }

  var chaud = [0.87, 0.51, 0.22], chaudCible = chaud.slice();
  var froid = [0.13, 0.53, 0.40], froidCible = froid.slice();
  var eclat = eclatDe(chaud);

  function relireChromie() {
    var cs = getComputedStyle(decor);
    var c = versRGB(cs.getPropertyValue('--teinte'));
    var f = versRGB(cs.getPropertyValue('--froid'));
    if (c) chaudCible = c;
    if (f) froidCible = f;
  }

  function rejoindre(a, b, k) {
    a[0] += (b[0] - a[0]) * k;
    a[1] += (b[1] - a[1]) * k;
    a[2] += (b[2] - a[2]) * k;
  }

  /* ---------- Dimensions ---------- */
  var largeur = 0, hauteur = 0;

  /* Budget en pixels plutôt qu'en facteur d'échelle : sur un écran
     Retina en 27 pouces, un simple facteur ferait exploser la surface
     à peindre et le coût avec elle. Le champ étant très doux, plafonner
     ne se voit pas — mais se sent, sur les machines modestes. */
  var BUDGET = 420000;

  function redimensionner() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(window.innerWidth  * dpr * ECHELLE));
    var h = Math.max(1, Math.round(window.innerHeight * dpr * ECHELLE));
    if (w * h > BUDGET) {
      var k = Math.sqrt(BUDGET / (w * h));
      w = Math.max(1, Math.round(w * k));
      h = Math.max(1, Math.round(h * k));
    }
    if (w === largeur && h === hauteur) return;
    largeur = w; hauteur = h;
    toile.width = w; toile.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  }

  /* ---------- Boucle ---------- */
  var depart = performance.now();
  var dernier = 0;
  var intervalle = 1000 / FPS;
  var enCours = false;
  var defile = 0;

  function peindre(maintenant) {
    if (!enCours) return;
    requestAnimationFrame(peindre);
    if (maintenant - dernier < intervalle) return;
    dernier = maintenant;

    relireChromie();
    rejoindre(chaud, chaudCible, 0.02);
    rejoindre(froid, froidCible, 0.02);
    eclat = eclatDe(chaud);

    var h = document.documentElement.scrollHeight - window.innerHeight;
    defile = h > 0 ? window.scrollY / h : 0;

    gl.uniform1f(uTime, (maintenant - depart) / 1000);
    gl.uniform1f(uScroll, defile);
    gl.uniform3f(uChaud, chaud[0], chaud[1], chaud[2]);
    gl.uniform3f(uFroid, froid[0], froid[1], froid[2]);
    gl.uniform3f(uEclat, eclat[0], eclat[1], eclat[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function unePasse() {
    relireChromie();
    chaud = chaudCible.slice();
    froid = froidCible.slice();
    eclat = eclatDe(chaud);
    var h = document.documentElement.scrollHeight - window.innerHeight;
    gl.uniform1f(uTime, 12.0);
    gl.uniform1f(uScroll, h > 0 ? window.scrollY / h : 0);
    gl.uniform3f(uChaud, chaud[0], chaud[1], chaud[2]);
    gl.uniform3f(uFroid, froid[0], froid[1], froid[2]);
    gl.uniform3f(uEclat, eclat[0], eclat[1], eclat[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function demarrer() {
    if (enCours || reduceMotion) return;
    enCours = true;
    dernier = 0;
    requestAnimationFrame(peindre);
  }
  function arreter() { enCours = false; }

  redimensionner();

  if (reduceMotion) {
    /* mouvement réduit : une seule image, fixe, mais l'œuvre est là */
    unePasse();
    window.addEventListener('scroll', function () { redimensionner(); unePasse(); }, { passive: true });
  } else {
    demarrer();
  }

  window.addEventListener('resize', function () {
    redimensionner();
    if (reduceMotion) unePasse();
  }, { passive: true });

  /* onglet en arrière-plan : on ne peint pas dans le vide */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) arreter(); else demarrer();
  });

  /* si le contexte est perdu (veille, changement de GPU), on rend la
     main aux nappes CSS plutôt que de laisser un cadre noir */
  toile.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    arreter();
    decor.classList.remove('has-toile');
  });
  toile.addEventListener('webglcontextrestored', function () {
    decor.classList.add('has-toile');
    redimensionner();
    demarrer();
  });
})();
