# Servidor local — Epic Voyage

Servidor privado, 100% local, que substitui o backend original (morto) do
jogo. Não expõe nada na internet — só escuta em `localhost`.

## Como jogar

1. Abra um terminal nesta pasta (`server/`) e rode:
   ```
   npm install   # só na primeira vez
   npm start
   ```
2. Abra `http://localhost:3000/index.html` no Chrome ou Edge.
3. Na primeira vez, o navegador vai pedir um "nome de usuário local" —
   isso só identifica o seu save no servidor (fica salvo no
   `localStorage` do navegador, não precisa digitar de novo depois).
4. Espere uns 15-20s carregando e você cai direto na cidade principal
   (BaseHome), com um herói inicial já em conta.

Para parar o servidor, feche o terminal ou `Ctrl+C`.

## O que é isso

O app original ("Epic Voyage", clone chinês de One Piece) se conecta a um
backend (`sjmobilegame.com`) que saiu do ar. O cliente (motor Egret/JS) foi
recuperado por engenharia reversa (ver `../ANALISE.md`) e roda de verdade no
navegador a partir de `../local_preview/`. Este servidor reimplementa, do
zero, o suficiente do protocolo original (descoberto lendo o código-fonte
JS do próprio cliente) para permitir login e entrar no jogo:

- **Protocolo**: Socket.IO v2 (`allowEIO3` no servidor p/ compatibilidade),
  um único evento genérico `handler.process` carregando `{type, action, ...}`
  e respondido via ack `{ret, compress, data}`.
- **Handshake `verify`**: challenge/response com TEA/XXTEA customizado
  (`tea.js`), replicado a partir da classe `TEA` do cliente.
- **Save**: arquivo JSON simples em `data/save.json`, um registro por nome
  de usuário local — não é preciso senha real, é uso pessoal/offline.

## Arquivos

- `index.js` — servidor HTTP + Socket.IO, roteamento de `type:action` para
  handlers.
- `tea.js` — implementação do handshake `verify`.
- `store.js` — "banco de dados" local (`data/save.json`) e o payload de
  `enterGame` (dados do save: herói, inventário, etc).

## Limitações conhecidas

- Cobre o suficiente do protocolo pra login + entrar na cidade principal.
  Sistemas mais profundos (arena, guilda, masmorras, chat de verdade,
  gacha/invocação, etc.) ainda não têm handlers dedicados — caem no
  handler genérico que responde `ret:0` com dado vazio. Ao usar essas
  telas, o console do navegador (F12) mostra `[sem handler] tipo:acao` no
  log do servidor — dá pra usar isso como guia pra implementar o que for
  precisando conforme for testando.
- Algumas poucas imagens (ícones do Facebook/YouTube, alguns fundos) não
  foram recuperadas na descriptografia original e aparecem quebradas — não
  afeta a jogabilidade.
- Som/música ainda não foi recuperado (ver `../ANALISE.md`, seção 6.5).
