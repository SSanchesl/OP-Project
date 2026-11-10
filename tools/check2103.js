const puppeteer = require('c:/Users/maste/Documents/GitHub/Piece-clon/server/node_modules/puppeteer-core');
const path = require('path');

async function check2103() {
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

  // Clique 1: avança 2101 -> 2102
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 1500));

  // Clique 2: avança 2102 -> 2103
  await page.mouse.click(360, 700);
  await new Promise(r => setTimeout(r, 1500));

  const ss = path.join(__dirname, 'screenshot_step2103.png');
  await page.screenshot({ path: ss });
  console.log('Screenshot 2103 salvo em:', ss);

  await browser.close();
}

check2103();
