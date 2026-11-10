const puppeteer = require('c:/Users/maste/Documents/GitHub/Piece-clon/server/node_modules/puppeteer-core');

async function testClick() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--no-sandbox', '--window-size=720,1280']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 1280 });

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}]`, msg.text());
  });

  await page.goto('http://localhost:3000/index.html');
  await page.type('#loginUser', 'jogador1');
  await page.type('#loginPass', '123');
  await page.click('#loginBtn');

  // Espera chegar na tela da Nami (10s)
  await new Promise(r => setTimeout(r, 10000));

  console.log('\n--- Tentando clicar na tela (x=360, y=700) ---');
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n--- Tentando clicar na seta do diálogo (x=600, y=620) ---');
  await page.mouse.click(600, 620);
  await new Promise(r => setTimeout(r, 2000));

  // Inspeciona TSGuideNode
  const nodeState = await page.evaluate(() => {
    const res = {};
    if (window.UIWindowManager) {
      const win = UIWindowManager.getWindowByName ? UIWindowManager.getWindowByName("TSGuideNode") : null;
      if (win) {
        res.isClick = win.isClick;
        res.createTime = win.createTime;
        res.currentConfig = win.currentConfig;
        res.maskTouch = win.maskGroup ? win.maskGroup.touchEnabled : null;
        res.guideGroupTouch = win.guideGroup ? win.guideGroup.touchEnabled : null;
      }
    }
    if (window.GuideInfoManager) {
      const gm = GuideInfoManager.getInstance();
      res.guideStep = gm.getGuideStep ? gm.getGuideStep() : null;
    }
    return res;
  });

  console.log('Estado pós-clique:', JSON.stringify(nodeState, null, 2));

  await browser.close();
}

testClick();
