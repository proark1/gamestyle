import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: '127.0.0.1', port: 5199, watch: null },
  appType: 'custom',
});
server.middlewares.use('/wardrobe-check', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<html><body style="margin:0;background:#dde4e2"><script type="module">
import * as T from '/node_modules/three/build/three.module.js';
import { playerKid } from '/shared/rendering/avatars/kid.ts';
const items = [ ['hat','viking-helmet'], ['hat','skipper-cap'], ['top','badge-sash'], ['shoes','high-tops'], ['shoes','clown-shoes'], ['shoes','golden-kicks'], ['face','snorkel-mask'], ['beard','trimmed-beard'], ['beard','wizard-beard'] ];
const renderer = new T.WebGLRenderer({antialias:true});
renderer.setSize(1800,1000); document.body.appendChild(renderer.domElement);
renderer.setScissorTest(true);
for(let row=0;row<2;row++) for(let i=0;i<items.length;i++) {
 const scene = new T.Scene(); scene.background=new T.Color('#dde4e2');
 scene.add(new T.HemisphereLight(0xffffff,0x667766,2)); const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(3,5,5);scene.add(light);
 const [slot,id]=items[i]; const {model}=playerKid('nico',{jersey:'#e96542'},{[slot]:id}); scene.add(model); model.rotation.y=row===0?0:Math.PI*0.85;
 const camera=new T.PerspectiveCamera(30,0.4,0.01,100);camera.position.set(0,1.0,4.5);camera.lookAt(0,0.94,0);
 renderer.setViewport(i*200,(1-row)*500,200,500);renderer.setScissor(i*200,(1-row)*500,200,500); renderer.render(scene,camera);
 const label=document.createElement('div');label.textContent=id;label.style='position:absolute;top:'+ (row*500+475)+'px;left:'+i*200+'px;width:200px;text-align:center;font:14px sans-serif';document.body.appendChild(label);
}
window.ready=true;
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
  page.on('pageerror', console.error);
  await page.goto('http://127.0.0.1:5199/wardrobe-check');
  await page.waitForFunction(() => window.ready);
  mkdirSync('docs/wardrobe-fit-qa', { recursive: true });
  await page.screenshot({ path: 'docs/wardrobe-fit-qa/lineup.png' });
} finally {
  await browser?.close();
  await server.close();
}
