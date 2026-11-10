const puppeteer = require('c:/Users/maste/Documents/GitHub/Piece-clon/server/node_modules/puppeteer-core');

async function testHit() {
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

  // Avança até 2104
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 1500));
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 1500));
  await page.mouse.click(360, 1210);
  await new Promise(r => setTimeout(r, 2000));

  // Agora estamos no 2104 com a mãozinha apontando pro Challenge Boss!
  const hitInfo = await page.evaluate(() => {
    const stage = egret.lifecycle.stage;
    const x = 540, y = 540;
    const hitObj = stage.$hitTest(x, y);

    // Encontra o botão de Challenge Boss na cena
    function findNode(obj, name) {
      if (!obj) return null;
      if (obj.name === name || (obj.constructor && obj.constructor.name === name)) return obj;
      if (obj.numChildren) {
        for (let i = 0; i < obj.numChildren; i++) {
          const res = findNode(obj.getChildAt(i), name);
          if (res) return res;
        }
      }
      return null;
    }

    return {
      hitObject: hitObj ? {
        name: hitObj.name,
        type: hitObj.constructor.name,
        touchEnabled: hitObj.touchEnabled,
        parent: hitObj.parent ? hitObj.parent.constructor.name : null
      } : null,
      guideNode: (function() {
        const gn = findNode(stage, "TSGuideNode");
        if (!gn) return null;
        return {
          visible: gn.visible,
          touchEnabled: gn.touchEnabled,
          touchChildren: gn.touchChildren,
          maskGroupTouch: gn.maskGroup ? gn.maskGroup.touchEnabled : null,
          maskGroupNumChildren: gn.maskGroup ? gn.maskGroup.numChildren : 0,
          currentConfig: gn.currentConfig
        };
      })()
    };
  });

  console.log('Resultado do Hit Test:', JSON.stringify(hitInfo, null, 2));
  await browser.close();
}

testHit();
