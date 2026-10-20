// Builds the single-file test copy and checks it opens from file:// with no errors.
const { execSync } = require('child_process'), { chromium } = require('playwright-core'), fs = require('fs'), assert = require('assert');
const OUT = '/workspace/memory-game-test.html';
execSync('node build.js', { cwd: __dirname + '/..', env: Object.assign({}, process.env, { MG_SINGLE: OUT }) });
(async () => { const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => fs.existsSync(f)); const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {}); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + OUT); await p.click('[data-id=herbs]'); await p.waitForTimeout(400); await p.click('[data-act=start]'); assert(await p.locator('[data-act=pick]').count() === 3); assert.deepStrictEqual(errs, []);
  console.log('ok single-file copy', OUT, fs.statSync(OUT).size, 'bytes'); await b.close(); })().catch(e => { console.error('FAIL', e.message); process.exit(1); });
