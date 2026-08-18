// "Banco de dados" local em arquivo JSON — um save por userId.
// Uso pessoal/single-player: nao ha necessidade de banco de verdade.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
const SAVE_FILE = path.join(DATA_DIR, "save.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadAll() {
  if (!fs.existsSync(SAVE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SAVE_FILE, "utf8"));
  } catch (e) {
    console.error("[store] save.json corrompido, comecando do zero:", e);
    return {};
  }
}

function saveAll(all) {
  fs.writeFileSync(SAVE_FILE, JSON.stringify(all, null, 2), "utf8");
}

// Objeto de heroi no formato lido por HerosManager.SetHeroDataToModel -
// usado tanto no "heros._heros" do enterGame quanto em "_addHeroes" da
// resposta de summon (mesma estrutura nos dois casos).
function buildHeroEntry(heroId, heroDisplayId) {
  return {
    _heroId: heroId,
    _heroDisplayId: heroDisplayId,
    _heroStar: 1,
    _connectStar: 0,
    _expeditionMaxLevel: 0,
    _heroTag: [],
    _fragment: 0,
    _superSkillResetCount: 0,
    _potentialResetCount: 0,
    _heroBaseAttr: { _level: 1, _evolveLevel: 0 },
    _superSkillLevel: {},
    _potentialLevel: {},
    _qigong: {},
    _qigongTmp: {},
    _qigongStage: 1,
  };
}

function defaultHeroes() {
  // 1315 (nao 1201): e um dos poucos heroIds com o conjunto completo de
  // imagens recuperado na descriptografia (retrato, icone, animacao de
  // batalha DragonBones, efeitos de skill) - com 1201 o personagem ficava
  // invisivel na tela de batalha.
  return { hero_1: buildHeroEntry("hero_1", 1315) };
}

// Hash simples com salt por conta - suficiente pra um servidor local que
// nunca sai da sua maquina (nao precisa de bcrypt/scrypt pra isso), so
// pra nao guardar a senha em texto puro no save.json.
function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(salt + ":" + password).digest("hex");
}

// Cria a conta na primeira vez que alguem loga com aquele usuario+senha,
// ou confere a senha se a conta ja existe. Retorna {ok, error, isNew}.
function loginOrRegister(userId, password) {
  userId = (userId || "").trim();
  password = password || "";
  if (!userId) return { ok: false, error: "Usuário não pode ser vazio" };
  if (password.length < 3) return { ok: false, error: "Senha precisa ter pelo menos 3 caracteres" };

  const all = loadAll();
  const existing = all[userId];

  if (!existing) {
    const salt = crypto.randomBytes(8).toString("hex");
    getOrCreateUser(userId); // cria o save com heróis/progresso default
    updateUser(userId, { auth: { salt, hash: hashPassword(password, salt) } });
    return { ok: true, isNew: true };
  }

  if (!existing.auth) {
    // conta criada antes desse sistema de senha existir - adota a senha
    // que a pessoa digitar agora, sem travar quem já estava jogando.
    const salt = crypto.randomBytes(8).toString("hex");
    updateUser(userId, { auth: { salt, hash: hashPassword(password, salt) } });
    return { ok: true, isNew: false };
  }

  const valid = hashPassword(password, existing.auth.salt) === existing.auth.hash;
  if (!valid) return { ok: false, error: "Senha incorreta" };
  return { ok: true, isNew: false };
}

function getOrCreateUser(userId) {
  const all = loadAll();
  if (!all[userId]) {
    all[userId] = {
      userId,
      loginToken: `local-${userId}`,
      serverId: 1,
      createdAt: Date.now(),
      progress: { curLess: 10101, maxPassLesson: 0, maxPassChapter: 0 },
      heroes: defaultHeroes(),
    };
    saveAll(all);
  }
  if (!all[userId].progress) {
    all[userId].progress = { curLess: 10101, maxPassLesson: 0, maxPassChapter: 0 };
    saveAll(all);
  }
  if (!all[userId].heroes) {
    all[userId].heroes = defaultHeroes();
    saveAll(all);
  }
  return all[userId];
}

// Adiciona um heroi recem-invocado (summon) ao save e persiste.
function addHero(userId, heroDisplayId) {
  const all = loadAll();
  const save = all[userId];
  const heroId = `hero_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  save.heroes[heroId] = buildHeroEntry(heroId, heroDisplayId);
  saveAll(all);
  return save.heroes[heroId];
}

function updateUser(userId, patch) {
  const all = loadAll();
  all[userId] = Object.assign({}, all[userId], patch);
  saveAll(all);
  return all[userId];
}

// Corpo de resposta de "enterGame", conforme lido por UserDataParser.saveUserData
// no cliente (campos obrigatorios: user, hangup, summon, totalProps, superSkill,
// heros, userGuild — sem eles o parser lanca excecao e o loading trava).
// heroDisplayId 1201 e um id real, extraido de resource/json/hero.json descriptografado.
function buildEnterGamePayload(save) {
  return {
    newUser: !save.hasEnteredGame,
    broadcastRecord: [],
    user: {
      _id: save.userId,
      _pwd: "",
      _nickName: save.userId,
      _headImage: 1,
      _lastLoginTime: Date.now(),
      _createTime: save.createdAt,
      _bulletinVersions: {},
      _oriServerId: save.serverId,
      _todayGameTime: 0,
      _totalGameTime: 0,
      _nickChangeTimes: 0,
    },
    hangup: {
      _curLess: save.progress.curLess, // id real da fase atual (lesson.json) - nao um contador 1,2,3...
      _maxPassLesson: save.progress.maxPassLesson,
      _haveGotChapterReward: [],
      _haveGotLessonReward: [],
      _maxPassChapter: save.progress.maxPassChapter,
      _clickGlobalWarBuffTag: false,
      _lastGainTime: Date.now(),
      _level: 1,
    },
    summon: {
      _energy: 0,
      _canCommonFreeTime: 0,
      _canSuperFreeTime: 0,
      _summonTimes: {},
      _wishList: [],
    },
    totalProps: {
      // Sem isso, ItemsCommonSingleton fica vazio -> getUserLevel()==0 para
      // sempre -> vira gate "insuficiente" em quase toda acao do tutorial
      // (upar herói, reforcar equipamento, etc). IDs reais de thingsID.json:
      // 104=nivel do jogador, 103=exp do jogador, 102=ouro, 101=diamante,
      // 131=capsula de exp de heroi. 2315=fragmento do heroi 1315 (heroPiece.json).
      _items: [
        { _id: 104, _num: 1 },
        { _id: 103, _num: 0 },
        { _id: 102, _num: 5000 },
        { _id: 101, _num: 300 },
        { _id: 131, _num: 200 },
        { _id: 2315, _num: 35 },
      ],
    },
    backpackLevel: 1,
    superSkill: [],
    heros: { _heros: save.heroes },
    userGuild: {},
    // {} faz OnHookSingleton._mainTask ficar null pra sempre (o loop de
    // setMianTask so roda se houver pelo menos 1 chave). 6001 = 1a missao
    // principal (task.json).
    curMainTask: { task1: { _id: 6001, _state: 1 } },
    // Campos lidos sem guarda de undefined em saveUserData/initData -
    // precisam existir (mesmo vazios) para nao lancar excecao.
    scheduleInfo: {},
    redDotData: {},
    karinStartTime: 0,
    karinEndTime: 0,
    gvgUser: {},
    expedition: {},
  };
}

module.exports = { getOrCreateUser, updateUser, addHero, buildEnterGamePayload, loadAll, saveAll, loginOrRegister };
