const puppeteer = require('c:/Users/maste/Documents/GitHub/Piece-clon/server/node_modules/puppeteer-core');

async function check() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--no-sandbox', '--window-size=720,1280']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/index.html');
  await page.type('#loginUser', 'jogador1');
  await page.type('#loginPass', '123');
  await page.click('#loginBtn');

  await new Promise(r => setTimeout(r, 15000));

  const details = await page.evaluate(() => {
    const layer = window.ts && window.ts.guideLayer;
    if (!layer) return { exists: false };
    const children = [];
    for (let i = 0; i < layer.numChildren; i++) {
      const c = layer.getChildAt(i);
      children.push({
        type: c.constructor.name,
        touchEnabled: c.touchEnabled,
        touchChildren: c.touchChildren,
        visible: c.visible,
        width: c.width,
        height: c.height,
        x: c.x,
        y: c.y,
        isClick: c.isClick,
        maskGroupChildren: c.maskGroup ? c.maskGroup.numChildren : null
      });
    }
    return {
      layerTouch: layer.touchEnabled,
      layerChildren: children,
      stageTouch: window.ts.stage ? window.ts.stage.touchEnabled : null,
      stageChildren: window.ts.stage ? window.ts.stage.numChildren : 0,
      openWindows: window.ts.openWindows ? Object.keys(window.ts.openWindows) : []
    };
  });

  console.log(JSON.stringify(details, null, 2));
  await browser.close();
}

check();
