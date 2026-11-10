// Runs in the page's isolated world. Keep this function self-contained: capture
// serializes it with Function#toString instead of injecting another script.
export async function expandScrollableContent(options = {}) {
  const key = '__gulirExpansion';
  if (globalThis[key] && !globalThis[key].cleaned) {
    return {ok: false, code: 'already-expanding', error: 'Persiapan screenshot lain masih aktif.', warnings: []};
  }
  const cap = (name, fallback) => Number.isFinite(options[name]) && options[name] > 0
    ? Math.min(fallback, Math.floor(options[name])) : fallback;
  const limits = {
    nodes: cap('maxNodes', 100000), frames: cap('maxFrames', 16), depth: cap('maxFrameDepth', 4),
    iterations: cap('maxIterations', 8), height: cap('maxHeight', 120000),
    pixels: cap('maxPixels', 120000000), time: cap('maxPrepareMs', 5000)
  };
  const started = Date.now(), styles = [], scrolls = new Map(), documents = [], candidates = new Set();
  const expanded = new Set(), expandedFrames = new Set(), inaccessible = new Set(), observers = [];
  const originallyMissingStyle = new Set();
  const changedProperties = new Map(), tracked = new Map(), windows = new Map();
  const horizontalNeighbors = new Map();
  // Discovery counts document elements once. Virtual-list inspection may walk
  // the same descendants for several nested panels; bound that work separately
  // instead of charging those visits against the document complexity limit.
  let mutationFailure = false, nodeCount = 0, inspectionCount = 0, finished = false;
  const state = {cleaned: false, warnings: [], restore: null, check: null};
  globalThis[key] = state;
  const result = extra => ({
    ok: true, expandedContainers: expanded.size, expandedFrames: expandedFrames.size,
    inaccessibleFrames: inaccessible.size, warnings: [...state.warnings], ...extra
  });
  const fail = (code, message) => { const error = Error(message); error.code = code; throw error; };
  const assertBudget = () => {
    if (state.cleaned) fail('expired', 'Persiapan screenshot dibatalkan. Ulangi pada halaman yang stabil.');
    if (Date.now() - started > limits.time) fail('prepare-timeout', 'Persiapan panel gulir terlalu lama. Tidak ada gambar sebagian yang disimpan.');
  };
  // Stream each tree rather than materializing an arbitrarily large NodeList
  // before a budget check. Shadow roots and same-origin frames are visited by
  // discovery separately, just as with querySelectorAll.
  function* elements(root, includeRoot = false) {
    if (includeRoot) yield root;
    const doc = root.ownerDocument || root.host?.ownerDocument || root;
    const walker = doc.createTreeWalker(root, 1); // NodeFilter.SHOW_ELEMENT
    for (let el = walker.nextNode(); el; el = walker.nextNode()) yield el;
  }
  const parentOf = el => el.parentElement || el.getRootNode?.().host || null;
  const viewOf = el => el.ownerDocument.defaultView;
  const css = el => viewOf(el).getComputedStyle(el);
  const saveScroll = el => {
    if (!scrolls.has(el)) scrolls.set(el, {x: el.scrollLeft || 0, y: el.scrollTop || 0});
  };
  const set = (el, prop, value) => {
    let seen = changedProperties.get(el);
    if (!seen) {
      changedProperties.set(el, seen = new Set());
      if (el.hasAttribute?.('style') === false) originallyMissingStyle.add(el);
    }
    if (!seen.has(prop)) {
      seen.add(prop);
      styles.push({el, prop, value: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop)});
    }
    if (el.style.getPropertyValue(prop) !== value || el.style.getPropertyPriority(prop) !== 'important')
      el.style.setProperty(prop, value, 'important');
  };
  const resetScroll = (el, point) => {
    if (typeof el.scrollTo === 'function') el.scrollTo({left: point.x, top: point.y, behavior: 'instant'});
    else { el.scrollLeft = point.x; el.scrollTop = point.y; }
  };
  state.restore = () => {
    if (state.cleaned) return state.restoration || {restored: true, errors: 0};
    state.cleaned = true;
    clearTimeout(state.timer);
    let errors = 0;
    for (const observer of observers) observer.disconnect();
    for (const win of windows.keys()) {
      try { win.removeEventListener('pagehide', state.restore); } catch { errors++; }
    }
    const restoreProperty = item => {
      try {
        if (item.value) item.el.style.setProperty(item.prop, item.value, item.priority);
        else item.el.style.removeProperty(item.prop);
      } catch { errors++; }
    };
    // Restore geometry while transitions remain disabled, then commit layout
    // before restoring the author's transition rules.
    for (const item of [...styles].reverse()) if (item.prop !== 'transition-property') restoreProperty(item);
    for (const el of changedProperties.keys()) {
      try { void el.getBoundingClientRect().height; } catch { errors++; }
    }
    for (const item of [...styles].reverse()) if (item.prop === 'transition-property') restoreProperty(item);
    for (const el of originallyMissingStyle) {
      try { if (!el.getAttribute('style')?.trim()) el.removeAttribute('style'); } catch { errors++; }
    }
    for (const [el, point] of scrolls) {
      try { resetScroll(el, point); } catch { errors++; }
    }
    for (const [win, point] of [...windows].reverse()) {
      try { win.scrollTo({left: point.x, top: point.y, behavior: 'instant'}); } catch { errors++; }
    }
    // Scroll offsets may clamp if a site changed its content during capture.
    for (const [el, point] of scrolls) {
      try { if (el.isConnected !== false && (Math.abs(el.scrollLeft - point.x) > 1 || Math.abs(el.scrollTop - point.y) > 1)) errors++; }
      catch { errors++; }
    }
    for (const [win, point] of windows) {
      try { if (Math.abs(win.scrollX - point.x) > 1 || Math.abs(win.scrollY - point.y) > 1) errors++; }
      catch { errors++; }
    }
    state.restoration = {restored: errors === 0, errors};
    if (globalThis[key] === state) delete globalThis[key];
    return state.restoration;
  };
  const hiddenOrExcluded = el => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2 || !el.getClientRects().length) return true;
    // Below/right of the current viewport can be legitimate page content. A box
    // wholly before the document origin is usually an off-canvas menu/slide.
    const win = viewOf(el);
    let ancestorX = 0, ancestorY = 0;
    for (let at = parentOf(el); at; at = parentOf(at)) {
      if (at !== el.ownerDocument.scrollingElement) {
        ancestorX += at.scrollLeft || 0; ancestorY += at.scrollTop || 0;
      }
    }
    if (rect.right + win.scrollX + ancestorX <= 0 || rect.bottom + win.scrollY + ancestorY <= 0) return true;
    for (let at = el; at; at = parentOf(at)) {
      const c = css(at), tag = at.tagName?.toLowerCase();
      if (at.hidden || at.inert || at.getAttribute?.('aria-hidden') === 'true' ||
          c.display === 'none' || c.visibility === 'hidden' || c.visibility === 'collapse' ||
          c.contentVisibility === 'hidden' || Number(c.opacity) === 0) return true;
      if (['textarea', 'select', 'input', 'dialog'].includes(tag) || at.isContentEditable ||
          ['dialog', 'alertdialog', 'textbox', 'combobox', 'listbox'].includes(at.getAttribute?.('role'))) return true;
      const hint = String(at.className?.baseVal ?? at.className ?? '') + ' ' + (at.id || '');
      if (/(?:^|[\s_-])(?:carousel|swiper|slick|slider|monaco|codemirror|ace[-_]editor)(?:[\s_-]|$)/i.test(hint)) return true;
    }
    return false;
  };
  const normalizeFixed = el => {
    const fixed = [];
    for (let at = el; at; at = parentOf(at)) {
      if (css(at).position === 'fixed') fixed.push(at);
    }
    for (const at of fixed.reverse()) {
      const c = css(at), old = at.getBoundingClientRect();
      for (let ancestor = parentOf(at); ancestor; ancestor = parentOf(ancestor)) {
        const ac = css(ancestor);
        if ((ac.transform && ac.transform !== 'none') || (ac.perspective && ac.perspective !== 'none') ||
            (ac.filter && ac.filter !== 'none') || /(layout|paint|strict|content)/.test(ac.contain || ''))
          fail('fixed-containing-block', 'Panel tetap di dalam area transformasi belum aman diperluas.');
      }
      if ((c.transform && c.transform !== 'none') || ['translate', 'rotate', 'scale'].some(prop => c[prop] && c[prop] !== 'none'))
        fail('transformed-panel', 'Panel dengan transformasi belum aman diperluas.');
      remember(at);
      const extrasX = (parseFloat(c.paddingLeft) || 0) + (parseFloat(c.paddingRight) || 0) +
        (parseFloat(c.borderLeftWidth) || 0) + (parseFloat(c.borderRightWidth) || 0);
      const extrasY = (parseFloat(c.paddingTop) || 0) + (parseFloat(c.paddingBottom) || 0) +
        (parseFloat(c.borderTopWidth) || 0) + (parseFloat(c.borderBottomWidth) || 0);
      const width = old.width - (c.boxSizing === 'border-box' ? 0 : extrasX);
      for (const prop of ['width', 'min-width', 'max-width']) set(at, prop, width + 'px');
      set(at, 'height', Math.max(1, old.height - (c.boxSizing === 'border-box' ? 0 : extrasY)) + 'px');
      set(at, 'transition-property', 'none');
      set(at, 'position', 'absolute'); set(at, 'right', 'auto'); set(at, 'bottom', 'auto');
      set(at, 'top', '0px'); set(at, 'left', '0px');
      const origin = at.getBoundingClientRect();
      set(at, 'top', (old.top - origin.top) + 'px'); set(at, 'left', (old.left - origin.left) + 'px');
      const placed = at.getBoundingClientRect();
      if (Math.abs(placed.top - old.top) > 1 || Math.abs(placed.left - old.left) > 1)
        fail('fixed-position-changed', 'Posisi panel tetap tidak dapat dipertahankan dengan aman.');
    }
  };
  const virtualized = el => {
    let positioned = 0, visibleRows = 0, declaredRows = 0;
    for (const at of elements(el, true)) {
      if (++inspectionCount > limits.nodes * 4)
        fail('inspection-limit', 'Pemeriksaan panel bertingkat melebihi batas aman. Tidak ada gambar sebagian yang disimpan. Kode PANEL_WORK: ' + inspectionCount + '/' + limits.nodes * 4 + '.');
      if (inspectionCount % 100 === 0) assertBudget();
      const hint = String(at.className?.baseVal ?? at.className ?? '') + ' ' + (at.id || '');
      if (/virtualiz|react[-_]?window|cdk-virtual|ag-body-viewport|slick-viewport/i.test(hint)) return true;
      if (['row', 'listitem'].includes(at.getAttribute?.('role'))) visibleRows++;
      declaredRows = Math.max(declaredRows, Number(at.getAttribute?.('aria-rowcount')) || 0,
        Number(at.getAttribute?.('aria-setsize')) || 0);
      if (at !== el) {
        const c = css(at);
        if (c.position === 'absolute' || /matrix|translate/.test(c.transform || '')) positioned++;
      }
    }
    if (declaredRows > visibleRows && declaredRows > 0) return true;
    // Windowed lists often use a tall empty spacer with absolutely positioned
    // rows. Refuse this ambiguous layout instead of making a huge blank image.
    if (positioned >= 2 && el.scrollHeight > el.clientHeight * 3) {
      for (const child of el.children) if (child.scrollHeight >= el.scrollHeight - 2) return true;
    }
    return false;
  };
  const metrics = doc => {
    const root = doc.documentElement, body = doc.body;
    return {width: Math.max(root?.scrollWidth || 0, body?.scrollWidth || 0, root?.clientWidth || 0),
      height: Math.max(root?.scrollHeight || 0, body?.scrollHeight || 0, root?.clientHeight || 0)};
  };
  const boundSize = (width, height) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 ||
        width > 16000 || height > limits.height || width * height > limits.pixels)
      fail('expansion-limit', 'Konten panel melebihi batas aman screenshot. Tidak ada gambar sebagian yang disimpan.');
  };
  const remember = el => {
    if (!tracked.has(el)) {
      const c = css(el), rect = el.getBoundingClientRect();
      tracked.set(el, {width: rect.width, captureWidth: rect.width, horizontal: false, clientWidth: el.clientWidth, height: 0,
        cssWidth: c.width, boxSizing: c.boxSizing, padding: (parseFloat(c.paddingTop) || 0) + (parseFloat(c.paddingBottom) || 0),
        borders: (parseFloat(c.borderTopWidth) || 0) + (parseFloat(c.borderBottomWidth) || 0)});
    }
    saveScroll(el);
    return tracked.get(el);
  };
  // A fixed grid track or positioned sibling can cover newly revealed columns
  // even when scrollWidth fits. Record neighboring painted boxes before widening
  // and refuse a newly overlapping or squeezed layout rather than claim success.
  const rememberNeighbors = el => {
    if (horizontalNeighbors.has(el)) return;
    const neighbors = [], initial = el.getBoundingClientRect();
    for (let branch = el; branch; branch = parentOf(branch)) {
      const root = branch.getRootNode?.();
      const parent = branch.parentElement || (root?.host ? root : null);
      if (!parent) continue;
      const pending = [...parent.children].filter(sibling => sibling !== branch);
      while (pending.length) {
        const sibling = pending.pop();
        if (++inspectionCount > limits.nodes * 4)
          fail('inspection-limit', 'Pemeriksaan tata letak horizontal melebihi batas aman. Tidak ada gambar sebagian yang disimpan.');
        if (inspectionCount % 100 === 0) assertBudget();
        const rect = sibling.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) {
          // display:contents and zero-size wrappers can still paint children.
          for (const child of sibling.children || []) pending.push(child);
          continue;
        }
        const overlapX = Math.max(0, Math.min(initial.right, rect.right) - Math.max(initial.left, rect.left));
        const overlapY = Math.max(0, Math.min(initial.bottom, rect.bottom) - Math.max(initial.top, rect.top));
        neighbors.push({el: sibling, width: rect.width, overlapX, overlapY});
        if (overlapX <= 1 || overlapY <= 1) {
          // Preserve attachment/sidebar columns in ordinary flex and auto-table
          // layouts. Fixed tracks that still overlap are rejected by enforce.
          const c = css(sibling);
          const extras = (parseFloat(c.paddingLeft) || 0) + (parseFloat(c.paddingRight) || 0) +
            (parseFloat(c.borderLeftWidth) || 0) + (parseFloat(c.borderRightWidth) || 0);
          set(sibling, 'min-width', Math.max(0, rect.width - (c.boxSizing === 'border-box' ? 0 : extras)) + 'px');
        }
      }
    }
    horizontalNeighbors.set(el, neighbors);
  };
  const resize = (el, target, frame = false, targetWidth = null) => {
    const original = remember(el);
    const c = css(el), rect = el.getBoundingClientRect();
    // Vertical-only panels retain their original width. A real horizontal
    // scroller is widened deliberately, then the same bounded viewport tiler
    // captures its rightmost pixels as part of the single page PNG.
    if (targetWidth !== null) {
      rememberNeighbors(el);
      if (c.direction === 'rtl')
        fail('rtl-horizontal-overflow', 'Panel gulir horizontal kanan-ke-kiri belum aman diperluas. Tidak ada gambar sebagian yang disimpan.');
      const scrollbarWidth = frame ? 0 : Math.max(0, el.offsetWidth - el.clientWidth -
        (parseFloat(c.borderLeftWidth) || 0) - (parseFloat(c.borderRightWidth) || 0));
      original.captureWidth = Math.max(original.captureWidth, Math.ceil(targetWidth + scrollbarWidth));
      original.horizontal = true;
    }
    boundSize(Math.max(1, original.captureWidth), target);
    const horizontalExtras = (parseFloat(c.paddingLeft) || 0) + (parseFloat(c.paddingRight) || 0) +
      (parseFloat(c.borderLeftWidth) || 0) + (parseFloat(c.borderRightWidth) || 0);
    const width = Math.max(0, original.captureWidth - (c.boxSizing === 'border-box' ? 0 : horizontalExtras));
    for (const prop of ['width', 'min-width', 'max-width']) set(el, prop, width + 'px');
    set(el, 'transition-property', 'none');
    set(el, 'scroll-behavior', 'auto'); set(el, 'scroll-snap-type', 'none'); set(el, 'overflow-anchor', 'none');
    set(el, 'max-height', 'none'); set(el, 'flex-shrink', '0');
    if (c.contain && c.contain !== 'none') set(el, 'contain', 'none');
    if (c.contentVisibility && c.contentVisibility !== 'visible') set(el, 'content-visibility', 'visible');
    // Preserve horizontal overflow rather than revealing a hidden carousel.
    // overflow-y:auto with a full-height box avoids CSS's visible/auto coercion.
    if (!frame) {
      if (el.offsetWidth - el.clientWidth - (parseFloat(c.borderLeftWidth) || 0) - (parseFloat(c.borderRightWidth) || 0) > 2)
        set(el, 'scrollbar-gutter', 'stable');
      set(el, 'overflow-y', 'auto');
      if (original.horizontal) set(el, 'overflow-x', 'auto');
    }
    // scrollHeight excludes the horizontal scrollbar, while CSS height includes
    // its occupied space. Preserve that scrollbar (and width) but make room for
    // it, otherwise a classic 15px bar leaves the last 15px permanently clipped.
    const scrollbarHeight = frame ? 0 : Math.max(0,
      (el.offsetHeight ?? el.getBoundingClientRect().height) - el.clientHeight - original.borders);
    boundSize(Math.max(1, original.captureWidth), target + scrollbarHeight);
    const height = Math.ceil(target + scrollbarHeight - (c.boxSizing === 'border-box' ? 0 : original.padding + original.borders));
    set(el, 'height', Math.max(1, height) + 'px');
    set(el, 'min-height', Math.max(1, height) + 'px');
    original.height = Math.max(original.height, target);
    resetScroll(el, {x: original.horizontal ? 0 : scrolls.get(el).x, y: 0});
    if (frame) expandedFrames.add(el); else expanded.add(el);
    const resized = el.getBoundingClientRect();
    return Math.abs(resized.height - rect.height) > 0.5 || Math.abs(resized.width - rect.width) > 0.5;
  };
  const settle = () => new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    const timer = setTimeout(finish, 80);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(finish));
  });
  const structuralMutation = record => {
    if (record.type !== 'childList') return false;
    if (!record.addedNodes || !record.removedNodes) return true;
    for (const nodes of [record.addedNodes, record.removedNodes]) {
      for (const node of nodes) if (node.nodeType === 1) return true;
    }
    return false;
  };
  const monitor = (root, doc) => {
    const win = doc.defaultView;
    if (typeof win.MutationObserver !== 'function') return;
    const observer = new win.MutationObserver(records => {
      if (records.some(record => {
        // Sequential screenshots can include clocks/animated text. Reject
        // structural row replacement, not ordinary text/paint updates.
        if (!structuralMutation(record)) return false;
        if (horizontalNeighbors.size) return true;
        for (const el of expanded) if (el.ownerDocument === doc && el.contains(record.target)) return true;
        return expandedFrames.size > 0 && documents.some(entry => entry.doc === doc && entry.frame);
      })) mutationFailure = true;
    });
    observer.observe(root, {subtree: true, childList: true});
    observers.push(observer);
  };
  const visitDocument = (doc, frame = null, depth = 0) => {
    assertBudget();
    if (documents.some(entry => entry.doc === doc)) return;
    const win = doc.defaultView;
    if (!win || !doc.documentElement) fail('frame-loading', 'Frame belum selesai dimuat. Tunggu lalu ulangi screenshot.');
    windows.set(win, {x: win.scrollX, y: win.scrollY});
    win.addEventListener('pagehide', state.restore, {once: true});
    const entry = {doc, frame, win, originalDocument: doc};
    documents.push(entry);
    const visitRoot = root => {
      for (const el of elements(root)) {
        if (++nodeCount > limits.nodes)
          fail('node-limit', 'Halaman terlalu kompleks untuk memperluas panel dengan aman. Kode PANEL_NODES: ' + nodeCount + '/' + limits.nodes + ' elemen.');
        if (nodeCount % 100 === 0) assertBudget();
        if (el.scrollTop || el.scrollLeft) saveScroll(el);
        // Most table cells, labels and icons cannot be independent scrollers.
        // Their descendants are still visited: a short wrapper can contain an
        // overflowing child, an iframe or an open shadow tree.
        if (el.tagName?.toLowerCase() !== 'iframe' && !el.shadowRoot &&
            el.scrollWidth <= el.clientWidth + 2 && el.scrollHeight <= el.clientHeight + 2) continue;
        if (hiddenOrExcluded(el)) continue;
        const c = css(el);
        const independent = el !== doc.documentElement && el !== doc.scrollingElement;
        const horizontal = independent && el.scrollWidth > el.clientWidth + 2 &&
          (/^(auto|scroll|overlay)$/.test(c.overflowX) || Math.abs(el.scrollLeft) > 0 ||
           (/^(auto|scroll|overlay)$/.test(c.overflowY) && el.scrollHeight > el.clientHeight + 2));
        const vertical = independent && /^(auto|scroll|overlay)$/.test(c.overflowY) &&
          el.scrollHeight > el.clientHeight + 2;
        if (horizontal || vertical) {
          normalizeFixed(el);
          if (virtualized(el)) fail('virtualized-content', 'Panel memakai daftar virtual. Seluruh isi belum tersedia sekaligus, sehingga screenshot dibatalkan.');
          candidates.add(el);
        }
        if (el.shadowRoot) { monitor(el.shadowRoot, doc); visitRoot(el.shadowRoot); }
        if (el.tagName?.toLowerCase() !== 'iframe') continue;
        if (documents.length + inaccessible.size >= limits.frames + 1)
          fail('frame-limit', 'Jumlah frame melebihi batas persiapan screenshot.');
        if (depth >= limits.depth) fail('frame-depth', 'Susunan frame terlalu dalam untuk screenshot aman.');
        let child;
        try { child = el.contentDocument; if (child?.defaultView) void child.defaultView.location.href; }
        catch { child = null; }
        if (!child?.documentElement) { inaccessible.add(el); continue; }
        normalizeFixed(el);
        visitDocument(child, el, depth + 1);
      }
    };
    monitor(doc, doc);
    visitRoot(doc);
  };
  const enforce = () => {
    for (const entry of documents) {
      if (entry.frame) {
        let current;
        try { current = entry.frame.contentDocument; } catch {}
        if (current !== entry.originalDocument) fail('frame-navigation', 'Frame berpindah saat screenshot. Ulangi pada halaman yang stabil.');
      }
    }
    if (mutationFailure) fail('content-changed', 'Isi panel berubah saat screenshot. Muat semua konten lalu ulangi.');
    for (const [el, original] of tracked) {
      if (el.isConnected === false) fail('content-changed', 'Panel berubah saat screenshot.');
      if (Math.abs(el.getBoundingClientRect().width - original.captureWidth) > 1)
        fail('layout-width-changed', 'Lebar panel berubah saat diperluas. Screenshot dibatalkan agar isi tidak terpotong.');
      if (el.tagName?.toLowerCase() !== 'iframe' && el.scrollHeight > el.clientHeight + 2)
        fail('content-height-changed', 'Tinggi isi panel berubah atau tetap terpotong. Screenshot dibatalkan. Kode PANEL_HEIGHT: ' + el.tagName + ', ' + el.scrollHeight + '/' + el.clientHeight + ' px, overflow=' + css(el).overflowY + ', position=' + css(el).position + '.');
      if (el.tagName?.toLowerCase() !== 'iframe' && el.scrollWidth > el.clientWidth + 2)
        fail('content-width-changed', 'Lebar isi panel berubah atau tetap terpotong. Tidak ada gambar sebagian yang disimpan.');
      if (Math.abs(el.scrollTop) > 1 || Math.abs(el.scrollLeft - (original.horizontal ? 0 : scrolls.get(el).x)) > 1)
        fail('panel-scrolled', 'Panel digulir saat screenshot. Jangan gulir sampai selesai.');
    }
    for (const [el, neighbors] of horizontalNeighbors) {
      const rect = el.getBoundingClientRect();
      for (const neighbor of neighbors) {
        const other = neighbor.el.getBoundingClientRect();
        const overlapX = Math.max(0, Math.min(rect.right, other.right) - Math.max(rect.left, other.left));
        const overlapY = Math.max(0, Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top));
        if (neighbor.el.isConnected === false || other.width < neighbor.width - 1 ||
            (overlapX > 1 && overlapY > 1 &&
             (overlapX > neighbor.overlapX + 1 || overlapY > neighbor.overlapY + 1)))
          fail('horizontal-layout-overlap', 'Panel horizontal menutupi atau mempersempit bagian halaman lain. Screenshot dibatalkan agar tidak terpotong.');
      }
    }
    for (const {doc, frame, win} of documents) {
      const size = metrics(doc); boundSize(size.width, size.height);
      if (frame && (size.height > win.innerHeight + 2 || size.width > win.innerWidth + 2))
        fail('frame-clipped', 'Isi frame tetap terpotong setelah diperluas. Tidak ada gambar sebagian yang disimpan.');
    }
  };
  state.check = () => {
    if (state.cleaned) return {ok: false, code: 'expired', error: 'Persiapan panel telah berakhir.'};
    try { enforce(); return {ok: true}; }
    catch (error) { return {ok: false, code: error.code || 'expansion-check', error: error.message}; }
  };
  state.timer = setTimeout(state.restore, 300000);
  try {
    visitDocument(document);
    // Custom-element style reactions can synchronously move the live walker's
    // current node and make it skip siblings. Observe before discovery and
    // reject structural changes before resizing; never silently miss a panel.
    if (observers.some(observer => observer.takeRecords().some(structuralMutation)))
      fail('content-changed', 'Isi halaman berubah saat memeriksa panel. Ulangi pada halaman yang stabil.');
    if (inaccessible.size) state.warnings.push(inaccessible.size +
      ' frame lintas-origin atau tidak dapat diakses: hanya area frame yang terlihat yang disertakan, bukan seluruh isi frame.');
    // Leaf-first expansion, followed by constrained ancestors and frame roots.
    // Repeating handles percentage/flex/grid sizing without an unbounded loop.
    for (let pass = 0; pass < limits.iterations; pass++) {
      assertBudget();
      let changed = false;
      for (const el of [...candidates].reverse()) {
        const c = css(el), borders = (parseFloat(c.borderTopWidth) || 0) + (parseFloat(c.borderBottomWidth) || 0);
        const wide = el.scrollWidth > el.clientWidth + 2;
        if (wide || el.scrollHeight > el.clientHeight + 2) {
          const borderX = (parseFloat(c.borderLeftWidth) || 0) + (parseFloat(c.borderRightWidth) || 0);
          changed = resize(el, el.scrollHeight + borders, false, wide ? el.scrollWidth + borderX : null) || changed;
        }
        for (let at = parentOf(el); at; at = parentOf(at)) {
          if (at === at.ownerDocument.documentElement || at === at.ownerDocument.scrollingElement) break;
          const ac = css(at);
          if (hiddenOrExcluded(at)) fail('clipped-ancestor', 'Panel berada dalam area tersembunyi yang tidak aman diperluas.');
          if (ac.position === 'fixed') normalizeFixed(at);
          const wideAncestor = at.scrollWidth > at.clientWidth + 2 &&
            /^(hidden|clip|auto|scroll|overlay)$/.test(ac.overflowX);
          const tallAncestor = at.scrollHeight > at.clientHeight + 2 &&
            (/^(hidden|clip|auto|scroll|overlay)$/.test(ac.overflowY) ||
             (ac.maxHeight && ac.maxHeight !== 'none') ||
             (at !== at.ownerDocument.body && at.style.getPropertyValue('height') &&
              at.style.getPropertyValue('height') !== 'auto'));
          if (wideAncestor || tallAncestor) {
            const border = (parseFloat(ac.borderTopWidth) || 0) + (parseFloat(ac.borderBottomWidth) || 0);
            const borderX = (parseFloat(ac.borderLeftWidth) || 0) + (parseFloat(ac.borderRightWidth) || 0);
            changed = resize(at, at.scrollHeight + border, false,
              wideAncestor ? at.scrollWidth + borderX : null) || changed;
          }
        }
      }
      for (const entry of [...documents].reverse()) {
        const size = metrics(entry.doc); boundSize(size.width, size.height);
        if (!entry.frame) continue;
        const c = css(entry.frame);
        const extra = (parseFloat(c.borderTopWidth) || 0) + (parseFloat(c.borderBottomWidth) || 0) +
          (parseFloat(c.paddingTop) || 0) + (parseFloat(c.paddingBottom) || 0);
        const wideFrame = size.width > entry.win.innerWidth + 2;
        const extraX = (parseFloat(c.borderLeftWidth) || 0) + (parseFloat(c.borderRightWidth) || 0) +
          (parseFloat(c.paddingLeft) || 0) + (parseFloat(c.paddingRight) || 0);
        if (wideFrame || size.height > entry.win.innerHeight + 2)
          changed = resize(entry.frame, size.height + extra, true, wideFrame ? size.width + extraX : null) || changed;
        // Frame element itself may be clipped by a constrained parent.
        if (expandedFrames.has(entry.frame)) candidates.add(entry.frame);
      }
      await settle(); assertBudget();
      if (mutationFailure) fail('content-changed', 'Isi panel berubah saat diperluas. Daftar dinamis belum dapat ditangkap penuh.');
      if (!changed) { finished = true; break; }
    }
    if (!finished) fail('unstable-layout', 'Tata letak panel terus berubah. Screenshot dibatalkan agar tidak terpotong.');
    enforce();
    return result();
  } catch (error) {
    const restored = state.restore();
    return result({ok: false, code: error.code || 'expansion-failed', error: error.message,
      restored: restored.restored, restorationErrors: restored.errors});
  }
}
