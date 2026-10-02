import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: '127.0.0.1', port: 5197, strictPort: true, watch: null },
  appType: 'custom',
});
server.middlewares.use('/costume-check', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<html><body style="margin:0;background:#e8e8dc"><script type="module">
import * as T from '/node_modules/three/build/three.module.js';
import { playerKid } from '/shared/rendering/avatars/kid.ts';
import { dressedWorker } from '/shared/rendering/cosmetics/dress.ts';
const ids=['mossweaver','thunder-hen','kite-knight','comet-diver','puddle-dragon'];
const names=['Mossweaver','Thunder Hen','Kite Knight','Comet Diver','Puddle Dragon'];
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1500,850);renderer.setScissorTest(true);document.body.appendChild(renderer.domElement);
window.render=(back=false)=>{
  document.querySelectorAll('label').forEach(el=>el.remove());
  for(let row=0;row<2;row++)for(let col=0;col<5;col++){
    const scene=new T.Scene();scene.background=new T.Color('#e8e8dc');scene.add(new T.HemisphereLight(0xffffff,0x889a86,2));
    const sun=new T.DirectionalLight(0xfff4df,2.6);sun.position.set(2,4,5);scene.add(sun);
    const look={costume:ids[col]};const model=row?dressedWorker(0,{},look).model:playerKid('nico',{jersey:'#d76354'},look).model;
    model.rotation.y=back?Math.PI:0;scene.add(model);
    const camera=new T.PerspectiveCamera(36,300/425,.01,100);camera.position.set(0,1.1,3.7);camera.lookAt(0,1.02,0);
    renderer.setViewport(col*300,(1-row)*425,300,425);renderer.setScissor(col*300,(1-row)*425,300,425);renderer.render(scene,camera);
    const label=document.createElement('label');label.textContent=names[col]+' · '+(row?'worker':'kid');label.style='position:absolute;top:'+(row*425+395)+'px;left:'+(col*300)+'px;width:300px;text-align:center;font:600 16px system-ui;color:#31584b';document.body.appendChild(label);
  }
};window.render();window.ready=true;
</script></body></html>`);
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1500, height: 850 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5197/costume-check');
  await page.waitForFunction(() => window.ready);
  mkdirSync('docs/costume-qa', { recursive: true });
  await page.screenshot({ path: 'docs/costume-qa/front.png' });
  await page.evaluate(() => window.render(true));
  await page.screenshot({ path: 'docs/costume-qa/back.png' });
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Rendered all five costumes on kid and worker, front and back.');
} finally {
  await browser?.close();
  await server.close();
}
