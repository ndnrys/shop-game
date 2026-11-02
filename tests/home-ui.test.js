// Isolated previews never access the player's IndexedDB.
const result = document.querySelector('#result');
let passed = 0;
function assert(value, message) { if (!value) throw new Error(message); }
try {
  for (const [width, height] of [[390,844], [320,568], [1280,900]]) {
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
    assert(doc.querySelector('.home-details'), `${width}: touch-equivalent detail action`);
    doc.querySelector('[data-routine="next"]').click();
    assert(doc.querySelector('.home-phase-card h3').textContent === '仕入れ', `${width}: advances existing phase`);
    assert(doc.documentElement.scrollHeight <= height, `${width}: next phase fits viewport`);
    passed++;
    const item = document.createElement('li');
    item.textContent = `PASS ${width}×${height}: layout, five menus, both languages, separate layers and phase action`;
    document.querySelector('#checks').append(item);
  }
  result.textContent = `PASS ${passed}/${passed}`;
} catch (error) { result.textContent = `FAIL after ${passed}: ${error.message}`; console.error(error); }
