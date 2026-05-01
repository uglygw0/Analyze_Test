import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  await page.evaluate(() => {
    // try to find kmeans in the bundle or just trigger the runAnalysis to see if kmeans is undefined
    const btn = document.querySelector('.btn-primary');
    if(btn) {
       console.log("Btn text:", btn.innerText);
    }
  });
  
  await browser.close();
})();
