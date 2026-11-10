const puppeteer = require('c:/Users/maste/Documents/GitHub/Piece-clon/server/node_modules/puppeteer-core');
const path = require('path');

async function testExactClick() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: "new",
    args: ['--no-sandbox', '--window-size=720,1280']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 1280 });

  page.on('console', msg => {
    console.log(`[CONSOLE]`, msg.text());
  });

  // Patch
  await page.evaluateOnNewDocument(() => {
    setInterval(() => {
      if (window.TSGuideNode && TSGuideNode.prototype && !TSGuideNode.prototype.__hollowFixed) {
        TSGuideNode.prototype.__hollowFixed = true;
        const origDraw = TSGuideNode.prototype.drawReverse;
        TSGuideNode.prototype.drawReverse = async function() {
          const res = await origDraw.apply(this, arguments);
          if (this.maskGroup) {
            for (let i = 0; i < this.maskGroup.numChildren; i++) {
              const child = this.maskGroup.getChildAt(i);
              if (child) child.touchEnabled = false;
            }
          }
          if (window.ts && ts.guideLayer) ts.guideLayer.touchEnabled = false;
          return res;
        };
        const origTap = TSGuideNode.prototype.buttonGuideTap;
        TSGuideNode.prototype.buttonGuideTap = function() {
          this.isClick = true;
          return origTap.apply(this, arguments);
        };
      }
    }, 50);
  });

  await page.goto('http://localhost:3000/index.html');
  await page.type('#loginUser', 'jogador1');
  await page.type('#loginPass', '123');
  await page.click('#loginBtn');

  await new Promise(r => setTimeout(r, 10000));

  // 2101 -> 2102
  console.log('Passando 2101...');
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 1500));

  // 2102 -> 2103
  console.log('Passando 2102...');
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 1500));

  // 2103 -> 2104
  console.log('Passando 2103 (clique botão central)...');
  await page.mouse.click(360, 1210);
  await new Promise(r => setTimeout(r, 2000));

  console.log('Clicando exatamente no botão Challenge Boss (x=368, y=540)...');
  await page.mouse.click(368, 540);
  await new Promise(r => setTimeout(r, 3000));

  const ss = path.join(__dirname, 'screenshot_step2105_exact.png');
  await page.screenshot({ path: ss });
  console.log('Screenshot salvo em:', ss);

  await browser.close();
}

testExactClick();
