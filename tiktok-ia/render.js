// Rend des slides HTML 1080x1920 en PNG : node render.js slides.json dossier
const { chromium } = require('playwright');
const fs = require('fs');
const [,, src, out] = process.argv;
const slides = JSON.parse(fs.readFileSync(src, 'utf8'));
const css = `*{margin:0;box-sizing:border-box}body{width:1080px;height:1920px;background:#0b0b10;color:#f4f1ea;
font-family:'Inter Display',Inter,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:120px 96px;position:relative}
.tag{position:absolute;top:110px;left:96px;font:600 34px 'JetBrains Mono';color:#ff6a3d;letter-spacing:2px}
.n{position:absolute;bottom:110px;right:96px;font:500 30px 'JetBrains Mono';color:#6b6b78}
h1{font-weight:800;font-size:104px;line-height:1.05;letter-spacing:-2px}
p{font-weight:500;font-size:54px;line-height:1.3;margin-top:56px;color:#c9c6bf}
em{font-style:normal;color:#ff6a3d}`;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [i, s] of slides.entries()) {
    await pg.setContent(`<style>${css}</style><div class=tag>&gt; IA_AUX_COMMANDES // ${s.tag}</div><h1>${s.h}</h1>${s.p ? `<p>${s.p}</p>` : ''}<div class=n>${i + 1}/${slides.length}</div>`);
    await pg.screenshot({ path: `${out}/slide${i + 1}.png` });
  }
  await b.close();
})();
