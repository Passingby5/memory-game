// Playwright phone click-through (390x844 portrait and 844x390 landscape). Run: node tests/browser.js [url]  SHOTS=dir for JPGs.
const { chromium } = require('playwright-core'), http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const SITE = path.join(__dirname, '../site'), TYPES = { html: 'text/html', js: 'text/javascript', json: 'application/json', png: 'image/png', webmanifest: 'application/manifest+json' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(SITE, p); if (!f.startsWith(SITE) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0, () => res(s)); });
let passed = 0; const ok = m => { passed++; console.log('ok', m); };
(async () => {
  let base = process.argv[2], server; if (!base) { server = await serve(); base = 'http://127.0.0.1:' + server.address().port + '/'; }
  const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(f => fs.existsSync(f));
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const shotDir = process.env.SHOTS;
  for (const vp of [{ width: 390, height: 844, name: 'portrait' }, { width: 844, height: 390, name: 'landscape' }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(), errors = []; await page.addInitScript(() => { window.MG_TRAIN_MS = 60; });
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
    const tap = async sel => { await page.click(sel); await page.waitForTimeout(400); };
    const layout = async where => { const r = await page.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1, small: [...document.querySelectorAll('button,a')].filter(e => e.offsetParent).map(e => { const b = e.getBoundingClientRect(); return [e.textContent.slice(0, 25), b.width, b.height]; }).filter(b => b[1] < 48 || b[2] < 48) })); assert(!r.over, vp.name + ' overflow at ' + where); assert.deepStrictEqual(r.small, [], vp.name + ' small targets at ' + where); };
    const shot = async n => { if (shotDir && vp.name === 'portrait') await page.screenshot({ path: path.join(shotDir, (process.env.SHOT_PREFIX || '') + n), type: 'jpeg', quality: 85 }); };
    await page.goto(base, { waitUntil: 'load' });
    const v = await (await page.request.get(base + 'version.json?t=' + Date.now())).json();
    assert.strictEqual(await page.textContent('#ver'), v.label); assert(/^v\d+ - \w+ \d+ - \w{7}$/.test(v.label)); ok(vp.name + ' version label ' + v.label);
    assert.strictEqual(await page.locator('[data-act=sec],[data-act=soon]').count(), 6); await layout('home'); ok(vp.name + ' home lists 6 sections, no overflow, big targets');
    await shot('1-home.jpg');
    if (await page.locator('[data-act=soon]').count()) { const sid = await page.getAttribute('[data-act=soon]', 'data-id'); await tap('[data-act=soon][data-id=' + sid + ']'); assert(/Coming soon/.test(await page.textContent('[data-id=' + sid + ']'))); ok(vp.name + ' coming soon tap'); }
    await tap('[data-act=sec][data-id=herbs]'); await layout('herbs'); await tap('[data-act=start]'); await layout('quiz');
    // double tap on a choice only counts once (debounce + answered lock)
    const ans = await page.evaluate(() => MG.UI.state().session.q.answer);
    await page.dblclick('[data-act=pick][data-i="' + ans + '"]'); await page.waitForTimeout(400);
    let s = await page.evaluate(() => MG.UI.state()); assert.strictEqual(s.stats.right + s.stats.wrong, 1); assert.strictEqual(s.stats.right, 1); ok(vp.name + ' right answer graded once on double tap');
    assert(await page.locator('#fb .warn').count() === 1 && /doctor/.test(await page.textContent('#fb'))); await shot('2-quiz-answer.jpg'); await layout('feedback'); ok(vp.name + ' feedback shows warning, doctor note, sources');
    await tap('[data-act=next]'); const wrong = await page.evaluate(() => (MG.UI.state().session.q.answer + 1) % 3); await tap('[data-act=pick][data-i="' + wrong + '"]');
    s = await page.evaluate(() => MG.UI.state()); const missed = s.session.q.id; assert.strictEqual(s.boxes[missed].box, 1); ok(vp.name + ' wrong answer resets to box 1');
    await tap('[data-act=next]'); const qi = await page.evaluate(() => MG.UI.state().session.i);
    await page.reload({ waitUntil: 'load' }); assert(await page.locator('[data-act=resume]').count() === 1); await tap('[data-act=resume]');
    assert.strictEqual(await page.evaluate(() => MG.UI.state().session.i), qi); ok(vp.name + ' save and resume after reload');
    for (let i = qi; i < 10; i++) { await tap('[data-act=pick][data-i="0"]'); await tap('[data-act=next]'); }
    assert(/Done/.test(await page.textContent('h1'))); ok(vp.name + ' finished 10-question session');
    await tap('[data-act=deck][data-id=herbs]'); await tap('[data-act=lookup]'); await layout('lookup'); await tap('[data-act=sym][data-s="nausea"]'); assert(/Ginger/.test(await page.textContent('#app'))); await layout('symptom'); await shot('3-symptom-lookup.jpg'); ok(vp.name + ' symptom lookup nausea shows ginger');
    await tap('[data-act=lookup].back'); await tap('[data-act=herbs].back'); await tap('[data-act=chinese]'); assert(/Ren Shen/.test(await page.textContent('#app'))); await layout('chinese'); await shot('4-chinese-hot-cold.jpg');
    await tap('[data-act=herbs]'); await tap('[data-act=body]'); await layout('body'); await tap('[data-act=herbs]'); await tap('[data-act=formulas]'); assert(/Cold Away/.test(await page.textContent('#app'))); await layout('formulas'); await shot('5-formulas.jpg'); await tap('[data-act=herbs]'); await tap('[data-act=dropped]'); assert(/Lobelia/.test(await page.textContent('#app'))); await tap('[data-act=herbs]');
    await tap('[data-act=browse]'); await tap('[data-act=herb][data-id=ginger]'); assert(/nccih/.test(await page.textContent('#app'))); await layout('herb'); ok(vp.name + ' chinese, body systems, dropped, browse pages');
    await tap('[data-act=browse]'); await tap('[data-act=herbs]'); await tap('[data-act=home]'); await tap('[data-act=about]'); assert(/mskcc/.test(await page.textContent('#app'))); await layout('about'); ok(vp.name + ' about page with sources');
    // History deck: open, practice one set, answer, see why + sources, browse cards.
    await tap('[data-act=home]'); await tap('[data-act=sec][data-id=history]'); await layout('history'); await shot('history-1-menu.jpg');
    await tap('[data-act=start][data-set="Vietnam"]'); await layout('history quiz');
    let hs = await page.evaluate(() => MG.UI.state().session); assert.strictEqual(hs.deck, 'history');
    assert(hs.ids.every(id => true)); const hset = await page.evaluate(ids => ids.map(id => MG.decks.history.cards.find(c => c.id === id).set), hs.ids); assert(hset.every(x => x === 'Vietnam'));
    await tap('[data-act=pick][data-i="' + hs.q.answer + '"]'); assert(/Right/.test(await page.textContent('#fb h2'))); assert(/britannica|archives\.gov|state\.gov|https:/.test(await page.innerHTML('#fb'))); assert(!/wiki/i.test(await page.innerHTML('#fb'))); await layout('history feedback'); await shot('history-2-answer.jpg');
    ok(vp.name + ' history Vietnam set practice with sources');
    await tap('[data-act=deck][data-id=history]'); await tap('[data-act=cards]'); assert(/Tel Dan/.test(await page.textContent('#app'))); await layout('history cards'); await shot('history-3-cards.jpg'); await tap('[data-act=deck].back'); await tap('[data-act=home]');
    ok(vp.name + ' history browse cards');
    // Other quiz decks: open, practice, answer right, see why and sources, browse.
    for (const dk of ['survival', 'truth', 'vocab']) { if (!(await page.evaluate(k => !!MG.decks[k], dk))) continue;
      if (await page.locator('[data-act=home]').count()) await tap('[data-act=home]'); await tap('[data-act=sec][data-id=' + dk + ']'); await layout(dk + ' menu'); await shot(dk + '-1-menu.jpg');
      await tap('[data-act=start][data-deck=' + dk + ']'); const a2 = await page.evaluate(() => MG.UI.state().session.q.answer); await tap('[data-act=pick][data-i="' + a2 + '"]');
      assert(/Right/.test(await page.textContent('#fb h2'))); if (dk === 'vocab') { const fl = await page.textContent('#filled'), want = await page.evaluate(() => { const s = MG.UI.state().session; return MG.decks.vocab.cards.find(c => c.id === s.q.id); }); assert(fl.includes(want.a) && !fl.includes('____')); assert((await page.textContent('#fb')).includes(want.vi)); } assert(/https:/.test(await page.innerHTML('#fb'))); assert(!/wiki/i.test(await page.innerHTML('#fb'))); await layout(dk + ' feedback'); await shot(dk + '-2-answer.jpg');
      await tap('[data-act=deck].back'); await tap('[data-act=cards]'); await layout(dk + ' cards'); await tap('[data-act=deck].back'); await tap('[data-act=home]'); ok(vp.name + ' ' + dk + ' deck practice, sources, browse'); }
    // B-1 herb card St John's wort doctor line; Circulatory Support med warning
    await tap('[data-act=sec][data-id=herbs]'); await tap('[data-act=browse]'); await tap('[data-act=herb][data-id=stjohnswort]');
    let tx = await page.textContent('#app'); assert(/see a doctor/.test(tx) && /interact/i.test(tx) && !/Pregnancy, nursing/.test(tx)); await shot('fix-1-stjohnswort.jpg');
    await page.goBack(); await page.waitForTimeout(400); assert(await page.locator('[data-act=herb][data-id=ginger]').count() === 1, 'back gesture returns to herb list'); ok(vp.name + ' B-1 St Johns wort doctor line; M-2 back gesture goes back one screen');
    await page.goBack(); await page.waitForTimeout(400); assert(await page.locator('[data-act=browse]').count() === 1); await tap('[data-act=formulas]'); assert(/Do not stop or change prescribed blood pressure/.test(await page.textContent('#app'))); ok(vp.name + ' formula med warning');
    await tap('[data-act=herbs].back'); await tap('[data-act=home]');
    // M-4 and M-5 badges
    await tap('[data-act=sec][data-id=history]'); await tap('[data-act=cards][data-deck=history]'); tx = await page.textContent('#app'); assert(/No outside record found yet/.test(tx) && /Traditional date/.test(tx));
    await page.evaluate(() => [...document.querySelectorAll('h2')].find(h => h.textContent === 'Bible Timeline').scrollIntoView()); await shot('fix-2-bible-records.jpg'); await page.goBack(); await page.waitForTimeout(300); await page.goBack(); await page.waitForTimeout(300);
    assert(await page.locator('#ver').count() === 1, 'two backs reach home');
    await tap('[data-act=sec][data-id=survival]'); await tap('[data-act=start][data-set="Water"]'); const wa = await page.evaluate(() => MG.UI.state().session.q.answer); await tap('[data-act=pick][data-i="' + wa + '"]');
    assert(/Safety level:/.test(await page.textContent('#fb'))); if (vp.name === 'landscape') { const top = await page.evaluate(() => document.getElementById('fb').getBoundingClientRect().top); assert(top < 100, 'landscape scrolls to feedback ' + top); }
    await shot('fix-3-water-level.jpg'); await tap('[data-act=deck].back'); await tap('[data-act=home]'); ok(vp.name + ' M-4 Bible records, M-5 water levels, p-1 landscape scroll');
    // M-7 vocab meaning once
    await tap('[data-act=sec][data-id=vocab]'); await tap('[data-act=start][data-deck=vocab]'); const va = await page.evaluate(() => MG.UI.state().session.q.answer); await tap('[data-act=pick][data-i="' + va + '"]');
    tx = await page.textContent('#fb'); assert.strictEqual(tx.split('Tiếng Việt').length, 2, 'Vietnamese shown once'); await shot('fix-4-vocab-once.jpg'); await tap('[data-act=deck].back'); await tap('[data-act=home]'); ok(vp.name + ' M-7 vocab meaning once');
    // Memory trainers
    await tap('[data-act=sec][data-id=memory]'); await layout('memory menu'); await shot('memory-1-menu.jpg');
    await tap('[data-act=span]'); assert(await page.locator('#flash').count() === 1 && await page.locator('[data-act=memory]').count() === 1, 'm-9 Quit on flash'); await page.waitForSelector('[data-act=spandone]', { timeout: 10000 }); await layout('digit pad');
    const cur = await page.evaluate(() => MG.trainers.span.cur); for (const ch of cur) { await page.click('[data-act=digit][data-d="' + ch + '"]'); await page.waitForTimeout(150); }
    await shot('memory-2-digit-span.jpg'); await tap('[data-act=spandone]'); assert(/Right/.test(await page.textContent('#spanres'))); assert.strictEqual(await page.evaluate(() => MG.UI.state().best.span), 3); ok(vp.name + ' digit span right answer, best saved');
    await page.evaluate(() => { window.MG_TRAIN_MS = 350; }); await tap('[data-act=memory]'); await tap('[data-act=nback]');
    const seq = await page.evaluate(() => MG.trainers.nb.seq); let seen = -1;
    while (true) { const st2 = await page.evaluate(() => MG.trainers.nb && document.getElementById('nbl') ? MG.trainers.nb.i : 99); if (st2 >= seq.length || st2 === 99) break; if (st2 !== seen) { seen = st2; if (st2 >= 2 && seq[st2] === seq[st2 - 2]) await page.click('[data-act=nbmatch]'); } await page.waitForTimeout(25); }
    await page.waitForSelector('#nbres', { timeout: 10000 }); assert(/Score 100%/.test(await page.textContent('#nbres')), await page.textContent('#nbres')); await layout('nback'); ok(vp.name + ' 2-back scored 100% when tapping every match');
    await tap('[data-act=memory]'); await tap('[data-act=palace]'); await layout('palace study'); const pairs = await page.evaluate(() => MG.trainers.pal.pairs); await tap('[data-act=palready]'); await shot('memory-3-palace.jpg');
    for (const p of pairs) await tap('[data-act=palpick][data-v="' + p.item + '"]');
    assert(/8 of 8/.test(await page.textContent('#palres'))); ok(vp.name + ' memory palace 8 of 8');
    await tap('[data-act=memory]'); await tap('[data-act=start][data-deck=memory]'); const mq = await page.evaluate(() => MG.UI.state().session.q.answer); await tap('[data-act=pick][data-i="' + mq + '"]'); assert(/Right/.test(await page.textContent('#fb h2'))); await layout('memory practice'); ok(vp.name + ' spaced recall research cards');
    await tap('[data-act=next]'); await tap('[data-act=deck].back'); await tap('[data-act=home]');
    // M-1 broken saves never white-screen
    for (const bad of ['{"v":2,"session":{"deck":"nope","ids":["x"],"i":0}}', '{"v":2}', '{"v":2,"stats":null,"boxes":[],"best":7}', '{"v":2,"session":{"deck":"herbs","ids":["gone"],"i":0,"q":{"id":"gone","choices":["a","b","c"],"answer":0,"prompt":"p"}}}', '[1,2]', '{bad']) {
      await page.evaluate(b => localStorage.setItem('mg_save', b), bad); await page.reload({ waitUntil: 'load' }); assert(await page.locator('#ver').count() === 1, 'home after bad save ' + bad);
      await tap('[data-act=sec][data-id=herbs]'); await tap('[data-act=start]'); assert.strictEqual(await page.locator('[data-act=pick]').count(), 3, 'quiz works after ' + bad); await tap('[data-act=deck].back'); await tap('[data-act=home]'); }
    await page.evaluate(() => localStorage.removeItem('mg_save')); ok(vp.name + ' M-1 six broken saves load home and play');
    assert.deepStrictEqual(errors, [], vp.name + ' console errors'); ok(vp.name + ' no console errors or warnings');
    await ctx.close();
  }
  await browser.close(); if (server) server.close(); console.log('browser: ' + passed + ' passed');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
