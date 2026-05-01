import puppeteer from 'puppeteer';
import fs from 'fs';

// Create dummy CSV
const csv = "x,y\n1,1\n1,2\n10,10\n10,11\n5,5\n";
fs.writeFileSync('dummy.csv', csv);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', error => console.log('ERROR:', error.message));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  // Wait for the app to load
  await page.waitForSelector('.upload-zone input[type="file"]');
  
  // Upload file
  const input = await page.$('.upload-zone input[type="file"]');
  await input.uploadFile('dummy.csv');
  
  // Wait for file info card to appear (meaning data is loaded)
  await page.waitForSelector('.file-info-card');
  
  // Change select to kmeans
  await page.select('.nav-select', 'kmeans');
  
  // Click run
  const runBtn = await page.waitForSelector('.btn-primary');
  await runBtn.click();
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 1000));
  
  console.log("Done test");
  await browser.close();
})();
