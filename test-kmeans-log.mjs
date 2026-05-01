import puppeteer from 'puppeteer';
import fs from 'fs';

const csv = "x,y\n1,1\n1,2\n10,10\n10,11\n5,5\n";
fs.writeFileSync('dummy.csv', csv);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.upload-zone input[type="file"]');
  
  const input = await page.$('.upload-zone input[type="file"]');
  await input.uploadFile('dummy.csv');
  await page.waitForSelector('.file-info-card');
  await page.select('.nav-select', 'kmeans');
  
  // Inject script to click and intercept the actual value
  await page.evaluate(() => {
    const oldSetModel = window.setModel; // We can't access React state directly easily
  });
  
  const runBtn = await page.waitForSelector('.btn-primary');
  await runBtn.click();
  
  // Wait to see if .result-card appears
  try {
    await page.waitForSelector('.result-card', { timeout: 2000 });
    console.log("Result card appeared!");
  } catch(e) {
    console.log("Result card did NOT appear!");
  }
  
  await browser.close();
})();
