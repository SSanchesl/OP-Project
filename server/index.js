// Servidor local privado para o cliente Epic Voyage (Egret Engine).
// Uso pessoal/offline apenas — nao exposto na internet.
// Reimplementa o suficiente do protocolo original (descoberto por
// engenharia reversa do cliente) para permitir login e entrar no jogo
// usando um "save" local em disco, sem depender do backend original
// (que esta fora do ar).

const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const TEA = require("./tea");
const store = require("./store");

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;
const CLIENT_DIR = path.join(__dirname, "..", "local_preview");

const VERIFY_KEY = "verification";

// Tabelas estaticas do jogo (ja descriptografadas em disco) - o servidor
// precisa delas pra montar os times de batalha (hangup:startGeneral) e
// pra saber qual e a proxima fase (hangup:checkBattleResult).
const JSON_DIR = path.join(CLIENT_DIR, "resource", "json");
const LESSON_TABLE = JSON.parse(fs.readFileSync(path.join(JSON_DIR, "lesson.json"), "utf8"));
const HERO_TABLE = JSON.parse(fs.readFileSync(path.join(JSON_DIR, "hero.json"), "utf8"));

// Heróis com o conjunto completo de assets recuperados na descriptografia
// (retrato, ícone, animação de batalha DragonBones, efeitos de skill) -
// outros heroIds costumam ficar com o personagem invisível em batalha.
// Usado como pool de "prêmios" válidos pro summon.
const KNOWN_GOOD_HEROES = [1208, 1209, 1315, 1316];

// HERO_ATTR_TYPE tem 48 indices (0-47) e varias formulas do jogo (poder,
// "quem ja morreu" no carregamento da batalha, etc) leem varios deles
// direto sem guarda de undefined - um array mais curto ou incompleto vira
// NaN/crash em cascata. Constroi sempre os 48, com HP/ATTACK/ARMOR/SPEED
// (indices 0-3) informados e o resto em 0 (neutro/seguro pra formula).
function buildAttrs(hp, attack, armor, speed) {
  const items = new Array(48).fill(null).map((_, id) => ({ _id: id, _num: 0 }));
  items[0]._num = hp;
  items[1]._num = attack;
  items[2]._num = armor;
  items[3]._num = speed;
  return { _items: items };
}

// Monta um membro de time no formato que BattleTeamManager.getTeamWithBattle
// (recursos/skins) e BattleSetStartParamSingleton.getNewEnemyWithNoHp (que
// le "_attrs._items[ATTR_HP]._num" de cada membro, incluindo inimigos, pra
// saber quem ja esta com HP 0) esperam: {_heroDisplayId, _skinId, _skills,
// _position, _attrs}.
// _type das skills: 0=ataque basico ("skill"), 2=passiva/potencial,
// 3=super (se existir).
// IMPORTANTE: getTeamWithBattle faz `for(var r in e){var i=e[r],
// s=i._heroDisplayId...}` SEM checar null - se o array tiver posicoes
// vazias (null), quebra com "Cannot read properties of null" e trava a
// tela de carregamento da batalha pra sempre. Por isso os arrays de time
// tem que vir COMPACTOS (sem null), com a posicao original guardada em
// "_position" em vez de codificada pelo indice do array.
function buildTeamMember(heroDisplayId, position, stats) {
  const hero = HERO_TABLE[heroDisplayId] || {};
  const skills = [];
  if (hero.skill) skills.push({ _type: 0, _id: Number(hero.skill) });
  if (hero.skillPassive1) skills.push({ _type: 2, _id: Number(hero.skillPassive1) });
  if (hero.potential1) skills.push({ _type: 2, _id: Number(hero.potential1) });
  if (hero.super) skills.push({ _type: 3, _id: Number(hero.super) });
  const attrs = buildAttrs(stats.hp, stats.attack, stats.armor, stats.speed);
  return {
    _heroDisplayId: Number(heroDisplayId),
    _skinId: hero.defaultSkin || 0,
    _skills: skills,
    _position: position,
    _attrs: attrs,
    _baseAttrs: attrs,
    _exAttrs: attrs,
  };
}

const PLAYER_HERO_STATS = { hp: 50000, attack: 5000, armor: 2000, speed: 100 };
const ENEMY_HERO_STATS = { hp: 5000, attack: 500, armor: 200, speed: 100 };

// lesson.enemyList e uma string tipo "55902,55901,,55315," (posicoes vazias
// = sem inimigo naquele slot) - filtra os vazios, array final compacto.
function buildEnemyTeam(enemyListStr) {
  return (enemyListStr || "")
    .split(",")
    .map((id, position) => (id ? buildTeamMember(id, position, ENEMY_HERO_STATS) : null))
    .filter(Boolean);
}

function getBaseUrl(reqOrSocket) {
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  if (reqOrSocket && reqOrSocket.get) {
    const host = reqOrSocket.get("host") || `${HOST}:${PORT}`;
    const protocol = reqOrSocket.headers["x-forwarded-proto"] || reqOrSocket.protocol || "http";
    return `${protocol}://${host}`;
  }
  if (reqOrSocket && reqOrSocket.handshake) {
    const host = (reqOrSocket.handshake.headers && reqOrSocket.handshake.headers.host) || `${HOST}:${PORT}`;
    const protocol = (reqOrSocket.handshake.headers && reqOrSocket.handshake.headers["x-forwarded-proto"]) || "http";
    return `${protocol}://${host}`;
  }
  return BASE_URL;
}

const app = express();
app.use(express.json());

app.get("/favicon.ico", (req, res) => res.status(204).end());

app.get("/resource/properties/serversetting.json", (req, res) => {
  const currentBaseUrl = getBaseUrl(req);
  res.json({
    loginserver: currentBaseUrl,
    serverList: {},
  });
});

// ToolCommon.getClientVer() pede esse arquivo toda vez que conecta no
// main-server; se nao existir, o cliente so cai num fallback silencioso
// ("debug") - inofensivo, mas gera barulho de 404 no console toda hora.
app.get("/resource/properties/clientversion.json", (req, res) => {
  res.json({ clientVersion: "1.0.2" });
});

// Login local com usuario+senha, chamado pela telinha de login em
// index.html ANTES do jogo em si (nao faz parte do protocolo socket.io
// do jogo - e so pra identificar de quem e o save). Cria a conta na
// primeira vez, confere a senha nas seguintes.
app.post("/api/login", (req, res) => {
  const { userId, password } = req.body || {};
  const result = store.loginOrRegister(userId, password);
  res.json(result);
});

app.use(express.static(CLIENT_DIR));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  allowEIO3: true, // cliente usa Socket.IO v2.1.0 / Engine.IO v3
  cors: { origin: "*" },
});

function ok(data) {
  return { ret: 0, compress: false, data: JSON.stringify(data === undefined ? {} : data) };
}

function err(code) {
  return { ret: code, compress: false, data: JSON.stringify({}) };
}

// Registro de handlers "type:action" -> (payload, socket) => respostaDoAck
const handlers = {};
function on(type, action, fn) {
  handlers[`${type}:${action}`] = fn;
}

// ---- login-server ----------------------------------------------------

on("User", "GetServerList", (payload, socket) => {
  const url = getBaseUrl(socket);
  const list = [
    {
      serverId: 1,
      url: url,
      chaturl: url,
      dungeonurl: url,
      name: "Servidor Principal",
      hot: false,
      new: false,
      online: true,
      offlineReason: "",
      worldRoomId: 1,
      guildRoomId: 1,
      teamChatRoomId: 1,
      teamDungeonChatRoom: 1,
      openDate: 0,
    },
  ];
  return ok({ serverList: list, history: [] });
});

on("User", "SaveHistory", (payload) => ok({ loginToken: "local-token" }));
on("User", "GetLicense", () => ok({}));
on("User", "LoginAnnounce", () => ok({})); // cliente itera data[k].alwaysPopup - objeto vazio e seguro
on("User", "SaveLanguage", () => ok({}));

// ---- main-server -------------------------------------------------------

on("user", "enterGame", (payload) => {
  const save = store.getOrCreateUser(payload.userId);
  const response = store.buildEnterGamePayload(save);
  save.hasEnteredGame = true;
  store.saveAll({ ...store.loadAll(), [save.userId]: save });
  return ok(response);
});

on("user", "registChat", (payload, socket) => {
  const url = getBaseUrl(socket);
  return ok({
    _chatServerUrl: url,
    _worldRoomId: 1,
    _guildRoomId: 1,
    _teamDungeonChatRoom: 1,
    _teamChatRoom: 1,
  });
});

// Inicio de uma batalha de fase (lesson). A simulacao do combate em si
// roda 100% no cliente (battlelogic.min.js) - o servidor so precisa
// devolver os times "resolvidos" (heroDisplayId + skills) pra ele montar
// a cena. team = array de 5 posicoes {heroId} ou null (o que o jogador
// posicionou na formacao).
on("hangup", "startGeneral", (payload) => {
  const save = store.getOrCreateUser(payload.userId);
  const lesson = LESSON_TABLE[save.progress.curLess] || {};
  const leftTeam = (payload.team || [])
    .map((slot, position) => {
      if (!slot || !slot.heroId) return null;
      const hero = save.heroes[slot.heroId];
      const displayId = hero && hero._heroDisplayId;
      return displayId ? buildTeamMember(displayId, position, PLAYER_HERO_STATS) : null;
    })
    .filter(Boolean);
  return ok({
    _battleId: `battle-${Date.now()}`,
    _leftTeam: leftTeam,
    _leftSuper: null,
    _rightTeam: buildEnemyTeam(lesson.enemyList),
    _rightSuper: null,
  });
});

// Fim da batalha - o cliente ja simulou e mostrou tudo, so manda o
// resultado calculado localmente pra "validar". Aqui a gente so sempre
// da vitoria (destrava o tutorial) e avanca pra proxima fase (nextID).
on("hangup", "checkBattleResult", (payload) => {
  const save = store.getOrCreateUser(payload.userId);
  const currentLessonId = save.progress.curLess;
  const lesson = LESSON_TABLE[currentLessonId] || {};
  const nextLessonId = lesson.nextID || currentLessonId;
  store.updateUser(save.userId, {
    progress: {
      curLess: nextLessonId,
      maxPassLesson: currentLessonId,
      maxPassChapter: lesson.thisChapter || save.progress.maxPassChapter,
    },
  });
  return ok({
    _battleResult: 0, // 0 = vitoria
    _curLess: nextLessonId,
    _maxPassLesson: currentLessonId,
    _maxPassChapter: lesson.thisChapter || save.progress.maxPassChapter,
  });
});

on("user", "exitGame", () => ok({}));
on("user", "getGameTime", () => ok({ serverTime: Date.now() }));
on("user", "getBulletinBrief", () => ok({ _brief: {} }));

// Ao terminar todas as fases de um capitulo, a tela de "abrir proximo
// capitulo" chama isso e guarda a resposta em
// OnHookSingleton.lastSection (e._curLess) - essa variavel e a MESMA
// usada por TODA fase seguinte pra saber qual "lesson" carregar
// (getEnemyTeam, getNeedPower, etc). Sem handler, a resposta cai no
// fallback ok({}) => e._curLess vira undefined => lastSection fica
// undefined PRA SEMPRE => toda tentativa de batalha do proximo capitulo
// em diante quebra silenciosamente. curLess do save ja e a fonte da
// verdade (avancada em checkBattleResult), so devolve ela de volta.
on("hangup", "nextChapter", (payload) => {
  const save = store.getOrCreateUser(payload.userId);
  return ok({ _curLess: save.progress.curLess });
});

// BattleStatic.createBatchRandom pede um lote de numeros aleatorios pro
// servidor (pra sincronizar critico/esquiva/etc de forma "oficial") e le
// a resposta em "_rand" (t(e._rand)). Sem handler, isso sempre voltava
// vazio ({}), gerando "连击出现错误 随机数队列为空" (fila de aleatorios
// vazia) e "计算护甲出现错误" a cada acao de combate. Uso pessoal/local:
// gera floats [0,1) de verdade, o suficiente pro calculo interno do
// cliente funcionar igual funcionaria com o servidor original.
on("battle", "getRandom", (payload) => {
  const count = payload.count || 100;
  const rand = new Array(count).fill(0).map(() => Math.random());
  return ok({ _rand: rand });
});

// Invocacao de herois (gacha). requestCallBackCheck (cliente) le
// e._addTotal (fallback e._addHeroes), e._energy, e._canFreeTime - cada
// entrada de _addHeroes/_addTotal e passada direto pra
// HerosManager.SetHeroDataToModel, entao usa o MESMO formato de
// server/store.js (buildHeroEntry). Uso pessoal/offline: sempre "acerta"
// um heroi valido do pool de assets completos, sem checar moeda/custo.
function summonHandler(count) {
  return (payload) => {
    const save = store.getOrCreateUser(payload.userId);
    const newHeroes = [];
    for (let i = 0; i < count; i++) {
      // Prefere um heroi que o jogador AINDA NAO TEM. Herois duplicados sao
      // normais no jogo (viram material de "despertar"), mas o mascaramento
      // de toque do tutorial guiado nao sabe lidar com o dialogo de aviso
      // que aparece nesse caso (fica bloqueado atras da mascara escura) -
      // entao evitamos duplicata enquanto for possivel, sem impedir que
      // aconteca depois que o jogador ja tiver os 4 do pool.
      const owned = new Set(Object.values(save.heroes).map((h) => h._heroDisplayId));
      const notOwnedYet = KNOWN_GOOD_HEROES.filter((id) => !owned.has(id));
      const pool = notOwnedYet.length > 0 ? notOwnedYet : KNOWN_GOOD_HEROES;
      const displayId = pool[Math.floor(Math.random() * pool.length)];
      newHeroes.push(store.addHero(save.userId, displayId));
    }
    // TEM que ser um array de verdade (nao um objeto {"0":x,"1":y}): o
    // cliente (SummonMain.refreshHeroList) percorre isso com
    // `for(n=0,a=e; n<a.length; n++)` - objeto plano nao tem ".length",
    // o loop nunca roda, a lista de herois sorteados fica vazia e o
    // card de resultado quebra tentando ler ".heroId" de undefined.
    return ok({
      _addHeroes: newHeroes,
      _addTotal: newHeroes,
      _items: [],
      _energy: 0,
      _canFreeTime: 0,
      _canCommonFreeTime: 0,
      _canSuperFreeTime: 0,
    });
  };
}
on("summon", "summonOneFree", summonHandler(1));
on("summon", "summonOne", summonHandler(1));
on("summon", "summonTen", summonHandler(10));
on("summon", "summonEnergy", summonHandler(1));
on("summon", "readWishList", () => ok({ _wishList: [] }));
on("summon", "setWishList", () => ok({}));

// Chamadas paralelas disparadas por requestAfterLogin logo apos enterGame.
// Todas precisam responder ret:0 para o Promise.all resolver e o cliente
// sair da tela de loading (ts.loginGameFinish = true).
on("friend", "getFriends", () => ok({}));
on("friend", "queryBlacklist", () => ok({}));
on("hero", "getAttrs", (payload) => {
  // HerosManager.getAttrsCallBack indexa _attrs/_baseAttrs/_exAttrs pela
  // POSICAO no array "heros" do request (nao pelo heroId!) - ele faz
  // getHero(e[a]) onde "e" e o array original e "a" e a chave desses
  // objetos. E cada entrada precisa ser {_items:[{_id,_num},...]} (formato
  // lido por setTotalAttr/setBasicAttr/setExtraAttr), nao um dict plano.
  // CRUCIAL: setBasicAttr/setTotalAttr/setExtraAttr fazem
  // `for(var n in e._items) t._basicAttrs[n]=e._items[n]._num` - "n" ali
  // e o INDICE DO ARRAY, nao o campo "_id"! Ou seja _basicAttrs[0] vem de
  // items[0]._num - so importa a posicao, nao o "_id".
  //
  // HerosManager.getPower (formula de "poder" usada pra liberar o botao
  // de batalha) le OS 48 INDICES do enum HERO_ATTR_TYPE (0-47, nao so
  // 0-20) multiplicando varios entre si - QUALQUER indice faltando vira
  // `undefined`, e uma unica multiplicacao por undefined jah torna a
  // conta inteira NaN (poder "NaN", trava o botao pra sempre com um
  // toast vazio, ja que a mensagem de erro tambem falta no jogo
  // original). buildAttrs ja cobre os 48 indices, com bonus percentual
  // em 0 (neutro, sem NaN/divisao por zero) - so os 4 atributos brutos
  // (HP/ATTACK/ARMOR/SPEED) precisam de valor de verdade.
  const baseStats = buildAttrs(PLAYER_HERO_STATS.hp, PLAYER_HERO_STATS.attack, PLAYER_HERO_STATS.armor, PLAYER_HERO_STATS.speed);
  const attrs = {};
  (payload.heros || []).forEach((heroId, index) => {
    attrs[index] = baseStats;
  });
  return ok({ _attrs: attrs, _baseAttrs: attrs, _exAttrs: attrs });
});
// HerosManager.requestExAttr (chamado sempre que a tela de poder/formacao
// calcula o "poder" com bonus de imprint/equipamento/etc) le
// resp._extraAttrs[indice]._items[i]._num, MESMO formato de hero:getAttrs
// (indexado pela posicao no array "heroIds" do request, nao pelo heroId).
// Sem handler, resp._extraAttrs fica undefined; o "for...in" sobre
// undefined nao quebra na hora, mas deixa HerosManager.extraAttrs vazio
// pra sempre - assim que algum calculo de poder tentar ler um indice de
// bonus extra (equipamento/imprint, ainda nao implementado aqui mas faz
// parte do jogo a partir de fases mais avancadas) quebra com "Cannot
// read properties of undefined". Devolve os 48 indices zerados (sem
// bonus, ainda) - mesmo raciocinio do hero:getAttrs.
on("hero", "getExtraAttr", (payload) => {
  const zeroAttrs = buildAttrs(0, 0, 0, 0);
  const extraAttrs = {};
  (payload.heroIds || []).forEach((heroId, index) => {
    extraAttrs[index] = zeroAttrs;
  });
  return ok({ _extraAttrs: extraAttrs });
});
on("heroImage", "getAll", () => ok({}));
on("userMsg", "getMsgList", () => ok({ _brief: [] }));
on("guild", "getGuildDetail", () => ok({}));

// ---- chat-server ---------------------------------------------------

on("chat", "login", () => ok({}));
on("chat", "joinRoom", () => ok({}));
on("chat", "leaveRoom", () => ok({}));
on("chat", "sendMsg", (payload) => ok({ echo: payload }));

// ---- socket.io wiring --------------------------------------------------

io.on("connection", (socket) => {
  console.log(`[conexao] socket ${socket.id} de ${socket.handshake.address}`);

  // Handshake "verify" (TEA). O login-server nao exige isso (o cliente
  // nem escuta o evento nessa conexao), mas nao ha problema em sempre
  // oferecer o desafio: quem nao espera, simplesmente ignora.
  const challenge = `verify-${socket.id}-${Date.now()}`;
  socket.emit("verify", challenge);

  socket.on("verify", (answer, ack) => {
    let success = false;
    try {
      success = TEA.decrypt(answer, VERIFY_KEY) === challenge;
    } catch (e) {
      success = false;
    }
    console.log(`[verify] socket ${socket.id}: ${success ? "OK" : "FALHOU"}`);
    if (typeof ack === "function") ack(success ? { ret: 0 } : { ret: 1 });
  });

  socket.on("handler.process", (payload, ack) => {
    const key = `${payload && payload.type}:${payload && payload.action}`;
    const handler = handlers[key];
    console.log(`[handler.process] ${key}`, payload);
    let response;
    if (handler) {
      try {
        response = handler(payload, socket) || ok({});
      } catch (e) {
        console.error(`[erro] handler ${key} falhou:`, e);
        response = err(1);
      }
    } else {
      console.warn(`[sem handler] ${key} - respondendo ok vazio. payload:`, payload);
      response = ok({});
    }
    if (typeof ack === "function") ack(response);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[desconexao] socket ${socket.id}: ${reason}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor local rodando em ${BASE_URL}`);
  console.log(`Abra ${BASE_URL}/index.html no navegador.`);
});
