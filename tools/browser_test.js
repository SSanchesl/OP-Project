const puppeteer = require('c:/Users/maste/Documents/GitHub/Piece-clon/server/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('Iniciando navegador Chrome...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=720,1280']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 1280 });

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]`, msg.text());
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER PAGE ERROR]`, err.message);
  });

  console.log('Navegando para http://localhost:3000/index.html ...');
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });

  // Espera 3 segundos para render inicial
  await new Promise(r => setTimeout(r, 3000));

  console.log('Tirando screenshot da tela de login...');
  const ssPath1 = path.join(__dirname, 'screenshot_login.png');
  await page.screenshot({ path: ssPath1 });
  console.log('Salvo:', ssPath1);

  // Preenche usuário e senha e clica em Entrar
  console.log('Preenchendo login jogador1 / 123 ...');
  await page.type('#loginUser', 'jogador1');
  await page.type('#loginPass', '123');
  await page.click('#loginBtn');

  // Espera 15 segundos para carregar o jogo
  console.log('Aguardando 15 segundos para o jogo carregar no Egret Engine...');
  for (let i = 1; i <= 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const isOverlayHidden = await page.evaluate(() => {
      const el = document.getElementById('loginOverlay');
      return el ? el.classList.contains('hidden') : false;
    });
    if (i % 5 === 0) console.log(`Progresso: ${i}s (Overlay escondido: ${isOverlayHidden})`);
  }

  const ssPath2 = path.join(__dirname, 'screenshot_ingame.png');
  await page.screenshot({ path: ssPath2 });
  console.log('Salvo screenshot in-game:', ssPath2);

  // Inspeciona estado do Egret e do Tutorial
  const info = await page.evaluate(() => {
    const res = {};
    res.hasEgret = typeof window.egret !== 'undefined';
    res.hasTs = typeof window.ts !== 'undefined';
    res.errors = window.__errors || [];
    if (window.GuideInfoManager && GuideInfoManager.getInstance()) {
      const gm = GuideInfoManager.getInstance();
      res.guideInfo = {
        isOPenGuide: gm.isOPenGuide,
        step: gm.getGuideStep ? gm.getGuideStep() : null
      };
    }
    if (window.ts) {
      res.guideLayerExists = !!window.ts.guideLayer;
      res.guideLayerTouch = window.ts.guideLayer ? window.ts.guideLayer.touchEnabled : null;
      res.guideLayerChildren = window.ts.guideLayer ? window.ts.guideLayer.numChildren : 0;
    }
    return res;
  });

  console.log('\n=== Informações de Estado do Jogo ===');
  console.log(JSON.stringify(info, null, 2));

  await browser.close();
  console.log('Teste concluído com sucesso.');
}

run().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
