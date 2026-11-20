/* ==========================================================================
   Notícias & Histórias — o blog da Casa do Lago e da Vila Botané.

   Duas páginas: a principal (noticias.html, com as abas por categoria) e a
   matéria (noticia.html?n=<id>). As matérias são uma lista só:
   conteudo.json → noticias.posts, que o Modo Edição grava; enquanto ninguém
   mexer nelas pelo Modo Edição, vale o noticias.json de partida.

   Cada matéria: id, titulo, chapeu, categoria, data (AAAA-MM-DD), linhaFina,
   capa {foto, legenda, credito}, blocos [p | h2 | foto | par], referencias,
   referenciasTitulo, destaque, visivel. A foto de um bloco tem posição:
   'coluna', 'larga', 'esquerda' ou 'direita' (as duas últimas ficam ao lado
   do texto no computador e voltam para a coluna no celular).

   Curtidas e comentários moram numa função do Cloudflare (data-api no
   <body>). Comentário só aparece depois de aprovado no Modo Edição. Sem a
   função no ar, essa parte simplesmente não aparece.

   Tudo o que vem dos dados entra na página como texto, nunca como HTML.
   ========================================================================== */
(function () {
  'use strict';

  var CATS = [['gastronomia', 'Gastronomia'], ['vinhos', 'Vinhos'], ['arte', 'Arte'],
              ['historia', 'História'], ['cultura-geral', 'Cultura geral']];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
               'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var POSICOES = [['coluna', 'Na coluna do texto'], ['larga', 'Larga'], ['esquerda', 'Ao lado do texto, à esquerda'], ['direita', 'Ao lado do texto, à direita']];
  var CHAVE_ABERTA = 'nt-aberta';
  var ZAP = 'https://api.whatsapp.com/send/?text=';

  var DEMO = window.__NT_DEMO || null;                     /* a prévia em arquivo único */
  var API = DEMO ? '' : (document.body.getAttribute('data-api') || '');

  /* ---------- miúdos ---------- */
  function texto(t) {
    var d = document.createElement('div');
    d.textContent = String(t == null ? '' : t);
    return d.innerHTML.replace(/"/g, '&quot;');
  }
  function nomeCat(c) { for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === c) return CATS[i][1]; return ''; }
  function dataBonita(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    return Number(m[3]) + ' de ' + MESES[Number(m[2]) - 1] + ' de ' + m[1];
  }
  /* datas e horas sempre no horário de Brasília, seja onde for que a pessoa
     esteja: o que se grava é o instante (ISO, em UTC); o que se mostra é a hora daqui */
  var BR = 'America/Sao_Paulo';
  function partesBR(d) {
    var r = {};
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: BR, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(d).forEach(function (x) { r[x.type] = x.value; });
    } catch (e) {
      var z = function (n) { return (n < 10 ? '0' : '') + n; };
      var b = new Date(d.getTime() - 3 * 3600 * 1000);   /* Brasília: UTC−3, sem horário de verão */
      r = { year: String(b.getUTCFullYear()), month: z(b.getUTCMonth() + 1), day: z(b.getUTCDate()), hour: z(b.getUTCHours()), minute: z(b.getUTCMinutes()) };
    }
    return r;
  }
  function hoje() { var r = partesBR(new Date()); return r.year + '-' + r.month + '-' + r.day; }
  function agora() { return new Date().toISOString(); }
  /* "19 de novembro de 2026, às 21h22" ou, curto, "19/11/2026, às 21h22" */
  function quandoBR(iso, curto) {
    var d = new Date(iso || '');
    if (isNaN(d.getTime())) return dataBonita(iso);
    var r = partesBR(d);
    var dia = curto ? r.day + '/' + r.month + '/' + r.year : Number(r.day) + ' de ' + MESES[Number(r.month) - 1] + ' de ' + r.year;
    return dia + (/T/.test(String(iso)) ? ', às ' + r.hour + 'h' + r.minute : '');
  }
  function minutos(p) {
    var t = [p.titulo, p.linhaFina].concat((p.blocos || []).map(function (b) { return b.texto || ''; })).join(' ');
    return Math.max(1, Math.round((t.match(/\S+/g) || []).length / 200));
  }
  function slug(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function fotoDe(o) {
    var f = (o && (o.fotoLocal || o.foto)) || '';
    if (DEMO && DEMO.imagens && DEMO.imagens[f]) return DEMO.imagens[f];
    if (/^blob:/.test(f) || /^(\.\/|\/)?img\/[\w\-.\/]+$/.test(f)) return f;
    return '';
  }
  /* confirmação antes de tirar ou apagar; na prévia em arquivo único passa
     direto, porque alguns visualizadores bloqueiam as janelinhas do navegador */
  function pergunta(msg) { return DEMO ? true : confirm(msg); }
  function linkDe(p) { return './noticia.html?n=' + encodeURIComponent(p.id); }
  function porData(a, b) { return String(b.data || '').localeCompare(String(a.data || '')); }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  /* guarda pequena no aparelho; se o navegador não deixar, fica na memória */
  var memoria = {};
  function leLocal(k, padrao) {
    try { var v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) {}
    return Object.prototype.hasOwnProperty.call(memoria, k) ? memoria[k] : padrao;
  }
  function poeLocal(k, v) { memoria[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function leSessao(k) { try { return sessionStorage.getItem(k); } catch (e) { return memoria['s:' + k] || null; } }
  function poeSessao(k, v) { memoria['s:' + k] = v; try { sessionStorage.setItem(k, v); } catch (e) {} }

  /* ==========================================================================
     Curtidas e comentários
     ========================================================================== */
  var Conversa = (function () {
    var pronto = null;
    function chama(caminho, opcoes) {
      return fetch(API + caminho, opcoes || { cache: 'no-store' }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.erro || 'Não deu certo agora. Tente de novo em instantes.');
          return j;
        });
      });
    }
    function posta(caminho, corpo, token) {
      var h = { 'Content-Type': 'application/json' };
      if (token) h.Authorization = 'Bearer ' + token;
      return chama(caminho, { method: 'POST', headers: h, body: JSON.stringify(corpo), cache: 'no-store' });
    }
    function demo(id) { return leLocal('nt-demo:' + id, { curtidas: 0, comentarios: [] }); }
    function guardaDemo(id, d) { poeLocal('nt-demo:' + id, d); }
    return {
      disponivel: function () {
        if (pronto) return pronto;
        if (DEMO) return (pronto = Promise.resolve(true));
        if (!API) return (pronto = Promise.resolve(false));
        return (pronto = chama('noticias/ok').then(function (d) { return !!(d && d.ok); }).catch(function () { return false; }));
      },
      curtiu: function (id) { return !!leLocal('nt-curti:' + id, false); },
      resumo: function (ids) {
        if (DEMO) {
          var r = {};
          ids.forEach(function (id) { var d = demo(id); r[id] = { curtidas: d.curtidas, comentarios: d.comentarios.filter(function (c) { return c.ok; }).length }; });
          return Promise.resolve(r);
        }
        return chama('noticias/resumo?ids=' + encodeURIComponent(ids.join(',')));
      },
      conversa: function (id) {
        if (DEMO) { var d = demo(id); return Promise.resolve({ curtidas: d.curtidas, comentarios: d.comentarios.filter(function (c) { return c.ok; }) }); }
        return chama('noticias/conversa?id=' + encodeURIComponent(id));
      },
      curte: function (id, desfaz) {
        var marca = function (r) { poeLocal('nt-curti:' + id, !desfaz); return r; };
        if (DEMO) { var d = demo(id); d.curtidas = Math.max(0, d.curtidas + (desfaz ? -1 : 1)); guardaDemo(id, d); return Promise.resolve(marca({ curtidas: d.curtidas })); }
        return posta('noticias/curtir', { id: id, desfaz: !!desfaz }).then(marca);
      },
      comenta: function (id, nome, msg, isca) {
        if (DEMO) {
          var d = demo(id);
          d.comentarios.push({ id: uid(), nome: nome, texto: msg, data: new Date().toISOString(), ok: false });
          guardaDemo(id, d);
          return Promise.resolve({ ok: true, pendente: true });
        }
        return posta('noticias/comentar', { id: id, nome: nome, texto: msg, site: isca });
      },
      todos: function (id, token) {
        if (DEMO) return Promise.resolve({ comentarios: demo(id).comentarios });
        return chama('noticias/moderar?id=' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      },
      /* quantos comentários esperam aprovação em cada matéria */
      pendentes: function (token) {
        if (DEMO) {
          var r = {};
          (DEMO.posts || []).forEach(function (p) {
            var n = demo(slug(p.id)).comentarios.filter(function (c) { return !c.ok; }).length;
            if (n) r[slug(p.id)] = n;
          });
          return Promise.resolve(r);
        }
        return chama('noticias/pendentes', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      },
      modera: function (id, cid, acao, token) {
        if (DEMO) {
          var d = demo(id);
          if (acao === 'apagar') d.comentarios = d.comentarios.filter(function (c) { return c.id !== cid; });
          else d.comentarios.forEach(function (c) { if (c.id === cid) { c.ok = true; c.aprovadoEm = new Date().toISOString(); } });
          guardaDemo(id, d);
          return Promise.resolve({ ok: true });
        }
        return posta('noticias/moderar', { id: id, cid: cid, acao: acao }, token);
      }
    };
  })();

  var CORACAO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.4-4.5-9.3-9.2C1.4 7.9 3.4 4.6 6.7 4.6c2 0 3.6 1.1 4.3 2.7.7-1.6 2.3-2.7 4.3-2.7 3.3 0 5.3 3.3 4 6.5-1.9 4.7-9.3 9.2-9.3 9.2z"/></svg>';
  var BALAO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10.5H9.5L5.5 19.5V16H4z"/></svg>';

  /* ==========================================================================
     Uma página (principal ou matéria). Pode ser montada de novo — é o que a
     prévia em arquivo único faz a cada clique.
     ========================================================================== */
  function inicia(op) {
    var PAGINA = op.pagina;
    var params = op.params;
    var raiz = document.getElementById('nt-raiz');
    if (!raiz) return;
    var previa = params.get('previa') === '1';
    var TODOS = [];
    var carregou = false, editando = false, ponte = null, novaPendente = params.get('nova') === '1';
    var aberta = null, filtro = '';

    function visiveis() { return TODOS.filter(function (p) { return p.visivel !== false; }); }
    function porId(id) { for (var i = 0; i < TODOS.length; i++) if (TODOS[i].id === id) return TODOS[i]; return null; }

    function normaliza(lista) {
      var vistos = {};
      return (lista || []).filter(function (p) { return p && typeof p === 'object'; }).map(function (p, i) {
        var id = slug(p.id) || ('materia-' + (i + 1));
        while (vistos[id]) id += '-2';
        vistos[id] = 1;
        var capa = p.capa && typeof p.capa === 'object' ? p.capa : {};
        return {
          _uid: uid(),
          id: id,
          titulo: String(p.titulo || ''),
          chapeu: String(p.chapeu || ''),
          categoria: nomeCat(p.categoria) ? p.categoria : 'cultura-geral',
          data: /^\d{4}-\d{2}-\d{2}$/.test(p.data || '') ? p.data : '',
          linhaFina: String(p.linhaFina || ''),
          capa: { foto: String(capa.foto || ''), legenda: String(capa.legenda || ''), credito: String(capa.credito || '') },
          blocos: (Array.isArray(p.blocos) ? p.blocos : []).filter(function (b) { return b && /^(p|h2|foto|par)$/.test(b.tipo); })
            .map(function (b) {
              var n = { id: String(b.id || ('b' + uid())), tipo: b.tipo };
              if (b.tipo === 'p' || b.tipo === 'h2') n.texto = String(b.texto || '');
              if (b.tipo === 'foto') {
                n.foto = String(b.foto || ''); n.legenda = String(b.legenda || ''); n.credito = String(b.credito || '');
                n.posicao = /^(coluna|larga|esquerda|direita)$/.test(b.posicao || '') ? b.posicao : '';
              }
              if (b.tipo === 'par') n.fotos = [0, 1].map(function (k) {
                var f = (b.fotos || [])[k] || {};
                return { foto: String(f.foto || ''), legenda: String(f.legenda || ''), credito: String(f.credito || '') };
              });
              return n;
            }),
          referenciasTitulo: String(p.referenciasTitulo || ''),
          referencias: String(p.referencias || ''),
          destaque: !!p.destaque,
          visivel: p.visivel !== false,
          criadoEm: ehInstante(p.criadoEm) ? p.criadoEm : '',
          alteradoEm: ehInstante(p.alteradoEm) ? p.alteradoEm : ''
        };
      }).map(function (n) { n._base = JSON.stringify(limpo(n, {})); return n; });
    }
    function ehInstante(x) { return typeof x === 'string' && !isNaN(new Date(x).getTime()) && /T/.test(x); }

    /* Na prévia do Modo Edição, o rascunho que acabou de ser salvo (guardado
       na sessão, porque o GitHub leva um minuto para republicar); fora dela,
       o conteudo.json publicado. Se nenhum fala das notícias, o noticias.json. */
    function carrega() {
      if (DEMO) return Promise.resolve(DEMO.posts);
      var rascunho = null;
      if (previa) { try { rascunho = JSON.parse(leSessao('modo-edicao:rascunho') || 'null'); } catch (e) {} }
      if (rascunho && rascunho.noticias && Array.isArray(rascunho.noticias.posts)) return Promise.resolve(rascunho.noticias.posts);
      var le = function (arq) {
        return fetch(arq, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      };
      return le(previa ? './conteudo-previa.json' : './conteudo.json')
        .then(function (d) { return d || (previa ? le('./conteudo.json') : null); })
        .then(function (d) {
          if (d && d.noticias && Array.isArray(d.noticias.posts)) return d.noticias.posts;
          return le('./noticias.json').then(function (j) {
            if (!j || !Array.isArray(j.posts)) throw new Error('sem notícias');
            return j.posts;
          });
        });
    }

    /* ---------- pedaços das duas páginas ---------- */
    function imgDe(o, alt, lazy) {
      var f = fotoDe(o);
      if (!f) return '<img class="nt-ave" src="' + ((DEMO && DEMO.imagens['./img/passaro-linha.png']) || './img/passaro-linha.png') + '" alt="">';
      return '<img src="' + texto(f) + '" alt="' + texto(alt || '') + '"' + (lazy ? ' loading="lazy"' : '') + ' decoding="async">';
    }
    function chapeuDe(p) {
      return texto(nomeCat(p.categoria)) + (p.chapeu ? ' <span aria-hidden="true">·</span> ' + texto(p.chapeu) : '');
    }
    function metaDe(p, comContas) {
      var d = dataBonita(p.data);
      return '<p class="nt-meta">' + (d ? '<time datetime="' + texto(p.data) + '">' + d + '</time><span aria-hidden="true">·</span>' : '')
        + minutos(p) + ' min de leitura'
        + (comContas ? '<span class="nt-contas" data-contas="' + texto(p.id) + '" hidden></span>' : '') + '</p>';
    }
    function cartao(p) {
      return '<article class="nt-cartao nt-rev' + (p.visivel === false ? ' nt-escondido' : '') + '" data-id="' + texto(p.id) + '">'
        + '<a class="nt-cartao__foto" href="' + linkDe(p) + '" tabindex="-1" aria-hidden="true">' + imgDe(p.capa, '', true)
        + (p.visivel === false ? '<span class="nt-marca">Rascunho</span>' : '') + '</a>'
        + '<p class="nt-rotulo">' + chapeuDe(p) + '</p>'
        + '<h3><a href="' + linkDe(p) + '">' + texto(p.titulo || 'Sem título') + '</a></h3>'
        + metaDe(p, true)
        + (editando ? ferramentasCartao(p) : '')
        + '</article>';
    }
    function revela() {
      var els = raiz.querySelectorAll('.nt-rev:not(.is-vis)');
      if (!('IntersectionObserver' in window) || editando) { els.forEach(function (e) { e.classList.add('is-vis'); }); return; }
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-vis'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      els.forEach(function (e) { io.observe(e); });
    }
    /* curtidas e comentários de cada cartão, numa ida só */
    function preencheContas() {
      var alvos = raiz.querySelectorAll('[data-contas]');
      if (!alvos.length) return;
      Conversa.disponivel().then(function (ok) {
        if (!ok) return;
        var ids = [].map.call(alvos, function (a) { return a.getAttribute('data-contas'); });
        return Conversa.resumo(ids).then(function (r) {
          alvos.forEach(function (a) {
            var c = r[a.getAttribute('data-contas')] || { curtidas: 0, comentarios: 0 };
            /* zero não aparece: matéria nova não fica com cara de esquecida */
            var partes = [], fala = [];
            if (c.curtidas > 0) { partes.push(CORACAO + c.curtidas); fala.push(plural(c.curtidas, 'curtida', 'curtidas')); }
            if (c.comentarios > 0) { partes.push(BALAO + c.comentarios); fala.push(plural(c.comentarios, 'comentário', 'comentários')); }
            if (!partes.length) { a.hidden = true; return; }
            a.innerHTML = partes.map(function (x) { return '<span aria-hidden="true">·</span>' + x; }).join('');
            a.setAttribute('aria-label', fala.join(', '));
            a.hidden = false;
          });
        });
      }).catch(function () {});
    }

    /* ==========================================================================
       A página principal
       ========================================================================== */
    function montaAbas() {
      var nav = document.getElementById('nt-abas');
      if (!nav) return;
      nav.innerHTML = [['', 'Todas']].concat(CATS).map(function (c) {
        return '<a href="./noticias.html' + (c[0] ? '?cat=' + c[0] : '') + '" data-cat="' + c[0] + '"'
          + (filtro === c[0] ? ' aria-current="page"' : '') + '>' + c[1] + '</a>';
      }).join('');
    }

    function montaLista() {
      montaAbas();
      var lista = (editando ? TODOS.slice() : visiveis()).sort(porData);
      if (filtro) lista = lista.filter(function (p) { return p.categoria === filtro; });
      var html = '';
      if (editando) {
        html += '<p class="nt-dica">Notícias em edição. "Editar" abre a matéria para escrever; "Destaque" escolhe a que abre a página; '
          + '"Esconder" guarda como rascunho, fora do site; "Tirar" apaga. Depois, Salvar na barra de baixo.</p>';
      }
      var nova = editando ? '<a class="nt-nova" href="./noticia.html?nova=1' + (filtro ? '&cat=' + filtro : '') + '"><span>+</span>Nova matéria</a>' : '';
      if (!lista.length) {
        html += '<p class="nt-vazio">' + (filtro ? 'Ainda não há histórias em ' + texto(nomeCat(filtro)) + '.' : 'Ainda não há histórias publicadas.')
          + (filtro ? '<a href="./noticias.html" data-cat="">Ver todas</a>' : '') + '</p>'
          + (nova ? '<div class="nt-grade nt-grade--so">' + nova + '</div>' : '');
      } else {
        var d = null;
        for (var i = 0; i < lista.length; i++) if (lista[i].destaque && lista[i].visivel !== false) { d = lista[i]; break; }
        if (!d) d = lista[0];
        var resto = lista.filter(function (p) { return p !== d; });
        html += '<article class="nt-destaque nt-rev' + (d.visivel === false ? ' nt-escondido' : '') + '" data-id="' + texto(d.id) + '">'
          + '<a class="nt-destaque__foto" href="' + linkDe(d) + '" tabindex="-1" aria-hidden="true">' + imgDe(d.capa, '', false)
          + (d.visivel === false ? '<span class="nt-marca">Rascunho</span>' : '') + '</a>'
          + '<div class="nt-destaque__texto">'
          + '<p class="nt-rotulo">' + chapeuDe(d) + '</p>'
          + '<h2><a href="' + linkDe(d) + '">' + texto(d.titulo || 'Sem título') + '</a></h2>'
          + (d.linhaFina ? '<p class="nt-resumo">' + texto(d.linhaFina) + '</p>' : '')
          + metaDe(d, true)
          + '<a class="nt-ler" href="' + linkDe(d) + '">Ler história <span aria-hidden="true">→</span></a>'
          + (editando ? ferramentasCartao(d) : '')
          + '</div></article>';
        /* as categorias que ainda não têm história ficam com o lugar guardado:
           "Em breve" para quem lê; no Modo Edição, o atalho para escrever nela */
        var vagas = '';
        if (!filtro) {
          var tem = {};
          TODOS.forEach(function (p) { if (p.visivel !== false || editando) tem[p.categoria] = 1; });
          vagas = CATS.filter(function (c) { return !tem[c[0]]; }).map(editando ? novaEm : vaga).join('');
        }
        if (resto.length || (nova && !vagas)) html += '<div class="nt-grade">' + resto.map(cartao).join('') + (vagas ? '' : nova) + '</div>';
        if (vagas) html += '<div class="nt-grade nt-grade--vagas' + (resto.length ? ' nt-grade--seguida' : '') + '">' + vagas + '</div>';
      }
      raiz.innerHTML = html;
      revela();
      preencheContas();
      marcaPendentes();
    }

    function vaga(c) {
      return '<article class="nt-cartao nt-vaga nt-rev" aria-label="' + c[1] + ': em breve">'
        + '<div class="nt-cartao__foto" aria-hidden="true">' + imgDe(null, '', true) + '</div>'
        + '<p class="nt-rotulo">' + c[1] + '</p>'
        + '<h3>Em breve</h3>'
        + '<p class="nt-meta">Novas histórias a caminho</p></article>';
    }
    function novaEm(c) {
      return '<a class="nt-nova" href="./noticia.html?nova=1&cat=' + c[0] + '"><span>+</span>Nova matéria<br>em ' + c[1] + '</a>';
    }

    /* no Modo Edição, cada matéria avisa quantos comentários esperam aprovação */
    function marcaPendentes() {
      if (!editando) return;
      Conversa.disponivel().then(function (ok) {
        if (!ok) return;
        return Conversa.pendentes(DEMO ? '' : (leLocalBruto('modo-edicao:token') || '')).then(function (r) {
          raiz.querySelectorAll('.nt-cartao__ferr[data-id]').forEach(function (f) {
            var id = f.getAttribute('data-id'), n = r[id] || 0;
            if (!n || f.querySelector('.nt-pendentes')) return;
            var a = document.createElement('a');
            a.className = 'nt-pendentes';
            a.href = './noticia.html?n=' + encodeURIComponent(id) + '#nt-conversa';
            a.textContent = plural(n, 'comentário para aprovar', 'comentários para aprovar');
            f.appendChild(a);
          });
        });
      }).catch(function () {});
    }

    /* as abas filtram sem recarregar, e o endereço acompanha (dá para mandar o link) */
    function poeFiltro(cat, empurra) {
      filtro = nomeCat(cat) ? cat : '';
      if (empurra && !DEMO) { try { history.pushState({ cat: filtro }, '', urlDaLista(filtro)); } catch (e) {} }
      if (!DEMO) document.title = (filtro ? nomeCat(filtro) + ' · ' : '') + 'Notícias & Histórias · Casa do Lago · Vila Botané';
      montaLista();
    }
    function urlDaLista(cat) {
      var q = new URLSearchParams();
      if (cat) q.set('cat', cat);
      if (params.get('editar') === '1') q.set('editar', '1');
      if (previa) q.set('previa', '1');
      var s = q.toString();
      return './noticias.html' + (s ? '?' + s : '');
    }

    /* ==========================================================================
       A matéria
       ========================================================================== */
    function achaMateria() {
      var id = params.get('n');
      if (!id && (params.get('editar') === '1' || previa)) id = leSessao(CHAVE_ABERTA);
      var p = id ? porId(slug(id)) || porId(id) : null;
      if (!p && !id) p = visiveis().sort(porData)[0] || null;
      if (p && p.visivel === false && !editando && !previa) p = null;
      return p;
    }

    /* o campo: na leitura é texto; na edição, um trecho que se escreve na hora */
    function campo(valor, caminho, vazio, tag) {
      tag = tag || 'span';
      if (!editando) return texto(valor);
      return '<' + tag + ' class="nt-ed" contenteditable="true" spellcheck="true" data-caminho="' + caminho + '" data-vazio="' + texto(vazio) + '">'
        + texto(valor) + '</' + tag + '>';
    }
    function legendaDe(o, base) {
      if (!editando && !o.legenda && !o.credito) return '';
      return '<figcaption>'
        + (o.legenda || editando ? '<span class="nt-legenda">' + campo(o.legenda, base + '.legenda', 'legenda: o que a foto mostra') + '</span>' : '')
        + (o.credito || editando ? '<span class="nt-credito">' + campo(o.credito, base + '.credito', 'crédito: fotografia, autoria, acervo') + '</span>' : '')
        + '</figcaption>';
    }
    function trocaFoto(alvo, o) {
      return editando ? '<label class="nt-ed-foto">' + (fotoDe(o) ? 'Trocar foto' : 'Escolher foto')
        + '<input type="file" accept="image/*" data-foto="' + alvo + '"></label>' : '';
    }
    function bloco(b) {
      var miolo = '';
      if (b.tipo === 'p') miolo = editando ? campo(b.texto, 'b:' + b.id + '.texto', 'Escreva o parágrafo…', 'p') : '<p>' + texto(b.texto) + '</p>';
      else if (b.tipo === 'h2') miolo = editando ? campo(b.texto, 'b:' + b.id + '.texto', 'Intertítulo', 'h2') : '<h2>' + texto(b.texto) + '</h2>';
      else if (b.tipo === 'foto') {
        miolo = '<figure class="nt-fig' + (b.posicao ? ' nt-fig--' + b.posicao : '') + '">'
          + (editando ? '<div class="nt-ed-moldura">' + imgDe(b, b.legenda, true) + trocaFoto('b:' + b.id, b) + '</div>' : imgDe(b, b.legenda, true))
          + legendaDe(b, 'b:' + b.id)
          + (editando ? '<label class="nt-ed-posicao">Posição <select data-posicao="' + texto(b.id) + '">' + POSICOES.map(function (o) {
              return '<option value="' + o[0] + '"' + ((b.posicao || 'coluna') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
            }).join('') + '</select></label>' : '')
          + '</figure>';
      } else if (b.tipo === 'par') {
        miolo = '<div class="nt-par">' + b.fotos.map(function (f, k) {
          var alvo = 'b:' + b.id + '.fotos.' + k;
          return '<figure>' + (editando ? '<div class="nt-ed-moldura">' + imgDe(f, f.legenda, true) + trocaFoto(alvo, f) + '</div>' : imgDe(f, f.legenda, true))
            + legendaDe(f, alvo) + '</figure>';
        }).join('') + '</div>';
      }
      if (!editando) return miolo;
      return '<div class="nt-bloco nt-bloco--' + b.tipo + (b.tipo === 'foto' && /esquerda|direita/.test(b.posicao) ? ' nt-bloco--lado' : '') + '" data-bloco="' + texto(b.id) + '">'
        + '<div class="nt-bloco__ferr"><button type="button" data-acao="sobe" title="Subir" aria-label="Subir">↑</button>'
        + '<button type="button" data-acao="desce" title="Descer" aria-label="Descer">↓</button>'
        + '<button type="button" class="nt-tira" data-acao="tira" title="Tirar este trecho" aria-label="Tirar este trecho">✕</button></div>'
        + miolo + inserir('') + '</div>';
    }
    function inserir(classe) {
      return '<div class="nt-inserir' + classe + '"><button type="button" data-acao="add-p">+ Parágrafo</button>'
        + '<button type="button" data-acao="add-h2">+ Intertítulo</button><button type="button" data-acao="add-foto">+ Foto</button>'
        + '<button type="button" data-acao="add-par">+ Duas fotos</button></div>';
    }
    function fichaDe(p) {
      return '<div class="nt-ficha">'
        + '<label>Categoria <select data-caminho="categoria">' + CATS.map(function (c) {
          return '<option value="' + c[0] + '"' + (p.categoria === c[0] ? ' selected' : '') + '>' + c[1] + '</option>';
        }).join('') + '</select></label>'
        + '<label>Data <input type="date" data-caminho="data" value="' + texto(p.data) + '"></label>'
        + '<label><input type="checkbox" data-caminho="destaque"' + (p.destaque ? ' checked' : '') + '> Destaque na página principal</label>'
        + '<label><input type="checkbox" data-caminho="visivel"' + (p.visivel !== false ? ' checked' : '') + '> Aparece no site</label>'
        + '<a href="./noticias.html">Todas as matérias</a>'
        + (quandoDe(p) ? '<p class="nt-quando">' + texto(quandoDe(p)) + '</p>' : '')
        + '</div>';
    }

    function montaMateria() {
      var p = aberta || (aberta = achaMateria());
      if (!p) {
        raiz.innerHTML = '<section class="nt-nao-achou"><p class="nt-rotulo">Notícias &amp; Histórias</p><h1>Matéria não encontrada</h1>'
          + '<p>Ela pode ter saído do ar. Se acabou de ser publicada pelo Modo Edição, o site leva cerca de um minuto para atualizar: recarregue em instantes.</p>'
          + '<a class="nt-voltar" href="./noticias.html">← Todas as histórias</a></section>';
        return;
      }
      poeSessao(CHAVE_ABERTA, p.id);
      if (!DEMO) document.title = (p.titulo || 'Nova matéria') + ' · Notícias & Histórias';
      var outras = visiveis().filter(function (o) { return o !== p; }).sort(porData).slice(0, 3);
      var endereco = (DEMO ? 'https://www.casadolagobistro.com.br/noticia.html' : location.origin + location.pathname) + '?n=' + encodeURIComponent(p.id);
      var html = (editando ? fichaDe(p) : '')
        + '<article class="nt-materia">'
        + '<header class="nt-materia__cabeca">'
        + '<p class="nt-rotulo nt-trilha"><a href="./noticias.html">Notícias &amp; Histórias</a><span aria-hidden="true">/</span>'
        + '<a href="./noticias.html?cat=' + texto(p.categoria) + '">' + texto(nomeCat(p.categoria)) + '</a>'
        + (p.chapeu || editando ? '<span aria-hidden="true">·</span>' + campo(p.chapeu, 'chapeu', 'chapéu (opcional)') : '') + '</p>'
        + (editando ? campo(p.titulo, 'titulo', 'Título da matéria', 'h1') : '<h1>' + texto(p.titulo) + '</h1>')
        + (editando ? campo(p.linhaFina, 'linhaFina', 'Linha fina: uma ou duas frases que resumem a matéria', 'p').replace('<p class="nt-ed"', '<p class="nt-ed nt-linha-fina"')
                    : (p.linhaFina ? '<p class="nt-linha-fina">' + texto(p.linhaFina) + '</p>' : ''))
        + metaDe(p, false)
        + '</header>';
      if (fotoDe(p.capa) || editando) {
        html += '<figure class="nt-capa nt-rev"><div class="nt-capa__moldura' + (editando ? ' nt-ed-moldura' : '') + '">'
          + imgDe(p.capa, p.titulo, false) + trocaFoto('capa', p.capa) + '</div>' + legendaDe(p.capa, 'capa') + '</figure>';
      }
      html += '<div class="nt-corpo">' + p.blocos.map(bloco).join('') + (editando ? inserir(' nt-inserir--fim') : '') + '</div>';
      html += '<footer class="nt-materia__pe">';
      if (p.referencias || editando) {
        html += '<div class="nt-refs"><p class="nt-rotulo">' + campo(p.referenciasTitulo || (editando ? '' : 'Referências'), 'referenciasTitulo', 'Referências') + '</p>'
          + '<p>' + campo(p.referencias, 'referencias', 'fontes consultadas (opcional)') + '</p></div>';
      }
      html += '<div class="nt-acoes">'
        + '<button type="button" class="nt-curtir" id="nt-curtir" aria-pressed="false" hidden>' + CORACAO + '<span class="nt-curtir__rotulo">Curtir</span><span class="nt-curtir__conta" id="nt-curtidas">0</span></button>'
        + '<a class="nt-ir-comentar" id="nt-ir-comentar" href="#nt-conversa" hidden>' + BALAO + '<span id="nt-conta-comentarios">Comentar</span></a>'
        + '<span class="nt-acoes__mais"><span class="nt-rotulo">Compartilhar</span>'
        + '<a href="' + ZAP + encodeURIComponent((p.titulo || '') + ' ' + endereco) + '" target="_blank" rel="noopener">WhatsApp</a>'
        + '<button type="button" id="nt-copia" data-link="' + texto(endereco) + '">Copiar link</button></span>'
        + '</div>'
        + '<a class="nt-voltar" href="./noticias.html">← Todas as histórias</a>'
        + '</footer></article>'
        + '<section class="nt-conversa" id="nt-conversa" hidden></section>';
      if (outras.length && !editando) {
        html += '<section class="nt-mais"><p class="nt-rotulo">Mais histórias</p><div class="nt-grade nt-grade--so">' + outras.map(cartao).join('') + '</div></section>';
      }
      raiz.innerHTML = html;
      /* foto em pé fica na largura da coluna; deitada sai um pouco dela */
      raiz.querySelectorAll('.nt-fig img').forEach(function (im) {
        var mede = function () { if (im.naturalHeight > im.naturalWidth * 1.05) im.closest('.nt-fig').classList.add('is-vertical'); };
        if (im.complete) mede(); else im.addEventListener('load', mede);
      });
      var copia = document.getElementById('nt-copia');
      if (copia) copia.addEventListener('click', function () {
        var l = copia.getAttribute('data-link');
        var ok = function () { copia.textContent = 'Link copiado ✓'; setTimeout(function () { copia.textContent = 'Copiar link'; }, 2200); };
        if (navigator.clipboard) navigator.clipboard.writeText(l).then(ok, function () {});
      });
      revela();
      preencheContas();
      if (!p._nova) montaConversa(p);
    }

    /* ---------- curtir e comentar ---------- */
    var moderacao = {};                        /* o que a moderação já trouxe, por matéria */
    function montaConversa(p) {
      Conversa.disponivel().then(function (ok) {
        if (!ok || aberta !== p) return;
        var sec = document.getElementById('nt-conversa');
        if (!sec) return;
        sec.hidden = false;
        if (editando) {
          /* no Modo Edição fica só a moderação: curtir e comentar é para quem lê */
          sec.innerHTML = '<h2 class="nt-conversa__titulo">Comentários</h2><div class="nt-moderar" id="nt-moderar"></div>';
          montaModeracao(p, false);
          return;
        }
        var bt = document.getElementById('nt-curtir');
        var ir = document.getElementById('nt-ir-comentar');
        if (!bt) return;
        var curti = Conversa.curtiu(p.id), total = 0, aprovados = 0;
        var pinta = function () {
          bt.setAttribute('aria-pressed', curti ? 'true' : 'false');
          bt.querySelector('.nt-curtir__rotulo').textContent = curti ? 'Curtido' : 'Curtir';
          document.getElementById('nt-curtidas').textContent = total;
          bt.setAttribute('aria-label', (curti ? 'Você curtiu. ' : 'Curtir. ') + plural(total, 'curtida', 'curtidas'));
        };
        var contaComentarios = function () {
          document.getElementById('nt-conta-comentarios').textContent = aprovados ? plural(aprovados, 'comentário', 'comentários') : 'Comentar';
        };
        pinta();
        bt.hidden = false; ir.hidden = false;
        sec.innerHTML = '<h2 class="nt-conversa__titulo">Comentários</h2>'
          + '<div class="nt-conversa__lista" id="nt-comentarios"><p class="nt-conversa__vazio">Carregando…</p></div>'
          + '<form class="nt-comentar" id="nt-comentar" novalidate>'
          + '<p class="nt-rotulo">Deixe seu comentário</p>'
          + '<label class="nt-campo"><span>Nome</span><input name="nome" maxlength="60" autocomplete="name" required></label>'
          + '<label class="nt-campo"><span>Comentário</span><textarea name="texto" rows="4" maxlength="1200" required></textarea></label>'
          + '<label class="nt-isca" aria-hidden="true">Site<input name="site" tabindex="-1" autocomplete="off"></label>'
          + '<div class="nt-comentar__pe"><button type="submit" class="nt-ler">Enviar comentário</button>'
          + '<p class="nt-comentar__aviso" id="nt-comentar-aviso" role="status">Seu nome aparece junto do comentário, que vai ao ar depois de aprovado pela equipe da casa.</p></div>'
          + '</form>';
        var lista = document.getElementById('nt-comentarios');
        Conversa.conversa(p.id).then(function (c) {
          total = c.curtidas || 0; pinta();
          var cs = c.comentarios || [];
          aprovados = cs.length; contaComentarios();
          lista.innerHTML = cs.length ? cs.map(function (x) { return comentario(x, false); }).join('')
            : '<p class="nt-conversa__vazio">Ainda não há comentários. Seja a primeira pessoa a comentar.</p>';
          if (!DEMO && location.hash === '#nt-conversa') sec.scrollIntoView();
        }).catch(function () {
          lista.innerHTML = '<p class="nt-conversa__vazio">Os comentários não carregaram agora.</p>';
        });
        bt.addEventListener('click', function () {
          bt.disabled = true;
          Conversa.curte(p.id, curti).then(function (r) {
            curti = !curti; total = r.curtidas || 0; pinta();
            if (curti) { bt.classList.remove('is-pulso'); void bt.offsetWidth; bt.classList.add('is-pulso'); }
          }).catch(function () {}).then(function () { bt.disabled = false; });
        });
        var form = document.getElementById('nt-comentar');
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var nome = form.nome.value.replace(/\s+/g, ' ').trim(), msg = form.texto.value.replace(/\n{3,}/g, '\n\n').trim();
          var aviso = document.getElementById('nt-comentar-aviso');
          if (!nome || msg.length < 2) { aviso.textContent = 'Escreva seu nome e o comentário.'; aviso.classList.add('is-ruim'); return; }
          var envia = form.querySelector('button'); envia.disabled = true; envia.textContent = 'Enviando…';
          Conversa.comenta(p.id, nome, msg, form.site.value).then(function () {
            form.reset();
            aviso.classList.remove('is-ruim');
            aviso.textContent = 'Recebemos seu comentário. Ele aparece para todos assim que for aprovado.';
            /* quem comentou vê o próprio comentário na hora, marcado como aguardando */
            var vazio = lista.querySelector('.nt-conversa__vazio');
            if (vazio) vazio.remove();
            lista.insertAdjacentHTML('beforeend', comentario({ id: '', nome: nome, texto: msg, data: new Date().toISOString(), ok: false }, false));
          }).catch(function (er) {
            aviso.classList.add('is-ruim'); aviso.textContent = er.message;
          }).then(function () { envia.disabled = false; envia.textContent = 'Enviar comentário'; });
        });
      });
    }
    function comentario(c, comBotoes) {
      return '<article class="nt-comentario' + (c.ok === false ? ' is-pendente' : '') + '" data-cid="' + texto(c.id) + '">'
        + '<p class="nt-comentario__quem"><strong>' + texto(c.nome) + '</strong><span aria-hidden="true">·</span><time datetime="' + texto(c.data) + '">' + quandoBR(c.data) + '</time>'
        + (c.ok === false ? '<em>aguardando aprovação</em>' : '') + '</p>'
        + '<p class="nt-comentario__texto">' + texto(c.texto) + '</p>'
        + (comBotoes && c.aprovadoEm ? '<p class="nt-quando">Aprovado em ' + quandoBR(c.aprovadoEm, true) + ' (horário de Brasília)</p>' : '')
        + (comBotoes ? '<p class="nt-comentario__botoes">' + (c.ok === false ? '<button type="button" data-moderar="aprovar">Aprovar</button>' : '')
          + '<button type="button" class="nt-tira" data-moderar="apagar">Apagar</button></p>' : '')
        + '</article>';
    }
    /* no Modo Edição: todos os comentários da matéria, os que esperam primeiro */
    function montaModeracao(p, recarrega) {
      var caixa = document.getElementById('nt-moderar');
      if (!caixa) return;
      var token = DEMO ? '' : (leLocalBruto('modo-edicao:token') || '');
      var desenha = function (todos) {
        todos = todos.slice().sort(function (a, b) {
          return ((a.ok === false ? 0 : 1) - (b.ok === false ? 0 : 1)) || String(b.data).localeCompare(String(a.data));
        });
        var pend = todos.filter(function (c) { return c.ok === false; }).length;
        caixa.innerHTML = '<p class="nt-rotulo">Moderação <span aria-hidden="true">·</span> '
          + (pend ? plural(pend, 'comentário esperando aprovação', 'comentários esperando aprovação') : 'nenhum comentário esperando') + '</p>'
          + '<p class="nt-moderar__dica">Quem lê o site vê só os comentários aprovados. "Apagar" tira de vez.</p>'
          + (todos.length ? todos.map(function (c) { return comentario(c, true); }).join('') : '<p class="nt-conversa__vazio">Ninguém comentou esta matéria ainda.</p>');
      };
      if (moderacao[p.id] && !recarrega) desenha(moderacao[p.id]);
      else {
        if (!moderacao[p.id]) caixa.innerHTML = '<p class="nt-rotulo">Moderação</p><p class="nt-conversa__vazio">Carregando…</p>';
        Conversa.todos(p.id, token).then(function (r) {
          moderacao[p.id] = r.comentarios || [];
          if (caixa.isConnected) desenha(moderacao[p.id]);
          else { var nova = document.getElementById('nt-moderar'); if (nova) { caixa = nova; desenha(moderacao[p.id]); } }
        }).catch(function (er) {
          caixa.innerHTML = '<p class="nt-rotulo">Moderação</p><p class="nt-conversa__vazio">' + texto(er.message) + '</p>';
        });
      }
      if (!caixa.__ligada) {
        caixa.__ligada = true;
        caixa.addEventListener('click', function (e) {
          var b = e.target.closest('[data-moderar]'); if (!b) return;
          var c = b.closest('[data-cid]'), acao = b.getAttribute('data-moderar');
          if (acao === 'apagar' && !pergunta('Apagar este comentário? Não dá para desfazer.')) return;
          b.disabled = true;
          Conversa.modera(p.id, c.getAttribute('data-cid'), acao, token).then(function () { montaModeracao(p, true); })
            .catch(function (er) { alert(er.message); b.disabled = false; });
        });
      }
    }
    function leLocalBruto(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

    /* ==========================================================================
       Modo Edição

       O modo-edicao.js chama window.__noticias.ligaEdicao(ponte) depois de
       entrar. Cada mudança devolve a lista inteira (ponte.mudou); cada foto
       escolhida segue com ele (ponte.foto), que a envia para img/enviadas
       quando ela clicar em Salvar, e pede a lista final em paraSalvar(fotos).
       ========================================================================== */
    function ferramentasCartao(p) {
      return '<div class="nt-cartao__ferr" data-id="' + texto(p.id) + '">'
        + '<a href="' + linkDe(p) + '">Editar</a>'
        + '<button type="button" data-acao="destaque" aria-pressed="' + !!p.destaque + '">Destaque</button>'
        + '<button type="button" data-acao="visivel">' + (p.visivel === false ? 'Mostrar' : 'Esconder') + '</button>'
        + '<button type="button" class="nt-tira" data-acao="tirar">Tirar</button></div>'
        + (quandoDe(p) ? '<p class="nt-quando">' + texto(quandoDe(p)) + '</p>' : '');
    }
    function avisa() { if (ponte && ponte.mudou) ponte.mudou(paraSalvar(null)); }

    /* onde mora cada campo dentro da matéria: "titulo", "capa.legenda",
       "b:<id>.texto", "b:<id>.fotos.1.credito" */
    function alvoDe(p, caminho) {
      var partes = caminho.split('.'), o = p, i = 0;
      if (partes[0].indexOf('b:') === 0) {
        var id = partes[0].slice(2);
        o = null;
        for (var k = 0; k < p.blocos.length; k++) if (p.blocos[k].id === id) o = p.blocos[k];
        i = 1;
      }
      for (; o && i < partes.length - 1; i++) o = o[partes[i]];
      return o ? { obj: o, chave: partes[partes.length - 1] } : null;
    }
    function poe(p, caminho, valor) {
      var a = alvoDe(p, caminho);
      if (!a) return;
      a.obj[a.chave] = valor;
      /* matéria nova: o endereço nasce do título, enquanto ela não foi salva */
      if (caminho === 'titulo' && p._nova) {
        var base = slug(valor) || p.id, id = base, n = 2;
        while (TODOS.some(function (o) { return o !== p && o.id === id; })) id = base + '-' + (n++);
        p.id = id;
        poeSessao(CHAVE_ABERTA, id);
      }
    }
    function blocoNovo(tipo) {
      var b = { id: 'b' + uid(), tipo: tipo };
      if (tipo === 'p' || tipo === 'h2') b.texto = '';
      if (tipo === 'foto') { b.foto = ''; b.legenda = ''; b.credito = ''; b.posicao = 'coluna'; }
      if (tipo === 'par') b.fotos = [{ foto: '', legenda: '', credito: '' }, { foto: '', legenda: '', credito: '' }];
      return b;
    }
    function focaBloco(id, noFim) {
      var el = raiz.querySelector('[data-bloco="' + id + '"] .nt-ed');
      if (!el) return;
      el.focus();
      if (noFim) {
        var r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
        var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      }
    }

    /* a foto do celular chega com 4000 px: sai daqui com no máximo 1800 px de lado, em webp */
    function reduz(arq, nome) {
      return new Promise(function (ok) {
        if (!/^image\/(jpeg|png|webp|avif)$/i.test(arq.type || '')) return ok(arq);
        var url = URL.createObjectURL(arq), im = new Image();
        im.onload = function () {
          var w = im.naturalWidth, h = im.naturalHeight, f = Math.min(1, 1800 / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * f)); c.height = Math.max(1, Math.round(h * f));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          var sai = function (b) {
            if (!b) return ok(arq);
            try { ok(new File([b], nome + (/webp/.test(b.type) ? '.webp' : '.jpg'), { type: b.type })); } catch (e) { ok(arq); }
          };
          c.toBlob(function (b) { if (b && /webp/.test(b.type)) return sai(b); c.toBlob(sai, 'image/jpeg', 0.86); }, 'image/webp', 0.84);
        };
        im.onerror = function () { URL.revokeObjectURL(url); ok(arq); };
        im.src = url;
      });
    }

    function criaNova() {
      var cat = nomeCat(params.get('cat')) ? params.get('cat') : 'cultura-geral';
      var p = normaliza([{ id: 'nova-materia', titulo: '', categoria: cat, data: hoje(), blocos: [{ id: 'b1', tipo: 'p', texto: '' }] }])[0];
      var id = p.id, n = 2;
      while (porId(id)) id = p.id + '-' + (n++);
      p.id = id; p._nova = true;
      TODOS.unshift(p);
      poeSessao(CHAVE_ABERTA, p.id);
      params.set('n', p.id);
      params.delete('nova');
      if (!DEMO) { try { history.replaceState(null, '', location.pathname + '?' + params.toString()); } catch (e) {} }
      avisa();
    }

    function achaBloco(id) {
      for (var i = 0; aberta && i < aberta.blocos.length; i++) if (aberta.blocos[i].id === id) return aberta.blocos[i];
      return null;
    }

    function ligaNaMateria() {
      raiz.addEventListener('input', function (e) {
        var c = e.target.closest('.nt-ed'); if (!c || !aberta) return;
        var paragrafo = c.tagName === 'P' && c.closest('.nt-bloco');
        poe(aberta, c.getAttribute('data-caminho'), paragrafo ? c.textContent : c.textContent.replace(/\s+/g, ' ').trim());
        avisa();
      });
      raiz.addEventListener('focusout', function (e) {
        var c = e.target.closest && e.target.closest('.nt-ed'); if (!c || !aberta || DEMO) return;
        if (c.getAttribute('data-caminho') === 'titulo') document.title = (aberta.titulo || 'Nova matéria') + ' · Notícias & Histórias';
      });
      raiz.addEventListener('change', function (e) {
        var alvo = e.target; if (!aberta) return;
        var caminho = alvo.getAttribute('data-caminho');
        if (caminho === 'categoria') { aberta.categoria = alvo.value; avisa(); montaMateria(); return; }
        if (caminho === 'data') { aberta.data = alvo.value; avisa(); return; }
        if (caminho === 'destaque') {
          if (alvo.checked) TODOS.forEach(function (o) { o.destaque = false; });
          aberta.destaque = alvo.checked; avisa(); return;
        }
        if (caminho === 'visivel') { aberta.visivel = alvo.checked; avisa(); return; }
        var pos = alvo.getAttribute('data-posicao');
        if (pos) { var bl = achaBloco(pos); if (bl) { bl.posicao = alvo.value; avisa(); montaMateria(); } return; }
        var foto = alvo.getAttribute('data-foto');
        if (foto && alvo.files && alvo.files[0]) {
          var rotulo = alvo.parentNode; rotulo.firstChild.nodeValue = 'Preparando…';
          var p = aberta;
          reduz(alvo.files[0], 'noticia-' + p.id.slice(0, 40)).then(function (arq) {
            var aceita = ponte && ponte.foto ? ponte.foto(p._uid + '|' + foto, arq) : false;
            if (aceita) {
              var o = foto === 'capa' ? p.capa : alvoDe(p, foto + '.x').obj;
              o.fotoLocal = URL.createObjectURL(arq);
              avisa();
            }
            montaMateria();
          });
        }
      });
      /* parágrafo: Enter abre outro; apagar o vazio o tira; colar texto com
         linhas em branco vira vários parágrafos */
      raiz.addEventListener('keydown', function (e) {
        var c = e.target.closest && e.target.closest('.nt-ed'); if (!c || !aberta) return;
        var noBloco = c.closest('.nt-bloco');
        var b = noBloco ? achaBloco(noBloco.getAttribute('data-bloco')) : null;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (!b || b.tipo !== 'p') { c.blur(); return; }
          var s = getSelection(), r = s.rangeCount ? s.getRangeAt(0) : null, depois = '';
          if (r && c.contains(r.startContainer)) {
            var fim = document.createRange(); fim.selectNodeContents(c); fim.setStart(r.startContainer, r.startOffset);
            depois = fim.toString();
            b.texto = c.textContent.slice(0, c.textContent.length - depois.length).replace(/\s+$/, '');
          }
          var novo = blocoNovo('p'); novo.texto = depois.replace(/^\s+/, '');
          aberta.blocos.splice(aberta.blocos.indexOf(b) + 1, 0, novo);
          avisa(); montaMateria(); focaBloco(novo.id, false);
        }
        if (e.key === 'Backspace' && b && b.tipo === 'p' && !c.textContent.length && aberta.blocos.length > 1) {
          e.preventDefault();
          var i = aberta.blocos.indexOf(b);
          aberta.blocos.splice(i, 1);
          avisa(); montaMateria();
          var antes = aberta.blocos[Math.max(0, i - 1)];
          if (antes) focaBloco(antes.id, true);
        }
      });
      raiz.addEventListener('paste', function (e) {
        var c = e.target.closest && e.target.closest('.nt-ed'); if (!c || !aberta) return;
        e.preventDefault();
        var t = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\r/g, '');
        var noBloco = c.closest('.nt-bloco'), b = noBloco ? achaBloco(noBloco.getAttribute('data-bloco')) : null;
        var partes = t.split(/\n\s*\n|\n/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
        if (!b || b.tipo !== 'p' || partes.length < 2) {
          document.execCommand('insertText', false, t.replace(/\s*\n\s*/g, ' '));
          return;
        }
        document.execCommand('insertText', false, partes[0]);
        b.texto = c.textContent;
        var i = aberta.blocos.indexOf(b);
        partes.slice(1).forEach(function (x, k) { var n = blocoNovo('p'); n.texto = x; aberta.blocos.splice(i + 1 + k, 0, n); });
        avisa(); montaMateria();
      });
      raiz.addEventListener('click', function (e) {
        var bt = e.target.closest('button[data-acao]'); if (!bt || !aberta) return;
        var acao = bt.getAttribute('data-acao');
        var noBloco = bt.closest('.nt-bloco'), b = noBloco ? achaBloco(noBloco.getAttribute('data-bloco')) : null;
        var lista = aberta.blocos, i = b ? lista.indexOf(b) : lista.length - 1;
        if (/^add-/.test(acao)) {
          var novo = blocoNovo(acao.slice(4));
          lista.splice(i + 1, 0, novo);
          avisa(); montaMateria();
          focaBloco(novo.id, false);
          return;
        }
        if (!b) return;
        if (acao === 'sobe' && i > 0) { lista.splice(i, 1); lista.splice(i - 1, 0, b); }
        else if (acao === 'desce' && i < lista.length - 1) { lista.splice(i, 1); lista.splice(i + 1, 0, b); }
        else if (acao === 'tira') {
          var tem = (b.texto || '').trim() || b.foto || (b.fotos && (b.fotos[0].foto || b.fotos[1].foto));
          if (tem && !pergunta('Tirar este trecho da matéria?')) return;
          lista.splice(i, 1);
        } else return;
        avisa(); montaMateria();
      });
    }

    function ligaNaLista() {
      raiz.addEventListener('click', function (e) {
        var bt = e.target.closest('.nt-cartao__ferr button[data-acao]'); if (!bt) return;
        var p = porId(bt.parentNode.getAttribute('data-id')); if (!p) return;
        var acao = bt.getAttribute('data-acao');
        if (acao === 'destaque') { var era = p.destaque; TODOS.forEach(function (o) { o.destaque = false; }); p.destaque = !era; }
        else if (acao === 'visivel') p.visivel = p.visivel === false;
        else if (acao === 'tirar') {
          if (!pergunta('Tirar a matéria "' + (p.titulo || 'sem título') + '" do site?\n\nSe for só por um tempo, use "Esconder": ela vira rascunho e volta quando você quiser.')) return;
          TODOS.splice(TODOS.indexOf(p), 1);
        } else return;
        avisa(); montaLista();
      });
    }

    /* a lista que vai para o conteudo.json: sem os campos de trabalho, e com
       as fotos que acabaram de subir no lugar das prévias locais */
    function limpo(p, fotos) {
      var c = JSON.parse(JSON.stringify(p));
      var poeFoto = function (alvo, o) {
        var f = fotos[p._uid + '|' + alvo];
        if (f) o.foto = f;
        delete o.fotoLocal;
      };
      poeFoto('capa', c.capa);
      c.blocos.forEach(function (b) {
        if (b.tipo === 'foto') { poeFoto('b:' + b.id, b); if (!b.posicao) delete b.posicao; }
        if (b.tipo === 'par') b.fotos.forEach(function (f, k) { poeFoto('b:' + b.id + '.fotos.' + k, f); });
      });
      delete c._uid; delete c._nova; delete c._base; delete c.criadoEm; delete c.alteradoEm;
      return c;
    }
    /* a matéria que nasceu ou mudou leva a hora (o instante; a página mostra em
       horário de Brasília). A que não mudou guarda as marcas que já tinha. */
    function paraSalvar(fotos) {
      fotos = fotos || {};
      var instante = agora();
      return TODOS.map(function (p) {
        var c = limpo(p, fotos);
        var mudou = p._nova || JSON.stringify(c) !== p._base;
        var criado = p.criadoEm || (p._nova ? instante : '');
        var alterado = mudou ? instante : p.alteradoEm;
        if (criado) c.criadoEm = criado;
        if (alterado) c.alteradoEm = alterado;
        return c;
      });
    }
    function quandoDe(p) {
      if (p._nova && !p.criadoEm) return 'Matéria nova, ainda não salva';
      var partes = [];
      if (p.criadoEm) partes.push('Criada em ' + quandoBR(p.criadoEm, true));
      if (p.alteradoEm && p.alteradoEm !== p.criadoEm) partes.push('Última mudança em ' + quandoBR(p.alteradoEm, true));
      if (!partes.length) return '';
      return partes.join(' · ') + ' (horário de Brasília)';
    }

    function ligaEdicao(pt) {
      if (editando) return;
      ponte = pt || {};
      editando = true;
      document.documentElement.classList.add('nt-editando');
      if (PAGINA === 'materia') ligaNaMateria(); else ligaNaLista();
      if (carregou) pronto();
    }
    window.__noticias = { ligaEdicao: ligaEdicao, paraSalvar: paraSalvar, recarrega: function (lista) { TODOS = normaliza(lista); pronto(); } };

    function pronto() {
      aberta = null;
      if (PAGINA === 'materia') {
        if (novaPendente) {
          if (!editando) {
            /* a matéria nova só existe no Modo Edição: espera ele entrar */
            var vaiEditar = params.get('editar') === '1' || leSessao('modo-edicao:ligado') === '1' || !!DEMO;
            if (!vaiEditar) { location.replace('./noticias.html'); return; }
            raiz.innerHTML = '<p class="nt-vazio" style="padding:90px 22px">Preparando a nova matéria…</p>';
            return;
          }
          novaPendente = false;
          criaNova();
        }
        montaMateria();
      } else montaLista();
    }

    /* ---------- começa ---------- */
    if (PAGINA === 'lista') {
      filtro = nomeCat(params.get('cat')) ? params.get('cat') : '';
      montaAbas();
      var abas = document.getElementById('nt-abas');
      if (abas) abas.addEventListener('click', function (e) {
        var a = e.target.closest('a[data-cat]');
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        poeFiltro(a.getAttribute('data-cat'), true);
      });
      raiz.addEventListener('click', function (e) {
        var a = e.target.closest('a[data-cat]');
        if (!a) return;
        e.preventDefault();
        poeFiltro(a.getAttribute('data-cat'), true);
      });
      if (!DEMO) {
        addEventListener('popstate', function () { poeFiltro(new URLSearchParams(location.search).get('cat') || '', false); });
        if (filtro) document.title = nomeCat(filtro) + ' · Notícias & Histórias · Casa do Lago · Vila Botané';
      }
    }

    carrega()
      .then(function (lista) { TODOS = normaliza(lista); carregou = true; pronto(); })
      .catch(function () {
        raiz.innerHTML = '<p class="nt-vazio" style="padding:80px 22px">As histórias não carregaram. Tente de novo em instantes.</p>';
      });
  }

  /* ---------- o que vale para a janela toda, uma vez só ---------- */
  /* a linha de leitura no alto da matéria */
  function anda() {
    var barra = document.getElementById('nt-progresso');
    if (!barra) return;
    var a = document.querySelector('.nt-materia');
    if (!a) { barra.style.transform = 'scaleX(0)'; return; }
    var r = a.getBoundingClientRect(), total = r.height - innerHeight;
    var k = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    barra.style.transform = 'scaleX(' + k.toFixed(4) + ')';
  }
  addEventListener('scroll', anda, { passive: true });
  addEventListener('resize', anda);

  /* foto que ainda não chegou ao site (a recém-enviada leva um minuto para o
     GitHub publicar): fica o pássaro no lugar, e a página tenta de novo */
  document.addEventListener('error', function (e) {
    var im = e.target;
    if (!im || im.tagName !== 'IMG' || !im.closest('#nt-raiz') || im.classList.contains('nt-ave')) return;
    var era = im.getAttribute('data-era') || im.getAttribute('src');
    var vez = Number(im.getAttribute('data-vez') || 0);
    if (/^blob:|^data:/.test(era)) return;
    im.setAttribute('data-era', era); im.setAttribute('data-vez', vez + 1);
    im.classList.add('nt-ave'); im.src = './img/passaro-linha.png';
    if (vez < 6) setTimeout(function () {
      var nova = new Image();
      nova.onload = function () { if (im.isConnected) { im.classList.remove('nt-ave'); im.src = nova.src; } };
      nova.src = era + (era.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now();
    }, 15000);
  }, true);

  if (!DEMO) {
    /* a prévia do editor reaplica o rascunho por aqui; as matérias vão junto */
    document.addEventListener('DOMContentLoaded', function () {
      var aplica = window.__aplicaConteudo;
      if (typeof aplica !== 'function') return;
      window.__aplicaConteudo = function (d) {
        var r = aplica.apply(this, arguments);
        if (d && d.noticias && Array.isArray(d.noticias.posts) && window.__noticias && !document.documentElement.classList.contains('nt-editando')) {
          window.__noticias.recarrega(d.noticias.posts);
        }
        return r;
      };
    });
    inicia({ pagina: document.body.getAttribute('data-pagina'), params: new URLSearchParams(location.search) });
    return;
  }

  /* ==========================================================================
     A prévia em arquivo único: as duas páginas no mesmo HTML, trocando no
     clique; curtidas e comentários ficam só neste aparelho; e um botão para
     ver o Modo Edição como a Rachel vai ver (nada é gravado).
     ========================================================================== */
  var moldes = { lista: document.getElementById('nt-molde-lista').innerHTML, materia: document.getElementById('nt-molde-materia').innerHTML };
  var palco = document.getElementById('nt-palco');
  var demoEditando = false, atual = './noticias.html';
  var fala = document.getElementById('nt-demo-fala');
  function avisaDemo(t) {
    fala.textContent = t; fala.classList.add('is-viva');
    clearTimeout(avisaDemo.t); avisaDemo.t = setTimeout(function () { fala.classList.remove('is-viva'); }, 3200);
  }
  var ponteDemo = {
    mudou: function (lista) { DEMO.posts = lista; document.getElementById('nt-demo-estado').textContent = 'Há mudanças (na prévia nada é gravado)'; },
    foto: function () { return true; },
    fala: avisaDemo
  };
  function abre(href) {
    var u = new URL(href, 'https://www.casadolagobistro.com.br/');
    var pag = /\/noticia\.html$/.test(u.pathname) ? 'materia' : 'lista';
    /* matéria nova só existe no Modo Edição */
    if (u.searchParams.get('nova') === '1' && !demoEditando) { u = new URL('./noticias.html', u); pag = 'lista'; }
    atual = './' + u.pathname.replace(/^\//, '') + u.search;
    palco.innerHTML = moldes[pag];
    document.body.setAttribute('data-pagina', pag);
    document.documentElement.classList.remove('nt-editando');
    scrollTo(0, 0);
    inicia({ pagina: pag, params: u.searchParams });
    if (demoEditando && window.__noticias) window.__noticias.ligaEdicao(ponteDemo);
    anda();
    if (u.hash) setTimeout(function () { var alvo = document.querySelector(u.hash); if (alvo) alvo.scrollIntoView({ behavior: 'smooth' }); }, 350);
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    var a = e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href');
    if (/^\.\/noticias?\.html/.test(h)) { e.preventDefault(); abre(h); return; }
    if (/^#/.test(h)) return;
    if (!/^https:\/\/api\.whatsapp\.com/.test(h)) { e.preventDefault(); avisaDemo('Na prévia, os links para fora do blog ficam desligados.'); }
  });
  document.getElementById('nt-demo-editar').addEventListener('click', function () {
    demoEditando = !demoEditando;
    this.textContent = demoEditando ? 'Sair do Modo Edição' : 'Ver o Modo Edição';
    document.getElementById('nt-demo-estado').textContent = demoEditando ? 'Modo Edição (demonstração): nada é gravado' : 'Prévia: ainda não está no site';
    abre(atual);
  });
  abre('./noticias.html');
})();
