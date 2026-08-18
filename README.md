# Casa do Lago — Vassouras, Vale do Café (RJ)

Site do bistrô Casa do Lago. HTML, CSS e JavaScript estáticos, sem build e sem
back-end: pode ser servido por qualquer servidor de arquivos.

| Página | Arquivo | O que é |
| --- | --- | --- |
| Casa do Lago | `index.html` | A casa (dia/noite), Rachel Porto, horta, cardápio, experiências e reservas por WhatsApp. |
| Portal | `portal.html` | Porta de entrada das duas casas irmãs; o clique dispara o voo do pássaro. |
| Cardápio | `cardapio_casalago.html` | Carta com abas e ficha por prato. |
| Casamentos | `casamentos_casa_lago.html` | Capa em tela cheia, texto e galeria de dezesseis fotos. |

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

- O layout, as cores, a tipografia, os textos e todas as animações estão
  aprovados pelo cliente. Não é um projeto para redesenhar.
- Sem framework e sem build: GSAP entra por CDN, o resto é HTML puro.
- Não use travessão (—) nos textos: decisão do cliente.
- Os formulários não vão a servidor nenhum: montam a mensagem e abrem o
  WhatsApp (reservas (24) 99930-9828, cerimonial +55 22 98159-5317).
- As bebidas do cardápio ainda não têm foto: a ficha abre no layout sem
  imagem. Para dar foto a uma delas, basta pôr um `src` no `<img>` que leva o
  id dela, dentro da gaveta no fim da página.

Este site é gerado a partir do pacote de design pelo script
`ferramentas/montar-sites.mjs`, um nível acima desta pasta.
