import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encodePng } from '../extension/png.js';

function referenceCrc(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function decode(blob) {
  assert.equal(blob.type, 'image/png');
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    assert.equal(data.length, size, 'complete chunk data');
    assert.equal(bytes.readUInt32BE(offset + 8 + size),
      referenceCrc(bytes.subarray(offset + 4, offset + 8 + size)), type + ' CRC');
    chunks.push({ type, data });
    offset += size + 12;
  }
  assert.equal(offset, bytes.length);
  assert.equal(chunks[0].type, 'IHDR');
  assert.equal(chunks[0].data.length, 13);
  assert.equal(chunks.at(-1).type, 'IEND');
  assert.equal(chunks.at(-1).data.length, 0);
  assert.ok(chunks.slice(1, -1).every(chunk => chunk.type === 'IDAT'));
  assert.ok(chunks.slice(1, -1).every(chunk => chunk.data.length <= 64 * 1024));
  const header = chunks[0].data;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  assert.deepEqual([...header.subarray(8)], [8, 6, 0, 0, 0]);
  const raw = inflateSync(Buffer.concat(chunks.slice(1, -1).map(chunk => chunk.data)));
  assert.equal(raw.length, height * (width * 4 + 1));
  const rgba = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    const start = row * (width * 4 + 1);
    assert.equal(raw[start], 0, 'filter None for row ' + row);
    raw.copy(rgba, row * width * 4, start + 1, start + 1 + width * 4);
  }
  return { width, height, rgba, chunks };
}

function strip(width, height, value = 0) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(value) };
}

function options(overrides = {}) {
  return { width: 1, height: 1, strips: [strip(1, 1)], ...overrides };
}

test('one lossless RGBA image preserves strips, alpha, cropping, and typed-array offsets', async () => {
  const backing = new Uint8Array(64).fill(99);
  const first = { width: 2, height: 2, data: backing.subarray(8, 24), top: 1 };
  first.data.set([1, 2, 3, 4, 5, 6, 7, 8, 10, 20, 30, 0, 40, 50, 60, 255]);
  const second = strip(2, 3);
  second.data.set([70, 80, 90, 127, 100, 110, 120, 1], 8);
  second.top = 1;
  second.rows = 1;
  const last = { width: 2, height: 1, data: new Uint8Array([0, 255, 0, 55, 255, 0, 255, 0]) };
  async function* source() { yield first; yield second; yield last; }
  const result = await decode(await encodePng({ width: 2, height: 3, strips: source() }));
  assert.equal(result.width, 2);
  assert.equal(result.height, 3);
  assert.deepEqual([...result.rgba], [
    10, 20, 30, 0, 40, 50, 60, 255,
    70, 80, 90, 127, 100, 110, 120, 1,
    0, 255, 0, 55, 255, 0, 255, 0,
  ]);
});

test('single PNG exceeds 32K and 64K canvas heights using reused narrow viewport strips', async () => {
  const height = 70001;
  const shared = new Uint8Array(113 * 4);
  let yielded = 0;
  async function* source() {
    for (let start = 0; start < height; start += 113) {
      const rows = Math.min(113, height - start);
      for (let y = 0; y < rows; y++) {
        const row = start + y;
        shared.set([row & 255, (row >>> 8) & 255, (row >>> 16) & 255, 255], y * 4);
      }
      yielded++;
      yield { width: 1, height: rows, data: shared.subarray(0, rows * 4) };
    }
  }
  const result = await decode(await encodePng({ width: 1, height, strips: source() }));
  assert.equal(result.height, height);
  assert.equal(yielded, Math.ceil(height / 113));
  for (const row of [0, 112, 113, 32767, 32768, 65535, 65536, 70000]) {
    assert.deepEqual([...result.rgba.subarray(row * 4, row * 4 + 4)],
      [row & 255, (row >>> 8) & 255, (row >>> 16) & 255, 255]);
  }
});

test('incompressible data crosses bounded IDAT chunks in one zlib stream', async () => {
  const input = strip(256, 256);
  let seed = 0x12345678;
  for (let i = 0; i < input.data.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    input.data[i] = seed & 255;
  }
  const result = await decode(await encodePng({ width: 256, height: 256, strips: [input] }));
  assert.ok(result.chunks.filter(chunk => chunk.type === 'IDAT').length > 1);
  assert.deepEqual(result.rgba, Buffer.from(input.data));
});

test('maximum supported width and height boundaries remain valid', async () => {
  const wide = await decode(await encodePng({ width: 16000, height: 1, strips: [strip(16000, 1, 9)] }));
  assert.equal(wide.width, 16000);
  async function* source() { for (let y = 0; y < 120000; y += 1000) yield strip(1, 1000, 7); }
  const tall = await decode(await encodePng({ width: 1, height: 120000, strips: source() }));
  assert.equal(tall.height, 120000);
});

test('dimensions and resource budgets are checked before consuming strips', async () => {
  let reads = 0;
  const source = { *[Symbol.iterator]() { reads++; yield strip(1, 1); } };
  for (const dimensions of [
    { width: 0 }, { width: -1 }, { width: 1.5 }, { width: NaN },
    { width: Infinity }, { width: 16001 }, { height: 0 }, { height: -1 },
    { height: 1.1 }, { height: 120001 }, { height: Number.MAX_SAFE_INTEGER + 1 },
    { width: 16000, height: 7501 }, { width: 2, height: 2, maxPixels: 3 },
    { maxPixels: 0 }, { maxOutputBytes: 0 }, { maxOutputBytes: 44 },
    { maxOutputBytes: 3.5 }, { maxPixels: Infinity },
  ]) {
    await assert.rejects(encodePng(options({ strips: source, ...dimensions })), RangeError);
  }
  assert.equal(reads, 0);
  await assert.rejects(encodePng(options({ strips: null })), TypeError);
  await assert.rejects(encodePng(options({ strips: {} })), TypeError);
});

test('empty, truncated, excess, and malformed strips reject instead of returning partial PNG', async () => {
  for (const strips of [[], [strip(1, 1)], [strip(1, 3)], [strip(1, 2), strip(1, 1)]]) {
    if (strips.length === 1 && strips[0].height === 1) {
      await assert.rejects(encodePng(options({ height: 2, strips })), /fewer rows/);
    } else {
      await assert.rejects(encodePng(options({ height: 2, strips })), /rows/);
    }
  }
  for (const input of [
    null, strip(2, 1), { ...strip(1, 1), height: 0 },
    { ...strip(1, 1), height: 1.5 }, { ...strip(1, 1), data: [0, 0, 0, 0] },
    { ...strip(1, 1), data: new Uint16Array(2) },
    { ...strip(1, 1), data: new Uint8Array(3) },
    { ...strip(1, 1), data: new Uint8Array(5) },
    { ...strip(1, 1), top: -1 }, { ...strip(1, 1), top: 1 },
    { ...strip(1, 1), top: 0.5 }, { ...strip(1, 1), rows: 0 },
    { ...strip(1, 1), rows: 2 }, { ...strip(1, 1), rows: 0.5 },
  ]) {
    await assert.rejects(encodePng(options({ strips: [input] })), /strip|Strip|RGBA/);
  }
});

test('compressed payload and PNG chunk overhead count toward output budget', async () => {
  const blob = await encodePng(options());
  assert.equal((await encodePng(options({ maxOutputBytes: blob.size }))).size, blob.size);
  await assert.rejects(encodePng(options({ maxOutputBytes: blob.size - 1 })), /output byte budget/);
  const input = strip(128, 128);
  for (let i = 0; i < input.data.length; i++) input.data[i] = (i * 91 + (i >>> 4)) & 255;
  await assert.rejects(encodePng({ width: 128, height: 128, strips: [input], maxOutputBytes: 100 }), /output byte budget/);
});

test('source errors propagate and invalid source cleanup runs once', async () => {
  const expected = new Error('capture failed');
  async function* source() { yield strip(1, 1); throw expected; }
  await assert.rejects(encodePng(options({ height: 2, strips: source() })), error => error === expected);
  let closed = 0;
  async function* invalid() { try { yield strip(2, 1); } finally { closed++; } }
  await assert.rejects(encodePng(options({ strips: invalid() })), /width/);
  assert.equal(closed, 1);
});

test('already cancelled signal consumes no source rows', async () => {
  const controller = new AbortController();
  controller.abort();
  let reads = 0;
  async function* source() { reads++; yield strip(1, 1); }
  await assert.rejects(encodePng(options({ strips: source(), signal: controller.signal })), { name: 'AbortError' });
  assert.equal(reads, 0);
});

test('cancellation during strips closes source and preserves abort reason', async () => {
  const controller = new AbortController();
  const reason = new Error('capture cancelled');
  let closed = 0;
  async function* source() {
    try {
      yield strip(1, 1);
      controller.abort(reason);
      yield strip(1, 1);
    } finally { closed++; }
  }
  await assert.rejects(encodePng(options({ height: 2, strips: source(), signal: controller.signal })),
    error => error === reason);
  assert.equal(closed, 1);
});

test('cancellation interrupts a pending async iterator without hanging', async () => {
  const controller = new AbortController();
  let pendingStarted;
  const started = new Promise(resolve => { pendingStarted = resolve; });
  let returned = 0;
  const strips = {
    [Symbol.asyncIterator]() { return this; },
    next() { pendingStarted(); return new Promise(() => {}); },
    return() { returned++; return Promise.resolve({ done: true }); },
  };
  const encoding = encodePng(options({ strips, signal: controller.signal }));
  await started;
  controller.abort();
  let timer;
  try {
    await Promise.race([
      assert.rejects(encoding, { name: 'AbortError' }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Abort hung')), 2000); }),
    ]);
  } finally { clearTimeout(timer); }
  assert.equal(returned, 1);
});
