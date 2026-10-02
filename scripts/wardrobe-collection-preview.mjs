import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: '127.0.0.1', port: 5196, strictPort: true, watch: null },
  appType: 'custom',
});
server.middlewares.use('/collection-check', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<html><body style="margin:0;background:#e7ebe5"><script type="module">
import * as T from '/node_modules/three/build/three.module.js';
import { playerKid } from '/shared/rendering/avatars/kid.ts';
import { buildStandaloneItem } from '/shared/rendering/cosmetics/standalone-item.ts';
import { PLAYFUL_KID_ITEMS } from '/shared/rendering/cosmetics/playful-items.ts';
import { ITEMS } from '/shared/wardrobe/catalog.ts';
const items=ITEMS.filter(item=>Object.hasOwn(PLAYFUL_KID_ITEMS,item.id));
const renderer=new T.WebGLRenderer({antialias:true}); renderer.setSize(1800,1000); document.body.appendChild(renderer.domElement);renderer.setScissorTest(true);
window.render = mode => {
 document.querySelectorAll('label').forEach(n=>n.remove());
 for(let i=0;i<items.length;i++) {
  const item=items[i], col=i%6, row=Math.floor(i/6);
  const scene=new T.Scene();scene.background=new T.Color('#e7ebe5');
  scene.add(new T.HemisphereLight(0xffffff,0x7a826d,2));const light=new T.DirectionalLight(0xfff4df,2.5);light.position.set(3,5,5);scene.add(light);
  const model=mode==='items'?buildStandaloneItem(item.id,'#e96542'):playerKid('nico',{jersey:'#e96542'},{[item.slot]:item.id}).model;
  scene.add(model);model.rotation.y=mode==='back'?Math.PI:mode==='side'?Math.PI/2:mode==='items'?-.25:0;
  const camera=new T.PerspectiveCamera(38,0.6,.01,100);
  if(mode==='items') { const box=new T.Box3().setFromObject(model), size=box.getSize(new T.Vector3()); camera.position.set(0,0,Math.max(size.y,size.x/0.6)*1.65+.2);camera.lookAt(0,0,0); }
  else {camera.position.set(0,1.03,3.55);camera.lookAt(0,1.02,0);}
  renderer.setViewport(col*300,(1-row)*500,300,500);renderer.setScissor(col*300,(1-row)*500,300,500);renderer.render(scene,camera);
  const label=document.createElement('label');label.textContent=item.name+' · '+item.price+' coins';label.style='position:absolute;top:'+(row*500+468)+'px;left:'+col*300+'px;width:300px;text-align:center;font:600 15px system-ui;color:#345448';document.body.appendChild(label);
 }
};
window.render('front');window.ready=true;
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
    viewport: { width: 1800, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5196/collection-check');
  await page.waitForFunction(() => window.ready);
  mkdirSync('docs/wardrobe-collection-qa', { recursive: true });
  for (const mode of ['front', 'back', 'side', 'items']) {
    await page.evaluate((mode) => window.render(mode), mode);
    await page.screenshot({
      path: 'docs/wardrobe-collection-qa/' + mode + '.png',
    });
  }
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'Rendered all 12 items from front, back, side and item-only views.',
  );
} finally {
  await browser?.close();
  await server.close();
}
