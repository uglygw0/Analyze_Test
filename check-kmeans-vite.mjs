import puppeteer from 'puppeteer';
import fs from 'fs';

const csv = "x,y\n1,1\n1,2\n10,10\n10,11\n5,5\n";
fs.writeFileSync('dummy.csv', csv);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  const input = await page.$('.upload-zone input[type="file"]');
  await input.uploadFile('dummy.csv');
  await page.waitForSelector('.file-info-card');
  await page.select('.nav-select', 'kmeans');
  
  await page.evaluate(() => {
    // Monkey patch console.error to see what's happening
    const origError = console.error;
    console.error = (...args) => {
      console.log('INTERCEPTED_ERROR:', ...args);
      origError(...args);
    };
  });
  
  const runBtn = await page.waitForSelector('.btn-primary');
  await runBtn.click();
  
  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
})();
