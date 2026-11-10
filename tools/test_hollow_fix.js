const puppeteer = require('c:/Users/maste/Documents/GitHub/Piece-clon/server/node_modules/puppeteer-core');
const path = require('path');

async function testHollowFix() {
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

  // Injeta patch antes de qualquer script
  await page.evaluateOnNewDocument(() => {
    const iv = setInterval(() => {
      if (window.TSGuideNode && TSGuideNode.prototype && !TSGuideNode.prototype.__hollowFixed) {
        TSGuideNode.prototype.__hollowFixed = true;

        // Corrige drawReverse para não bloquear cliques na área do botão
        const origDraw = TSGuideNode.prototype.drawReverse;
        TSGuideNode.prototype.drawReverse = async function() {
          const res = await origDraw.apply(this, arguments);
          if (this.maskGroup) {
            for (let i = 0; i < this.maskGroup.numChildren; i++) {
              const child = this.maskGroup.getChildAt(i);
              if (child) {
                child.touchEnabled = false; // Não engole o clique!
              }
            }
          }
          if (window.ts && ts.guideLayer) {
            ts.guideLayer.touchEnabled = false;
          }
          console.log("[PATCH] Máscara do tutorial ajustada para permitir cliques nos botões!");
          return res;
        };

        // Corrige buttonGuideTap para nunca travar isClick permanentemente
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
  console.log('Passando 2103...');
  await page.mouse.click(360, 1210);
  await new Promise(r => setTimeout(r, 2000));

  console.log('Em 2104 com o patch! Clicando em Challenge Boss (540, 540)...');
  await page.mouse.click(540, 540);
  await new Promise(r => setTimeout(r, 3000));

  const ss = path.join(__dirname, 'screenshot_after_hollow_fix.png');
  await page.screenshot({ path: ss });
  console.log('Salvo screenshot em:', ss);

  await browser.close();
}

testHollowFix();
