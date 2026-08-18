/* ==========================================================================
   A DECOLAGEM — o pássaro toma vida na marca e sai voando
   O mesmo voo da landpage (js/main.js), servido como módulo: quem chama diz
   qual é a marca e onde fica o sprite. Nada aqui procura elementos sozinho.
   ========================================================================== */
export function criaDecolagem(o) {
  var marca = o.marca, marcaLinha = o.linha, marcaCor = o.cor, sprite = o.sprite;
  var paradaLinha = o.paradaLinha != null ? o.paradaLinha : 1;
  if (!marca || !sprite) return null;
  var cenaTinta = null;

  function amostraCaminho(A, B, C, D) {
    var pts = [[2*A[0]-B[0], 2*A[1]-B[1]], A, B, C, D, [2*D[0]-C[0], 2*D[1]-C[1]]];
    var out = [], N = 220, s, i;
    for (s = 1; s < pts.length - 2; s++) {
      var p0 = pts[s-1], p1 = pts[s], p2 = pts[s+1], p3 = pts[s+2];
      for (i = 0; i < N; i++) {
        var u = i/N, u2 = u*u, u3 = u2*u;
        out.push([
          0.5*((2*p1[0]) + (-p0[0]+p2[0])*u + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*u2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*u3),
          0.5*((2*p1[1]) + (-p0[1]+p2[1])*u + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*u2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*u3)
        ]);
      }
    }
    out.push([D[0], D[1]]);
    var acc = [0];
    for (i = 1; i < out.length; i++)
      acc[i] = acc[i-1] + Math.sqrt(Math.pow(out[i][0]-out[i-1][0],2) + Math.pow(out[i][1]-out[i-1][1],2));
    return { pts: out, acc: acc, total: acc[acc.length-1] || 1 };
  }

  function noCaminho(cam, frac) {
    var alvo = frac * cam.total, lo = 0, hi = cam.acc.length - 1, mid;
    while (lo < hi - 1) { mid = (lo + hi) >> 1; if (cam.acc[mid] < alvo) lo = mid; else hi = mid; }
    var seg = (cam.acc[hi] - cam.acc[lo]) || 1, u = (alvo - cam.acc[lo]) / seg;
    var a = cam.pts[lo], b = cam.pts[hi];
    return { x: a[0] + (b[0]-a[0])*u, y: a[1] + (b[1]-a[1])*u,
             ang: Math.atan2(b[1]-a[1], b[0]-a[0]) * 180 / Math.PI };
  }

  var QCOLS = 8, QLINHAS = 7, QTOTAL = 50, QFPS = 9, QCICLO = [33, 49], QINICIO = 0;
  /* onde mora o pássaro dentro de cada célula, em fração da célula: x pelo eixo
     do corpo, y pelo miolo escuro. É por esse ponto — e não pelo centro da
     célula — que o sprite encosta na marca, senão a emenda salta.
     Nos índices 20 a 32 a medição crua treme (enquanto o disco existe, a massa
     grossa é o disco), então ali a série é uma rampa suave que termina
     exatamente no valor do ciclo. */
  var QANC = [
    [0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],
    [0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],
    [0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],
    [0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],[0.5000,0.5000],
    [0.5000,0.5000],[0.4236,0.5146],[0.4410,0.5081],[0.4643,0.4995],[0.4952,0.4881],[0.5306,0.4749],
    [0.5674,0.4613],[0.6042,0.4477],[0.6396,0.4345],[0.6705,0.4231],[0.6938,0.4145],[0.7112,0.4080],
    [0.7174,0.4057],
    [0.7174,0.4057],[0.7171,0.4033],[0.7179,0.4082],[0.7174,0.4080],[0.7169,0.4055],[0.7156,0.4056],
    [0.7184,0.4074],[0.7185,0.4073],[0.7164,0.4062],[0.7182,0.4036],[0.7166,0.4061],[0.7161,0.4057],
    [0.7171,0.4070],[0.7178,0.4074],[0.7157,0.4056],[0.7184,0.4060],[0.7189,0.4068]];
  var QMARCA = { fx: 0.4362, fy: 0.5447 };   /* o mesmo ponto em passaro-aquarela.png */
  /* nos quadros 1 a 21 o disco está desenhado na célula, já registrado no centro
     dela: esses encostam pelo CENTRO do disco fixo da marca, não pelo pássaro. */
  var QDISCO = 20;
  var qAtual = 0;
  function quadro(n) {
    if (n > QTOTAL - 1) n = QCICLO[0] + ((n - QCICLO[0]) % (QCICLO[1] - QCICLO[0] + 1));
    qAtual = n;
    var c = n % QCOLS, l = Math.floor(n / QCOLS);
    sprite.style.backgroundPosition = (c * 100 / (QCOLS - 1)) + '% ' + (l * 100 / (QLINHAS - 1)) + '%';
  }

  /* só o azul de água e o verde de folha — nada de ocre nem sépia */
  var TINTAS_ARQ = [16,17,18,19,20,21,22,23,24,25,34,35,36,37,38,39].map(function (n) {
    return 'img/tinta/tinta-' + n + '.png';
  });
  /* os rumos, em graus de tela (y cresce para baixo) */
  var RUMOS = { N: -90, NE: -45, E: 0, SE: 45, S: 90, SO: 135, O: 180, NO: -135 };
  /* cada batida solta um conjunto diferente — o laço dá sete batidas antes de repetir */
  var SOPROS = [
    ['SO', 'NO', 'O'],
    ['N', 'NE', 'E'],
    ['S', 'SE', 'O', 'SO'],
    ['NE', 'SE', 'N'],
    ['NO', 'N', 'SO', 'O'],
    ['S', 'SO', 'SE'],
    ['NE', 'E', 'S'],
    ['NO', 'O', 'S', 'N'],
    ['E', 'SE', 'NE'],
    ['SO', 'S', 'NO']
  ];
  function criaRespingos(z) {
    var cena = document.createElement('div');
    cena.setAttribute('aria-hidden', 'true');
    cena.style.cssText = 'position:fixed;inset:0;z-index:' + z + ';pointer-events:none;overflow:hidden';
    document.body.appendChild(cena);
    cenaTinta = cena;
    TINTAS_ARQ.forEach(function (u) { var im = new Image(); im.src = u; });
    var vivos = [];
    function solta(x, y, forca, raio, batida) {
      var grupo = SOPROS[batida % SOPROS.length];
      for (var i = 0; i < grupo.length; i++) {
        var rad = (RUMOS[grupo[i]] + (Math.random() - 0.5) * 26) * Math.PI / 180;
        var dist = raio * (0.62 + Math.random() * 0.8);
        var lado = raio * (0.16 + Math.random() * 0.5);      /* o quanto ainda voa para fora */
        var im = document.createElement('img');
        im.src = TINTAS_ARQ[(Math.random() * TINTAS_ARQ.length) | 0];
        im.style.cssText = 'position:absolute;left:0;top:0;will-change:transform,opacity';
        var tam = raio * (0.17 + Math.random() * 0.31) * (0.7 + forca * 0.5);   /* metade do que era */
        im.style.width = tam + 'px';
        cena.appendChild(im);
        vivos.push(im);
        var px = x + Math.cos(rad) * dist, py = y + Math.sin(rad) * dist;
        gsap.set(im, { x: px, y: py, xPercent: -50, yPercent: -50,
                       rotation: Math.random() * 360, scale: 0.34, opacity: 0 });
        /* a tinta não seca: a mancha abre, escorre e fica no papel até a página
           virar — quem apaga tudo é o limpa() da troca de página */
        var alvo = 0.62 + Math.random() * 0.3;
        gsap.timeline()
          .to(im, { opacity: alvo, scale: 1, duration: 0.16 + Math.random() * 0.12, ease: 'power2.out' })
          .to(im, { x: px + Math.cos(rad) * lado, y: py + Math.sin(rad) * lado + raio * (0.22 + Math.random() * 0.3),
                    scale: 1.12 + Math.random() * 0.22,
                    duration: 0.95 + Math.random() * 0.75, ease: 'power1.in' }, '>-0.04');
      }
    }
    return { solta: solta, limpa: function () {
      vivos.forEach(function (im) { gsap.killTweensOf(im); if (im.parentNode) im.parentNode.removeChild(im); });
      vivos.length = 0;
    } };
  }
  var respingos = null;

  function voar() {
    if (!sprite || !marca) return 0;
    var galho = marca.querySelector('.marca__galho');
    /* fica parado do quadro 01 ao 22 — 22/QFPS segundos — e do 23 em diante
       é que o voo desloca para a direita */
    var cam = null, dur = 5.30, ESPERA = 22 / 9;
    var larguraEl = 0, alturaEl = 0;                    /* medidos na decolagem */
    var dxD = 0, dyD = 0;                               /* âncora pelo disco da marca */

    (function () {
      var r = marca.getBoundingClientRect();
      /* o pássaro ocupa 0,685 da altura do quadro (medido nos quadros do voo);
         na marca ele preenche a caixa inteira — daí o quadro ser maior que a marca */
      alturaEl = r.height * 1.46;
      larguraEl = alturaEl * 344 / 260;
      var cx = r.left + r.width  * QMARCA.fx;           /* o pássaro dentro da marca */
      var cy = r.top  + r.height * QMARCA.fy;
      /* enquanto o disco está na célula, a âncora é o centro da marca */
      dxD = r.width  * (0.5 - QMARCA.fx);
      dyD = r.height * (0.5 - QMARCA.fy);
      var W = window.innerWidth, H = window.innerHeight;
      /* o caminho segue a direção em que o bicho está DESENHADO: cima-e-direita,
         sem mergulho inicial. Assim ele voa para onde o corpo aponta. */
      cam = amostraCaminho([cx, cy],
                           [cx + W*0.13, cy - H*0.055],
                           [cx + W*0.42, cy - H*0.145],
                           [W + larguraEl*0.8, H*0.16]);
      sprite.style.width  = larguraEl + 'px';
      sprite.style.height = alturaEl + 'px';
      quadro(QINICIO);
      var a0 = QANC[QINICIO];
      gsap.set(sprite, { opacity: 1, x: cx + dxD + larguraEl * (0.5 - a0[0]), y: cy + dyD + alturaEl * (0.5 - a0[1]),
                         xPercent: -50, yPercent: -50, rotation: 0, scale: 1 });
      if (galho) gsap.set(galho, { opacity: 0 });
      /* o disco fica fora da cena: nunca aparece */
      var discoFixo = marca.querySelector('.marca__disco');
      if (discoFixo) {
        discoFixo.style.transition = 'none';
        gsap.set(discoFixo, { opacity: 0 });
      }
      var camadas = [marcaCor, marcaLinha].filter(Boolean);
      if (camadas.length) gsap.set(camadas, { opacity: 0 });
      if (!respingos) respingos = criaRespingos(69);   /* logo abaixo do sprite (z 70) */
      respingos.limpa();
      /* o laço começa AQUI, no mesmo callback que mediu o caminho: em dois
         callbacks separados o GSAP não garante a ordem, e o primeiro quadro
         podia rodar com o caminho ainda nulo — e aí o rAF morria. */
      dispara();
    })();

    function dispara() {
      var t0 = performance.now(), qAnt = -1, batida = 0;
      function passo(ts) {
        var tt = (ts - t0) / 1000;
        if (!cam) { requestAnimationFrame(passo); return; }
        var q = QINICIO + Math.floor(tt * QFPS);
        quadro(q);
        var v = Math.max(0, (tt - ESPERA) / (dur - ESPERA));
        if (v > 1) v = 1;
        var f = v * v * (3 - 2 * v);
        var pos = noCaminho(cam, f);
        var k = Math.min(1, v / 0.16); k = k * k * (3 - 2 * k);
        var ciclo = (q - QCICLO[0]) % (QCICLO[1] - QCICLO[0] + 1);
        var sobe = -Math.cos(2 * Math.PI * ciclo / 17) * 7 * k * (1 - 0.5 * f);
        var esc = 1 - 0.28 * f, a = QANC[qAtual] || QANC[QCICLO[0]];
        var eD = qAtual <= QDISCO ? 1 : 0;   /* o disco manda enquanto está na célula */
        gsap.set(sprite, {
          x: pos.x + eD * dxD + larguraEl * (0.5 - a[0]) * esc,
          y: pos.y + sobe + eD * dyD + alturaEl * (0.5 - a[1]) * esc,
          rotation: 0,   /* nada de inclinar: o desenho já aponta para o rumo */
          scale: esc
        });
        /* uma batida de asa a cada quatro ou cinco quadros do ciclo: é aí que
           a tinta se solta, e o rumo muda a cada batida */
        if (q !== qAnt) {
          qAnt = q;
          var cb = (((q - QCICLO[0]) % 17) + 17) % 17;
          if (respingos && v > 0.015 && (cb === 0 || cb === 2 || cb === 4 || cb === 6 || cb === 8 || cb === 10 || cb === 12 || cb === 15))
            respingos.solta(pos.x, pos.y + sobe, k * (1 - 0.35 * f), larguraEl * esc * 0.36, batida++);
        }
        if (tt < dur) requestAnimationFrame(passo);
      }
      requestAnimationFrame(passo);
    }

    /* acabado o voo, a marca volta ao traço e a tinta seca */
    setTimeout(function () {
      if (marcaLinha) gsap.to(marcaLinha, { opacity: paradaLinha, duration: 0.9 });
      if (respingos) gsap.to(cenaTinta, { opacity: 0, duration: 1.1, onComplete: function () {
        respingos.limpa(); gsap.set(cenaTinta, { opacity: 1 });
      } });
      gsap.to(sprite, { opacity: 0, duration: 0.4 });
    }, dur * 1000);
    return dur;
  }

  function desmonta() {
    if (respingos) respingos.limpa();
    if (cenaTinta && cenaTinta.parentNode) cenaTinta.parentNode.removeChild(cenaTinta);
  }
  return { toca: voar, desmonta: desmonta, dur: 5.30 };
}
