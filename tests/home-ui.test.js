// Isolated previews never access the player's IndexedDB.
const result = document.querySelector('#result');
let passed = 0;
function assert(value, message) { if (!value) throw new Error(message); }
try {
  for (const [width, height] of [[390,844], [320,568], [360,640], [430,932], [1280,900]]) {
    const frame = document.createElement('iframe');
    frame.style.cssText = `width:${width}px;height:${height}px;border:0;display:block`;
    const loaded = new Promise(resolve => frame.addEventListener('load', resolve, {once:true}));
    frame.src = './routine-preview.html#home';
    document.querySelector('#frames').append(frame);
    await loaded;
    const doc = frame.contentDocument;
    // Module initialization and the browser's style/layout pass finish before inspection.
    for (let attempt = 0; !doc.querySelector('.home-primary') && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
    await new Promise(resolve => frame.contentWindow.requestAnimationFrame(() => frame.contentWindow.requestAnimationFrame(resolve)));
    assert(doc.querySelector('.home-dashboard'), `${width}: dashboard mounted`);
    assert(doc.documentElement.scrollWidth <= width, `${width}: no horizontal overflow`);
    assert(doc.documentElement.scrollHeight <= height, `${width}: main fits viewport`);
    const links=[...doc.querySelectorAll('.main-nav a')].filter(a=>frame.contentWindow.getComputedStyle(a).display!=='none');
    const nav = doc.querySelector('.main-nav');
    const shell = doc.querySelector('.app-shell');
    const bottomPadding = parseFloat(frame.contentWindow.getComputedStyle(shell).paddingBottom);
    assert(Math.abs(nav.getBoundingClientRect().bottom + bottomPadding - height) < 1, `${width}: menu anchored to viewport bottom`);
    assert(links.every(link => Math.abs(link.getBoundingClientRect().bottom - nav.getBoundingClientRect().bottom) < 1), `${width}: menu buttons bottom aligned`);
    assert(links.length === (width >= 434 ? 6 : 5), `${width}: responsive menus`);
    assert(links.map(a=>a.hash).join(',') === '#home,#warehouse,#residents,#adventurers,#journal'+(width >= 434 ? ',#settings' : ''), `${width}: menu order`);
    assert(doc.querySelector('#shop-interior').style.backgroundImage.includes('interior-male'), `${width}: independent background`);

    for (const id of ['journal','warehouse','residents','adventurers','home']) {
      doc.querySelector(`.screen-link[href="#${id}"]`).click();
      assert(doc.querySelector(`.screen-link[href="#${id}"]`).getAttribute('aria-current') === 'page', `${width}: ${id} navigation`);
      if (id !== 'home') assert(!doc.querySelector(`[data-screen="${id}"]`).hidden, `${width}: ${id} visible`);
    }
    doc.querySelector('.screen-link[href="#settings"]').click();
    assert(!doc.querySelector('[data-screen="settings"]').hidden, `${width}: settings screen`);
    const select = doc.querySelector('#locale-select');
    select.value = 'en'; select.dispatchEvent(new frame.contentWindow.Event('change', {bubbles:true}));
    assert(doc.documentElement.lang === 'en', `${width}: English locale`);
    doc.querySelector('.screen-link[href="#home"]').click();
    assert(doc.querySelector('.home-phase-card h3').textContent === 'Morning report', `${width}: English phase`);
    assert(doc.querySelector('#game-date').textContent.includes('Year 1'), `${width}: English date`);
    assert(!/[\u3040-\u30ff\u3400-\u9fff]/.test(doc.querySelector('.home-dashboard').innerText.replace('日本語','')), `${width}: no untranslated visible text`);
    assert(doc.documentElement.scrollWidth <= width, `${width}: English no horizontal overflow`);
    assert(doc.documentElement.scrollHeight <= height, `${width}: English main fits viewport`);
    select.value = 'ja'; select.dispatchEvent(new frame.contentWindow.Event('change', {bubbles:true}));
    assert(doc.querySelector('.home-phase-card h3').textContent === '朝の報告', `${width}: Japanese restored`);
    const primary = doc.querySelector('.home-primary');
    const win = frame.contentWindow;
    primary.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:1}));
    primary.dispatchEvent(new win.PointerEvent('pointerup',{bubbles:true,pointerType:'touch',pointerId:1}));
    primary.click();
    assert(doc.querySelector('.home-report'), `${width}: report opens dedicated layout`);
    assert(doc.querySelector('.report-heading').textContent.includes('営業報告'), `${width}: report title`);
    assert(doc.querySelector('.report-row strong').textContent === '0 G', `${width}: no invented first-day sales`);
    assert(frame.contentWindow.getComputedStyle(nav).display === 'grid', `${width}: report retains bottom menu`);
    assert(frame.contentWindow.getComputedStyle(doc.querySelector('.screen-link[href="#settings"]')).display !== 'none', `${width}: report language settings accessible`);
    assert(doc.documentElement.scrollWidth <= width, `${width}: report no horizontal overflow`);
    select.value = 'en'; select.dispatchEvent(new win.Event('change', {bubbles:true}));
    assert(doc.querySelector('.report-heading').textContent.includes('Business report'), `${width}: report translated`);
    assert(doc.querySelector('.report-next').textContent.includes('Next'), `${width}: green button translated`);
    assert(doc.documentElement.scrollWidth <= width, `${width}: English report no horizontal overflow`);
    select.value = 'ja'; select.dispatchEvent(new win.Event('change', {bubbles:true}));
    doc.querySelector('[data-action="reportNext"]').click();
    assert(doc.querySelector('.report-return'), `${width}: return report page`);
    doc.querySelector('[data-action="reportNext"]').click();
    assert(!doc.querySelector('.home-report'), `${width}: closes report`);
    assert(doc.querySelector('.home-phase-card h3').textContent === '仕入れ', `${width}: report advances to purchase`);
    assert(doc.querySelector('.home-details'), `${width}: report opens purchase directly`);
    assert(!doc.querySelector('[data-screen="purchase"]').hidden, `${width}: purchase screen visible`);
    assert(doc.querySelector('[data-screen="purchase"] [data-action="procurementConfirm"]'), `${width}: merchant purchase controls available`);
    doc.querySelector('.home-primary').click();
    assert(doc.documentElement.scrollHeight <= height, `${width}: next phase fits viewport`);
    passed++;
    const item = document.createElement('li');
    item.textContent = `PASS ${width}×${height}: layout, five menus, both languages, separate layers and phase action`;
    document.querySelector('#checks').append(item);
  }
  result.textContent = `PASS ${passed}/${passed}`;
} catch (error) { result.textContent = `FAIL after ${passed}: ${error.message}`; console.error(error); }
