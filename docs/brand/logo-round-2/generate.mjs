import fs from 'node:fs';
import path from 'node:path';

const out = import.meta.dirname;
const root = path.resolve(out, '../../..');
const fredoka = fs.readFileSync(path.join(root, 'node_modules/@fontsource/fredoka/files/fredoka-latin-600-normal.woff2')).toString('base64');
const dm = fs.readFileSync(path.join(root, 'node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2')).toString('base64');
const fredokaStyle = `<style>@font-face{font-family:FredokaLogo;src:url(data:font/woff2;base64,${fredoka}) format('woff2');font-weight:600}.soft{font-family:FredokaLogo,sans-serif;font-weight:600}</style>`;
const dmStyle = `<style>@font-face{font-family:DMSansLogo;src:url(data:font/woff2;base64,${dm}) format('woff2');font-weight:700}.sharp{font-family:DMSansLogo,sans-serif;font-weight:700}</style>`;

const ink = '#273449';
const light = '#f8f2e8';
const coral = '#e7605b';
const aqua = '#47b7c9';
const violet = '#7568df';
const orange = '#fa8464';
const blue = '#4b70df';
const pink = '#f0759b';

const marks = [
  {
    id: '01-jolt-j',
    name: 'Jolt J',
    idea: 'A loose J with a small spark: the simplest evolution of the brand initial.',
    mark: `<path d="M59 43h80M121 44v68c0 34-19 52-49 52-24 0-42-13-48-33" fill="none" stroke="${coral}" stroke-width="25" stroke-linecap="round" stroke-linejoin="round"/><path d="M154 24l5 13 13 5-13 5-5 13-5-13-13-5 13-5z" fill="${aqua}"/><circle cx="177" cy="72" r="5" fill="${coral}"/>`,
    text: `<text class="soft" x="214" y="128" font-size="78" letter-spacing="-2.6" fill="${ink}">jumbleyard</text>`,
    darkText: `<text class="soft" x="214" y="128" font-size="78" letter-spacing="-2.6" fill="${light}">jumbleyard</text>`,
  },
  {
    id: '02-jumble-burst',
    name: 'Jumble Burst',
    idea: 'A crooked five-part burst: quick, chaotic, and legible as a tiny app icon.',
    mark: `<g fill="none" stroke-width="24" stroke-linecap="round"><path d="M105 27v43M164 139l-38-29M39 88l43 6" stroke="${violet}"/><path d="M161 47l-36 36M70 158l18-45" stroke="${orange}"/></g><circle cx="105" cy="96" r="16" fill="${ink}"/>`,
    text: `<text class="sharp" x="217" y="124" font-size="67" letter-spacing="-2.9" fill="${ink}">JUMBLEYARD</text>`,
    darkText: `<text class="sharp" x="217" y="124" font-size="67" letter-spacing="-2.9" fill="${light}">JUMBLEYARD</text>`,
  },
  {
    id: '03-chaos-grin',
    name: 'Chaos Grin',
    idea: 'An offbeat grin that gives the party game a recognizable character.',
    mark: `<circle cx="104" cy="97" r="70" fill="none" stroke="${blue}" stroke-width="14"/><circle cx="78" cy="80" r="8" fill="${ink}"/><path d="M122 77l18-4" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/><path d="M67 119c21 31 58 38 83 8" fill="none" stroke="${blue}" stroke-width="13" stroke-linecap="round"/><path d="M164 21l5 13 13 5-13 5-5 13-5-13-13-5 13-5z" fill="${pink}"/>`,
    darkMark: `<circle cx="104" cy="97" r="70" fill="none" stroke="${blue}" stroke-width="14"/><circle cx="78" cy="80" r="8" fill="${light}"/><path d="M122 77l18-4" fill="none" stroke="${light}" stroke-width="10" stroke-linecap="round"/><path d="M67 119c21 31 58 38 83 8" fill="none" stroke="${blue}" stroke-width="13" stroke-linecap="round"/><path d="M164 21l5 13 13 5-13 5-5 13-13-5 13-5z" fill="${pink}"/>`,
    text: `<text class="sharp" x="214" y="127" font-size="73" letter-spacing="-3.4" fill="${ink}">jumbleyard</text>`,
    darkText: `<text class="sharp" x="214" y="127" font-size="73" letter-spacing="-3.4" fill="${light}">jumbleyard</text>`,
  },
];

function svg(viewBox, body, title, fontStyle = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}" viewBox="${viewBox}">${fontStyle}${body}</svg>\n`;
}

for (const concept of marks) {
  const darkMark = concept.darkMark ?? (concept.id === '02-jumble-burst'
    ? concept.mark.replace(`fill="${ink}"`, `fill="${light}"`)
    : concept.mark);
  const fontStyle = concept.id === '01-jolt-j' ? fredokaStyle : dmStyle;
  fs.writeFileSync(path.join(out, `${concept.id}.svg`), svg('0 0 760 190', `${concept.mark}${concept.text}`, `${concept.name} Jumbleyard logo`, fontStyle));
  fs.writeFileSync(path.join(out, `${concept.id}-dark.svg`), svg('0 0 760 190', `${darkMark}${concept.darkText}`, `${concept.name} Jumbleyard logo for dark backgrounds`, fontStyle));
  fs.writeFileSync(path.join(out, `${concept.id}-mark.svg`), svg('0 0 200 190', concept.mark, `${concept.name} mark`));
  fs.writeFileSync(path.join(out, `${concept.id}-dark-mark.svg`), svg('0 0 200 190', darkMark, `${concept.name} mark for dark backgrounds`));
}

const rows = marks.map((c,i) => `<section><header><strong>0${i+1} / ${c.name}</strong><span>${c.idea}</span></header><div class="light"><img src="${c.id}.svg" alt="${c.name} logo on the site background"></div><div class="dark"><img src="${c.id}-dark.svg" alt="${c.name} logo on the dark header"></div><div class="small"><span>32px marks</span><b><img src="${c.id}-mark.svg" alt="${c.name} small mark"></b><b class="dark-small"><img src="${c.id}-dark-mark.svg" alt="${c.name} small mark on dark"></b></div></section>`).join('');
fs.writeFileSync(path.join(out, 'compare.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Jumbleyard logo ideas · round two</title><style>*{box-sizing:border-box}body{margin:0;padding:34px;background:#d9e9db;color:#273449;font:16px Arial,sans-serif}.wrap{max-width:1120px;margin:auto}h1{font-size:35px;margin:0 0 7px}p{margin:0 0 26px;color:#4f6170}section{padding:22px;margin:0 0 22px;border-radius:24px;background:#fffaf1;box-shadow:0 6px 0 #bed0c1}header{display:flex;gap:14px;align-items:baseline;margin-bottom:15px}header strong{font-size:15px;letter-spacing:1.6px;text-transform:uppercase;min-width:195px}header span{color:#667786;font-size:14px}.light,.dark{height:172px;border-radius:16px;display:flex;align-items:center;justify-content:center;padding:12px}.light{background:linear-gradient(110deg,#cfedf1,#e3efd9)}.dark{background:#193d36;margin-top:7px}.light img,.dark img{width:min(760px,100%);height:100%;object-fit:contain}.small{display:flex;align-items:center;gap:10px;margin-top:11px;color:#657481;font-size:13px}.small b{width:46px;height:46px;display:grid;place-items:center;border-radius:9px;background:#e3efd9}.small b img{width:32px;height:32px}.small .dark-small{background:#193d36}</style><div class="wrap"><h1>Jumbleyard · logo round two</h1><p>Simple marks, fresh accent colors, and no filled logo tiles.</p>${rows}</div></html>\n`);
