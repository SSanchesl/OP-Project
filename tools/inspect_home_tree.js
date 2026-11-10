const puppeteer = require('c:/Users/maste/Documents/GitHub/Piece-clon/server/node_modules/puppeteer-core');

async function inspectHome() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--no-sandbox', '--window-size=720,1280']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 1280 });

  await page.goto('http://localhost:3000/index.html');
  await page.type('#loginUser', 'jogador1');
  await page.type('#loginPass', '123');
  await page.click('#loginBtn');

  await new Promise(r => setTimeout(r, 10000));
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 1500));
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 1500));
  await page.mouse.click(360, 1210);
  await new Promise(r => setTimeout(r, 2000));

  const tree = await page.evaluate(() => {
    const stage = egret.lifecycle.stage;
    const buttons = [];

    function scan(obj, path) {
      if (!obj) return;
      const curPath = path + " > " + (obj.name || obj.constructor.name);
      if (obj.touchEnabled) {
        let bounds = { x: 0, y: 0, w: 0, h: 0 };
        try {
          const pt = obj.localToGlobal(0, 0);
          bounds = { x: Math.round(pt.x), y: Math.round(pt.y), w: Math.round(obj.width), h: Math.round(obj.height) };
        } catch(e){}
        buttons.push({
          path: curPath,
          type: obj.constructor.name,
          name: obj.name,
          visible: obj.visible,
          touchEnabled: obj.touchEnabled,
          bounds: bounds,
          hasTouchTap: obj.hasEventListener ? obj.hasEventListener(egret.TouchEvent.TOUCH_TAP) : null
        });
      }
      if (obj.numChildren) {
        for (let i = 0; i < obj.numChildren; i++) {
          scan(obj.getChildAt(i), curPath);
        }
      }
    }

    scan(stage, "Stage");
    return buttons;
  });

  console.log('Botões e elementos com touchEnabled no Stage:');
  for (const b of tree) {
    if (b.hasTouchTap || b.name || b.bounds.h > 20) {
      console.log(`[${b.type}] name="${b.name}" bounds=(${b.bounds.x}, ${b.bounds.y}, ${b.bounds.w}x${b.bounds.h}) hasTap=${b.hasTouchTap} path=${b.path}`);
    }
  }

  await browser.close();
}

inspectHome();
