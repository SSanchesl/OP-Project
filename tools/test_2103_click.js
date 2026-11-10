const puppeteer = require('c:/Users/maste/Documents/GitHub/Piece-clon/server/node_modules/puppeteer-core');
const path = require('path');

async function testStep2103Click() {
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

  // Espera Nami carregar
  await new Promise(r => setTimeout(r, 10000));

  // 2101 -> 2102
  console.log('Passando 2101...');
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 1500));

  // 2102 -> 2103
  console.log('Passando 2102...');
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 1500));

  console.log('\nAgora em 2103! Tentando clicar onde a mãozinha aponta: (x=360, y=1210)...');
  await page.mouse.click(360, 1210);
  await new Promise(r => setTimeout(r, 2000));

  const ss = path.join(__dirname, 'screenshot_step2104.png');
  await page.screenshot({ path: ss });
  console.log('Screenshot após clique 2103 salvo em:', ss);

  await browser.close();
}

testStep2103Click();
