import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {expandScrollableContent} from '../extension/expand.js';

function fixture({width = 400, height = 300} = {}) {
  const timers = new Map(), listeners = new Map(), observers = [];
  let timerId = 0;
  const win = {
    scrollX: 0, scrollY: 0, innerWidth: width, innerHeight: height,
    location: {href: 'https://fixture.invalid/'},
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, {fn, ms}); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) { fn(); },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    scrollTo({left, top}) { win.scrollX = left; win.scrollY = top; },
    MutationObserver: class {
      constructor(fn) { this.fn = fn; this.disconnected = false; this.records = []; observers.push(this); }
      observe(root) { this.root = root; }
      takeRecords() { const records = this.records; this.records = []; return records; }
      disconnect() { this.disconnected = true; }
    }
  };
  const doc = {defaultView: win, querySelectorAll: () => [doc.documentElement, doc.body, ...doc.body.querySelectorAll('*')]};
  doc.createTreeWalker = root => {
    const stack = [{children: root === doc ? [doc.documentElement] : root.children, index: 0}];
    return {nextNode() {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.index >= top.children.length) { stack.pop(); continue; }
        const el = top.children[top.index++];
        if (el.children.length) stack.push({children: el.children, index: 0});
        return el;
      }
      return null;
    }};
  };
  const defaults = {position: 'static', overflowY: 'visible', display: 'block', visibility: 'visible', opacity: '1',
    contentVisibility: 'visible', boxSizing: 'border-box', contain: 'none', transform: 'none', perspective: 'none',
    filter: 'none', paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px',
    borderTopWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px', borderRightWidth: '0px', maxHeight: 'none'};
  const propName = key => key.replace(/[A-Z]/g, s => '-' + s.toLowerCase());
  win.getComputedStyle = el => new Proxy({}, {get: (_, key) => {
    const own = el.style.getPropertyValue(propName(key));
    if (own) return own;
    if (key === 'width') return el.width + 'px';
    if (key === 'height') return el.clientHeight + 'px';
    return el.computed[key] ?? defaults[key] ?? '';
  }});
  function element(config = {}) {
    const values = new Map(Object.entries(config.styles || {}).map(([prop, item]) =>
      [prop, typeof item === 'string' ? {value: item, priority: ''} : {...item}]));
    const el = {
      tagName: (config.tag || 'div').toUpperCase(), ownerDocument: doc, parentElement: null, children: [],
      computed: {...config.css}, width: config.width || width, initialHeight: config.height,
      content: config.content || 0, top: config.top || 0, left: config.left || 0, className: config.className || '',
      id: config.id || '', hidden: config.hidden || false, inert: false, isContentEditable: config.editable || false,
      isConnected: true, scrollTop: config.scrollTop || 0, scrollLeft: config.scrollLeft || 0,
      attrs: {...config.attrs}, style: {
        getPropertyValue: prop => values.get(prop)?.value || '',
        getPropertyPriority: prop => values.get(prop)?.priority || '',
        setProperty: (prop, value, priority) => values.set(prop, {value: String(value), priority}),
        removeProperty: prop => values.delete(prop), values
      },
      getAttribute(name) { return this.attrs[name] ?? null; },
      getRootNode() { return doc; },
      append(child) { this.children.push(child); child.parentElement = this; return child; },
      querySelectorAll() { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]); },
      contains(child) { for (let at = child; at; at = at.parentElement) if (at === this) return true; return false; },
      getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; },
      getBoundingClientRect() {
        const w = parseFloat(this.style.getPropertyValue('width')) || this.width;
        const h = this.clientHeight;
        const top = parseFloat(this.style.getPropertyValue('top')) || this.top;
        const left = parseFloat(this.style.getPropertyValue('left')) || this.left;
        return {width: w, height: h, top, left, right: left + w, bottom: top + h};
      },
      scrollTo({left, top}) { this.scrollLeft = left; this.scrollTop = Math.min(Math.max(0, top), Math.max(0, this.scrollHeight - this.clientHeight)); }
    };
    Object.defineProperties(el, {
      clientWidth: {get: () => parseFloat(el.style.getPropertyValue('width')) || el.width},
      offsetWidth: {get: () => el.clientWidth},
      clientHeight: {get: () => {
        if (config.root) return win.innerHeight;
        return parseFloat(el.style.getPropertyValue('height')) || el.initialHeight ||
          Math.max(el.content, el.children.reduce((sum, child) => sum + child.clientHeight, 0), 2);
      }},
      scrollWidth: {get: () => config.scrollWidth || el.clientWidth},
      scrollHeight: {get: () => Math.max(el.clientHeight, el.content, el.children.reduce((sum, child) => sum + child.clientHeight, 0))}
    });
    return el;
  }
  doc.documentElement = element({tag: 'html', root: true});
  doc.body = element({tag: 'body'});
  doc.documentElement.append(doc.body); doc.scrollingElement = doc.documentElement;
  const context = vm.createContext(win);
  context.document = doc;
  const run = options => vm.runInContext('(' + expandScrollableContent.toString() + ')(' + JSON.stringify(options || {}) + ')', context);
  const mutate = target => observers.forEach(observer => !observer.disconnected && observer.fn([{type: 'childList', target}]));
  return {win, doc, element, run, timers, listeners, observers, mutate, context};
}
const snapshot = el => JSON.stringify([...el.style.values]);
function pane(f, config = {}) {
  return f.doc.body.append(f.element({height: 200, content: 1000, css: {overflowY: 'auto'}, ...config}));
}

test('serialized function expands and restores nested panel styles, priorities and scroll positions', async () => {
  const f = fixture(), outer = pane(f, {height: 250, content: 400, scrollTop: 29,
    styles: {'height': {value: '250px', priority: 'important'}, 'overflow-y': 'auto'}});
  const inner = outer.append(f.element({height: 150, content: 1200, css: {overflowY: 'scroll'},
    styles: {'max-height': {value: '150px', priority: 'important'}}, scrollTop: 70, scrollLeft: 14}));
  const before = [snapshot(outer), snapshot(inner)];
  const result = await f.run();
  assert.equal(result.ok, true); assert.equal(result.expandedContainers, 2);
  assert.equal(inner.clientHeight, 1200); assert.equal(outer.clientHeight, 1200);
  assert.equal(inner.scrollTop, 0); assert.equal(inner.scrollLeft, 14);
  assert.equal(f.context.__gulirExpansion.check().ok, true);
  const restored = f.context.__gulirExpansion.restore();
  assert.equal(restored.restored, true);
  assert.deepEqual([snapshot(outer), snapshot(inner)], before);
  assert.equal(inner.scrollTop, 70); assert.equal(outer.scrollTop, 29);
  assert.equal(f.context.__gulirExpansion, undefined);
  assert.equal(f.listeners.size, 0); assert.equal(f.timers.size, 0);
});

test('hidden, off-canvas, editing and carousel structures are not expanded', async () => {
  const f = fixture();
  const excluded = [
    pane(f, {hidden: true}), pane(f, {left: -1000}),
    pane(f, {tag: 'textarea'}), pane(f, {tag: 'select'}), pane(f, {editable: true}),
    pane(f, {tag: 'dialog'}), pane(f, {attrs: {'role': 'dialog'}}),
    pane(f, {className: 'swiper-container'}), pane(f, {attrs: {'aria-hidden': 'true'}})
  ];
  const result = await f.run();
  assert.equal(result.ok, true); assert.equal(result.expandedContainers, 0);
  excluded.forEach(el => assert.equal(el.clientHeight, 200));
  f.context.__gulirExpansion.restore();
});

test('below-the-fold scroll panel is expanded', async () => {
  const f = fixture(); const el = pane(f, {top: 2000});
  assert.equal((await f.run()).ok, true);
  assert.equal(el.clientHeight, 1000); f.context.__gulirExpansion.restore();
});

test('body can be an independent scroll container inside a fixed viewport root', async () => {
  const f = fixture();
  f.doc.body.initialHeight = 300; f.doc.body.content = 1100; f.doc.body.computed.overflowY = 'auto';
  f.doc.documentElement.computed.overflowY = 'hidden';
  const result = await f.run();
  assert.equal(result.ok, true); assert.equal(f.doc.body.clientHeight, 1100);
  assert.equal(f.doc.documentElement.style.getPropertyValue('height'), '');
  f.context.__gulirExpansion.restore(); assert.equal(f.doc.body.clientHeight, 300);
});

test('same-origin iframe content expands and all frame positions are restored', async () => {
  const f = fixture(), child = fixture({height: 200});
  const frame = f.doc.body.append(f.element({tag: 'iframe', height: 200}));
  frame.contentDocument = child.doc;
  Object.defineProperty(child.win, 'innerHeight', {get: () => frame.clientHeight});
  child.win.scrollY = 17; child.doc.body.content = 900;
  const result = await f.run();
  assert.equal(result.ok, true); assert.equal(result.expandedFrames, 1);
  assert.equal(frame.clientHeight, 900); assert.equal(f.context.__gulirExpansion.check().ok, true);
  assert.equal(f.context.__gulirExpansion.restore().restored, true);
  assert.equal(frame.clientHeight, 200); assert.equal(child.win.scrollY, 17);
  assert.equal(child.listeners.size, 0);
});

test('cross-origin frame reports a visible-area-only warning without accessing its window', async () => {
  const f = fixture(); const frame = f.doc.body.append(f.element({tag: 'iframe', height: 200}));
  let attempted = 0; Object.defineProperty(frame, 'contentDocument', {get() { attempted++; return null; }});
  Object.defineProperty(frame, 'contentWindow', {get() { throw Error('must not bypass origin'); }});
  const result = await f.run();
  assert.equal(result.ok, true); assert.equal(result.inaccessibleFrames, 1);
  assert.match(result.warnings[0], /hanya area frame yang terlihat/); assert.equal(attempted, 1);
  f.context.__gulirExpansion.restore();
});

test('virtualized lists fail before resizing and clean up state', async () => {
  const f = fixture(), el = pane(f, {className: 'ReactVirtualized__Grid', scrollTop: 40});
  const original = snapshot(el), result = await f.run();
  assert.equal(result.ok, false); assert.equal(result.code, 'virtualized-content');
  assert.equal(result.restored, true); assert.equal(snapshot(el), original);
  assert.equal(el.scrollTop, 40); assert.equal(f.context.__gulirExpansion, undefined);
});

test('ARIA row count detects a partially materialized list', async () => {
  const f = fixture(), el = pane(f, {attrs: {'aria-rowcount': '1000'}});
  el.append(f.element({height: 30, attrs: {'role': 'row'}}));
  assert.equal((await f.run()).code, 'virtualized-content');
});

test('oversized content fails and restores changes made to another panel', async () => {
  const f = fixture(); pane(f, {content: 130000});
  const el = pane(f, {scrollTop: 47}), original = snapshot(el);
  const result = await f.run();
  assert.equal(result.ok, false); assert.equal(result.code, 'expansion-limit'); assert.equal(result.restored, true);
  assert.equal(snapshot(el), original); assert.equal(el.scrollTop, 47); assert.equal(el.clientHeight, 200);
});

test('DOM count and frame recursion have finite limits', async () => {
  const f = fixture(); pane(f);
  const result = await f.run({maxNodes: 2});
  assert.equal(result.ok, false); assert.equal(result.code, 'node-limit'); assert.equal(result.restored, true);
  const outer = fixture(), child = fixture(), grandchild = fixture();
  const frame = outer.doc.body.append(outer.element({tag: 'iframe', height: 300})); frame.contentDocument = child.doc;
  child.doc.body.append(Object.assign(child.element({tag: 'iframe', height: 300}), {contentDocument: grandchild.doc}));
  assert.equal((await outer.run({maxFrameDepth: 1})).code, 'frame-depth');
});

test('panel inspection does not consume the document element budget twice', async () => {
  const f = fixture(), outer = pane(f, {scrollTop: 17});
  const inner = outer.append(f.element({height: 100, content: 1000, css: {overflowY: 'auto'}, scrollTop: 23}));
  for (let i = 0; i < 4; i++) inner.append(f.element({height: 20}));
  const before = [snapshot(outer), snapshot(inner)];
  const count = f.doc.querySelectorAll('*').length;
  const result = await f.run({maxNodes: count});
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.expandedContainers, 2);
  assert.equal(f.context.__gulirExpansion.check().ok, true);
  assert.equal(f.context.__gulirExpansion.restore().restored, true);
  assert.deepEqual([snapshot(outer), snapshot(inner)], before);
  assert.equal(outer.scrollTop, 17); assert.equal(inner.scrollTop, 23);
  // Actual document complexity still fails, including after a prior success.
  const over = await f.run({maxNodes: count - 1});
  assert.equal(over.code, 'node-limit'); assert.equal(over.restored, true);
  assert.ok(over.error.includes('PANEL_NODES: ' + count + '/' + (count - 1)));
});

test('document element budget is shared across same-origin frames and shadow roots', async () => {
  const f = fixture(), child = fixture({height: 200});
  const frame = f.doc.body.append(f.element({tag: 'iframe', height: 200}));
  frame.contentDocument = child.doc;
  const host = child.doc.body.append(child.element({height: 200}));
  const inner = child.element({height: 100, content: 900, css: {overflowY: 'auto'}});
  const shadow = {host, children: [inner], querySelectorAll: () => [inner]};
  host.shadowRoot = shadow; inner.getRootNode = () => shadow;
  Object.defineProperty(child.win, 'innerHeight', {get: () => frame.clientHeight});
  const count = f.doc.querySelectorAll('*').length + child.doc.querySelectorAll('*').length + 1;
  const result = await f.run({maxNodes: count});
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.expandedContainers, 1);
  assert.equal(f.context.__gulirExpansion.restore().restored, true);
  assert.equal((await f.run({maxNodes: count - 1})).code, 'node-limit');
});

test('repeated nested panel inspections still have a separate finite work budget', async () => {
  const f = fixture();
  let parent = f.doc.body;
  for (let i = 0; i < 12; i++) {
    parent = parent.append(f.element({height: 200, content: 1000, css: {overflowY: 'auto'}}));
  }
  const result = await f.run({maxNodes: f.doc.querySelectorAll('*').length});
  assert.equal(result.ok, false); assert.equal(result.code, 'inspection-limit');
  assert.match(result.error, /PANEL_WORK: 57\/56/);
  assert.equal(result.restored, true); assert.equal(f.context.__gulirExpansion, undefined);
});

test('separate inspection budget still enforces preparation time and restores fixed panels', async () => {
  const f = fixture(), el = pane(f, {css: {position: 'fixed', overflowY: 'auto'}, scrollTop: 15});
  for (let i = 0; i < 110; i++) el.append(f.element({height: 2}));
  const before = snapshot(el);
  let ticks = 0;
  f.context.Date = {now: () => ++ticks * 100};
  const result = await f.run({maxPrepareMs: 150});
  assert.equal(result.ok, false); assert.equal(result.code, 'prepare-timeout');
  assert.equal(result.restored, true); assert.equal(snapshot(el), before);
  assert.equal(el.scrollTop, 15); assert.equal(f.context.__gulirExpansion, undefined);
});

test('post-expansion content, height, navigation and scroll changes fail validation', async () => {
  for (const mode of ['mutation', 'height', 'vertical-scroll', 'horizontal-scroll']) {
    const f = fixture(), el = pane(f);
    assert.equal((await f.run()).ok, true);
    if (mode === 'mutation') f.mutate(el);
    if (mode === 'height') el.content = 2000;
    if (mode === 'vertical-scroll') el.scrollTop = 1.1;
    if (mode === 'horizontal-scroll') el.scrollLeft = 2;
    assert.equal(f.context.__gulirExpansion.check().ok, false, mode);
    f.context.__gulirExpansion.restore();
  }
  const f = fixture(), child = fixture();
  const frame = f.doc.body.append(f.element({tag: 'iframe', height: 300})); frame.contentDocument = child.doc;
  assert.equal((await f.run()).ok, true); frame.contentDocument = fixture().doc;
  assert.equal(f.context.__gulirExpansion.check().code, 'frame-navigation');
  f.context.__gulirExpansion.restore();
});

test('pagehide and watchdog synchronously restore state, including child frame pagehide', async () => {
  for (const event of ['pagehide', 'watchdog', 'child-pagehide']) {
    const f = fixture(), el = pane(f, {scrollTop: 31}), original = snapshot(el);
    let child;
    if (event === 'child-pagehide') {
      child = fixture(); f.doc.body.append(Object.assign(f.element({tag: 'iframe', height: 300}), {contentDocument: child.doc}));
    }
    assert.equal((await f.run()).ok, true);
    const state = f.context.__gulirExpansion;
    if (event === 'watchdog') [...f.timers.values()].find(timer => timer.ms === 300000).fn();
    else if (child) child.listeners.get('pagehide')();
    else f.listeners.get('pagehide')();
    assert.equal(snapshot(el), original); assert.equal(el.scrollTop, 31);
    assert.equal(state.restore().restored, true); assert.equal(f.context.__gulirExpansion, undefined);
  }
});

test('duplicate preparation does not overwrite an existing restoration handle', async () => {
  const f = fixture(); pane(f);
  assert.equal((await f.run()).ok, true); const state = f.context.__gulirExpansion;
  assert.equal((await f.run()).code, 'already-expanding'); assert.equal(f.context.__gulirExpansion, state);
  state.restore();
});

test('horizontal overflow in an independent pane fails explicitly and preserves scroll', async () => {
  const f = fixture(), el = pane(f, {scrollWidth: 800, scrollLeft: 80});
  const original = snapshot(el), result = await f.run();
  assert.equal(result.ok, false); assert.equal(result.code, 'nested-horizontal-overflow');
  assert.equal(result.restored, true); assert.equal(el.scrollLeft, 80); assert.equal(snapshot(el), original);
});

test('fixed app shell is normalized reversibly and transformed fixed shells fail safely', async () => {
  const f = fixture(), shell = pane(f, {height: 300, content: 0, css: {position: 'fixed', overflowY: 'auto'}});
  const el = shell.append(f.element({height: 150, content: 1200, css: {overflowY: 'auto'}}));
  const original = snapshot(shell), result = await f.run();
  assert.equal(result.ok, true); assert.equal(shell.style.getPropertyValue('position'), 'absolute');
  assert.equal(el.clientHeight, 1200); f.context.__gulirExpansion.restore(); assert.equal(snapshot(shell), original);
  const transformed = fixture();
  pane(transformed, {css: {position: 'fixed', overflowY: 'auto', transform: 'matrix(1,0,0,1,10,0)'}});
  assert.equal((await transformed.run()).code, 'transformed-panel');
});

test('nested content scrolled above an outer panel is still discovered', async () => {
  const f = fixture(), outer = pane(f, {height: 300, content: 1500, scrollTop: 1000});
  const inner = outer.append(f.element({height: 150, content: 1200, top: -900, css: {overflowY: 'auto'}}));
  assert.equal((await f.run()).ok, true); assert.equal(inner.clientHeight, 1200);
  f.context.__gulirExpansion.restore(); assert.equal(outer.scrollTop, 1000);
});

test('text-only clock mutations are allowed but structural replacement is rejected', async () => {
  const f = fixture(), el = pane(f);
  assert.equal((await f.run()).ok, true);
  f.observers[0].fn([{type: 'childList', target: el, addedNodes: [{nodeType: 3}], removedNodes: [{nodeType: 3}]}]);
  assert.equal(f.context.__gulirExpansion.check().ok, true);
  f.observers[0].fn([{type: 'childList', target: el, addedNodes: [{nodeType: 1}], removedNodes: [{nodeType: 1}]}]);
  assert.equal(f.context.__gulirExpansion.check().code, 'content-changed');
  f.context.__gulirExpansion.restore();
});

test('open shadow-root panels get their own structural observer', async () => {
  const f = fixture(), host = f.doc.body.append(f.element({height: 300}));
  const inner = f.element({height: 150, content: 800, css: {overflowY: 'auto'}});
  const shadow = {host, children: [inner], querySelectorAll: () => [inner]}; host.shadowRoot = shadow; inner.getRootNode = () => shadow;
  assert.equal((await f.run()).ok, true); assert.equal(inner.clientHeight, 800);
  assert.equal(f.observers.length, 2);
  f.observers.find(observer => observer.root === shadow).fn([{type: 'childList', target: inner, addedNodes: [{nodeType: 1}], removedNodes: []}]);
  assert.equal(f.context.__gulirExpansion.check().ok, false);
  f.context.__gulirExpansion.restore(); assert.ok(f.observers.every(observer => observer.disconnected));
});

test('same-origin iframe height expansion also lifts its clipped ancestor', async () => {
  const f = fixture(), child = fixture({height: 200});
  const outer = f.doc.body.append(f.element({height: 200, css: {overflowY: 'hidden'}}));
  const frame = outer.append(f.element({tag: 'iframe', height: 200}));
  frame.contentDocument = child.doc; child.doc.body.content = 1000;
  Object.defineProperty(child.win, 'innerHeight', {get: () => frame.clientHeight});
  const result = await f.run();
  assert.equal(result.ok, true); assert.equal(frame.clientHeight, 1000); assert.equal(outer.clientHeight, 1000);
  f.context.__gulirExpansion.restore(); assert.equal(outer.clientHeight, 200); assert.equal(frame.clientHeight, 200);
});

test('discovery and virtual inspection stream without whole-subtree queries', async () => {
  const f = fixture(), el = pane(f, {scrollTop: 19});
  for (let i = 0; i < 5; i++) el.append(f.element({height: 20}));
  const elements = f.doc.querySelectorAll('*');
  const count = elements.length;
  f.doc.querySelectorAll = () => { throw Error('eager document query'); };
  for (const at of elements) at.querySelectorAll = () => { throw Error('eager subtree query'); };
  const result = await f.run({maxNodes: count});
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(f.context.__gulirExpansion.restore().restored, true);
  assert.equal(el.scrollTop, 19);
});

test('streaming stops at the node boundary instead of consuming the entire tree', async () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) f.doc.body.append(f.element({height: 2, hidden: true}));
  const create = f.doc.createTreeWalker;
  let visits = 0;
  f.doc.createTreeWalker = root => {
    const walker = create(root);
    return {nextNode() { visits++; return walker.nextNode(); }};
  };
  const result = await f.run({maxNodes: 10});
  assert.equal(result.code, 'node-limit'); assert.equal(result.restored, true);
  assert.equal(visits, 11);
});

test('larger node budget remains clamped even when a caller requests an unbounded scan', async () => {
  const f = fixture();
  let visits = 0;
  // A lazy flat tree supplies fresh zero-sized elements without allocating a
  // 100,001-element fixture before the guard can be exercised.
  f.doc.createTreeWalker = () => ({nextNode() {
    visits++;
    return {tagName: 'SPAN', scrollTop: 0, scrollLeft: 0,
      scrollWidth: 0, clientWidth: 0, scrollHeight: 0, clientHeight: 0};
  }});
  const result = await f.run({maxNodes: 1000000000});
  assert.equal(result.code, 'node-limit'); assert.equal(result.restored, true);
  assert.match(result.error, /PANEL_NODES: 100001\/100000/);
  assert.equal(visits, 100001);
});

test('non-scrolling wrappers do not hide an overflowing descendant', async () => {
  const f = fixture();
  const wrapper = f.doc.body.append(f.element({height: 200}));
  const el = wrapper.append(f.element({height: 100, content: 900, css: {overflowY: 'auto'}, scrollTop: 31}));
  const result = await f.run();
  assert.equal(result.ok, true); assert.equal(el.clientHeight, 900);
  assert.equal(f.context.__gulirExpansion.restore().restored, true);
  assert.equal(el.clientHeight, 100); assert.equal(el.scrollTop, 31);
});

test('synchronous discovery mutation aborts before resizing and restores owned styles', async () => {
  const f = fixture(), el = pane(f, {css: {position: 'fixed', overflowY: 'auto'}, scrollTop: 17});
  const before = snapshot(el), set = el.style.setProperty;
  let added;
  el.style.setProperty = (prop, value, priority) => {
    set(prop, value, priority);
    if (prop === 'position' && value === 'absolute' && !added) {
      added = f.doc.body.append(f.element({height: 2}));
      for (const observer of f.observers) observer.records.push({
        type: 'childList', target: f.doc.body, addedNodes: [{nodeType: 1}], removedNodes: []
      });
    }
  };
  const result = await f.run();
  assert.equal(result.code, 'content-changed'); assert.equal(result.expandedContainers, 0);
  assert.equal(result.restored, true); assert.equal(snapshot(el), before);
  assert.equal(el.scrollTop, 17); assert.ok(f.doc.body.children.includes(added));
});

test('text-only discovery mutations do not abort a stable panel', async () => {
  const f = fixture(), el = pane(f, {css: {position: 'fixed', overflowY: 'auto'}});
  const set = el.style.setProperty;
  el.style.setProperty = (prop, value, priority) => {
    set(prop, value, priority);
    for (const observer of f.observers) observer.records.push({
      type: 'childList', target: el, addedNodes: [{nodeType: 3}], removedNodes: [{nodeType: 3}]
    });
  };
  assert.equal((await f.run()).ok, true);
  assert.equal(f.context.__gulirExpansion.restore().restored, true);
});
