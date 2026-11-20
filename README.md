# Casa do Lago — Vassouras, Vale do Café (RJ)

Site do bistrô Casa do Lago. HTML, CSS e JavaScript estáticos, sem build e sem
back-end: pode ser servido por qualquer servidor de arquivos.

| Página | Arquivo | O que é |
| --- | --- | --- |
| Casa do Lago | `index.html` | A casa (dia/noite), Rachel Porto, horta, cardápio, experiências e reservas por WhatsApp. |
| Portal | `portal.html` | Porta de entrada das duas casas irmãs; o clique dispara o voo do pássaro. |
| Cardápio | `cardapio_casalago.html` | Carta com abas e ficha por prato. |
| Casamentos | `casamentos_casa_lago.html` | Capa em tela cheia, texto e galeria de dezesseis fotos. |
| Notícias & Histórias | `noticias.html`, `noticia.html` | O blog das duas casas: página principal com abas por categoria e a matéria diagramada, com fotos, legendas e créditos. |

A casa irmã, Vila Botané, é um site à parte:
<https://gabriellroque9017-lab.github.io/vilabotane-site/>

## Rodar na sua máquina

Os vídeos não funcionam abrindo o arquivo direto (`file://`). Suba um servidor:

```bash
npx serve .
# abra http://localhost:3000/
```

## Publicação

GitHub Pages, branch `main`, pasta raiz. Endereço:
<https://gabriellroque9017-lab.github.io/casadolago-site/>

Para trocar por um domínio próprio: crie um arquivo `CNAME` na raiz com o
domínio, aponte o DNS para o GitHub Pages e atualize os links que apontam para
a Vila Botané (busque por `github.io` nas páginas).

## Antes de mexer

- **Notícias & Histórias** (`noticias.html` e `noticia.html?n=<id>`), para a
  Casa do Lago e a Vila Botané: os menus dos dois sites levam para cá. As
  matérias são uma lista só, em `conteudo.json` → `noticias.posts`; enquanto
  ninguém mexer nelas pelo Modo Edição, vale o `noticias.json`. Cada matéria
  tem título, chapéu, categoria (gastronomia, vinhos, arte, historia,
  cultura-geral), data, linha fina, capa com legenda e crédito, blocos
  (parágrafo, intertítulo, foto, duas fotos) e referências. A montagem é do
  `js/noticias.js` e o desenho do `css/noticias.css`.
  No Modo Edição, a página principal ganha "Editar", "Destaque", "Esconder"
  (rascunho), "Tirar" e "+ Nova matéria"; a matéria abre todos os campos,
  troca de foto, e cada trecho ganha subir, descer, tirar e "+ Parágrafo /
  Intertítulo / Foto / Duas fotos". Enter abre um parágrafo novo e texto
  colado com linhas em branco vira vários parágrafos. Cada foto tem posição:
  na coluna, larga, ou ao lado do texto (esquerda/direita), que no celular
  volta para o meio da coluna.
  Curtidas e comentários moram numa função do Cloudflare à parte,
  `casadolago-noticias` (endereço no `data-api` do `<body>` e no
  `connect-src` das duas páginas), com um KV chamado `NOTICIAS`. O código e
  o passo a passo ficam fora deste repositório. Comentário só aparece depois
  de aprovado: no Modo Edição, a página principal mostra quantos esperam e a
  matéria traz "Aprovar" e "Apagar". Sem a função no ar, essa parte some e o
  resto do blog segue normal.
  Cada matéria guarda `criadoEm` e `alteradoEm` (instantes em ISO/UTC,
  marcados ao Salvar quando ela nasce ou muda); o Modo Edição mostra essas
  horas, e as dos comentários, no horário de Brasília. Categoria sem matéria
  aparece na página principal como "Em breve" (no Modo Edição, como atalho
  para escrever nela).

- O layout, as cores, a tipografia, os textos e todas as animações estão
  aprovados pelo cliente. Não é um projeto para redesenhar.
- Sem framework e sem build: GSAP entra por CDN, o resto é HTML puro.
- Não use travessão (—) nos textos: decisão do cliente.
- Os formulários não vão a servidor nenhum: montam a mensagem e abrem o
  WhatsApp (reservas (24) 99930-9828, cerimonial +55 24 99993-6927).
- As bebidas do cardápio ainda não têm foto: a ficha abre no layout sem
  imagem. Para dar foto a uma delas, basta pôr um `src` no `<img>` que leva o
  id dela, dentro da gaveta no fim da página.

Este site é gerado a partir do pacote de design pelo script
`ferramentas/montar-sites.mjs`, um nível acima desta pasta.
