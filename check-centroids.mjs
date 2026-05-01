import puppeteer from 'puppeteer';
import fs from 'fs';

const csv = "x,y\n1,1\n1,2\n10,10\n10,11\n5,5\n";
fs.writeFileSync('dummy.csv', csv);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.upload-zone input[type="file"]');
  
  await page.evaluate(() => {
    // Intercept setModel to log the payload
    const oldSetModel = window.setModel;
    window.interceptedModel = null;
    // We can't easily intercept a React hook, but we can patch Array.prototype.map temporarily or just use the UI.
  });
  
  const input = await page.$('.upload-zone input[type="file"]');
  await input.uploadFile('dummy.csv');
  await page.waitForSelector('.file-info-card');
  await page.select('.nav-select', 'kmeans');
  
  const runBtn = await page.waitForSelector('.btn-primary');
  await runBtn.click();
  
  await new Promise(r => setTimeout(r, 1000));
  
  await browser.close();
})();
