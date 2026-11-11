import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const site = '/Users/loomiskoo/loomis/Project/miniTool/word-card-tale/dist/promo';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, s) => {
  const r = (q.url.split('?')[0] || '/').replace(/^\/+/, '') || 'index.html';
  const f = path.join(site, r);
  if (!fs.existsSync(f)) { s.writeHead(404).end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));

const INIT = `
(() => {
  const Orig = window.AudioContext || window.webkitAudioContext;
  let shared = null, rec = null; const chunks = [];
  function arm(ctx) {
    try {
      const dest = ctx.createMediaStreamDestination();
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (t, ...rest) {
        const r = connect.call(this, t, ...rest);
        if (t === ctx.destination) { try { connect.call(this, dest); } catch (e) {} }
        return r;
      };
      rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.start(500);
      window.__REC = rec;
    } catch (e) { window.__RECERR = String(e); rec = null; }
  }
  function Ctor(...a) { if (!shared) { shared = new Orig(...a); arm(shared); } return shared; }
  window.AudioContext = Ctor; window.webkitAudioContext = Ctor;
  window.__stopAudio = () => new Promise((res) => {
    if (!rec || rec.state === 'inactive') return res('');
    rec.onstop = async () => {
      const buf = await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer();
      const b = new Uint8Array(buf); let s = '';
      for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
      res(btoa(s));
    };
    rec.stop();
  });
})();
`;

const b = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const c = await b.newContext({ viewport: { width: 540, height: 960 } });
await c.addInitScript(INIT);
const p = await c.newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/index.html?demo`, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 1200));
await p.click('.draw-theme[data-theme="life"]');
await new Promise((r) => setTimeout(r, 1500));
console.log(await p.evaluate(() => ({ rec: window.__REC ? window.__REC.state : null, err: window.__RECERR || null })));
const a = await p.evaluate(() => window.__stopAudio());
console.log('audio chars', a.length);
if (a) fs.writeFileSync('/tmp/a-test.webm', Buffer.from(a, 'base64'));
await b.close(); srv.close();
