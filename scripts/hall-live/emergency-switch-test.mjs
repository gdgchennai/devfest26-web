// Real Worker gateway test with an isolated app and deliberately unavailable hall backend.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
const bundle = await build({
  entryPoints: ['workers/hall-live/gateway.ts'], bundle: true, write: false,
  format: 'esm', platform: 'browser',
  plugins: [{ name: 'isolated-app', setup(b) {
    b.onResolve({ filter: /\.open-next\/worker\.js$/ }, () => ({ path: 'app', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export default {fetch(request) {
      const path = new URL(request.url).pathname;
      return new Response('<html><body><h1>'+path+'</h1><a data-hall-live-link href="/live">Live</a></body></html>', {headers:{'content-type':'text/html'}});
    }};`, loader: 'js' }));
  }}],
});
const options = (flag) => convertV4MiniflareOptions({ host: '127.0.0.1', port: 0, workers: [{
  name: 'gateway', modules: true, script: bundle.outputFiles[0].text,
  compatibilityDate: '2026-10-01', bindings: flag === undefined ? {} : { HALL_LIVE_ENABLED: flag },
  // No HALL_PUBLIC or DB binding: paused paths must succeed without either.
}] });
const mf = new Miniflare(options('false'));
try {
  for (const route of ['/live', '/live/', '/live?lite=1', '/live?_rsc=example']) {
    const r = await mf.dispatchFetch('http://localhost'+route, {redirect:'manual'});
    assert.equal(r.status,307); assert.equal(r.headers.get('location'),'/agenda');
    assert.equal(r.headers.get('cache-control'),'no-store');
  }
  const head = await mf.dispatchFetch('http://localhost/live',{method:'HEAD',redirect:'manual'});
  assert.equal(head.status,307); assert.equal(await head.text(),'');
  for(const route of ['/api/halls','/api/halls/socket']) {
    const r = await mf.dispatchFetch('http://localhost'+route);
    assert.equal(r.status,503); assert.equal((await r.json()).enabled,false);
  }
  const blockedUpgrade=await mf.dispatchFetch('http://localhost/api/halls/socket',{headers:{Upgrade:'websocket'}});
  assert.equal(blockedUpgrade.status,503);
  const status = await mf.dispatchFetch('http://localhost/api/halls/availability');
  assert.deepEqual(await status.json(),{enabled:false}); assert.equal(status.headers.get('cache-control'),'no-store');
  assert.equal((await mf.dispatchFetch('http://localhost/api/halls/availability',{method:'POST'})).status,405);
  for(const route of ['/agenda','/admin/halls','/api/admin/halls']) {
    const r=await mf.dispatchFetch('http://localhost'+route);
    assert.equal(r.status,200); assert.match(await r.text(),/data-hall-live-enabled="false"/);
  }
  for(const flag of [undefined,'true',' FALSE ']) {
    await mf.setOptions(options(flag));
    const enabled=flag !== ' FALSE ';
    const r=await mf.dispatchFetch('http://localhost/api/halls/availability');
    assert.equal((await r.json()).enabled,enabled);
    const page=await mf.dispatchFetch('http://localhost/live',{redirect:'manual'});
    assert.equal(page.status,enabled?200:307);
    if(enabled)assert.doesNotMatch(await page.text(),/data-hall-live-enabled="false"/);
  }
  console.log('PASS: pause/resume, uncached redirects, HTML masking, status, HEAD and backend-independent failure paths');
} finally { await mf.dispose(); }
