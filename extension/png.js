// Stream viewport-sized RGBA strips into one PNG without a full-page canvas.
const MAX_WIDTH = 16000;
const MAX_HEIGHT = 120000;
const MAX_PIXELS = 120000000;
const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
const CHUNK_BYTES = 64 * 1024;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function positiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${name} must be a positive integer no greater than ${maximum}.`);
  }
  return value;
}

function crc32(bytes, crc = 0xffffffff) {
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return crc >>> 0;
}

function chunk(type, data) {
  const header = new Uint8Array(8);
  const trailer = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, data.byteLength);
  for (let index = 0; index < 4; index++) header[index + 4] = type.charCodeAt(index);
  const crc = crc32(data, crc32(header.subarray(4))) ^ 0xffffffff;
  new DataView(trailer.buffer).setUint32(0, crc >>> 0);
  // Blob snapshots just this compressed chunk; the final Blob can reuse its storage.
  return new Blob([header, data, trailer]);
}

function stripRows(strip, width) {
  if (!strip || strip.width !== width) throw new RangeError('Every RGBA strip must have the PNG width.');
  positiveInteger(strip.height, 'Strip height', MAX_HEIGHT);
  if (!(strip.data instanceof Uint8Array) && !(strip.data instanceof Uint8ClampedArray)) {
    throw new TypeError('Strip data must be Uint8Array or Uint8ClampedArray RGBA pixels.');
  }
  if (strip.data.byteLength !== width * strip.height * 4) {
    throw new RangeError('RGBA strip byte length does not match its dimensions.');
  }
  const top = strip.top ?? 0;
  const rows = strip.rows ?? (strip.height - top);
  if (!Number.isSafeInteger(top) || top < 0 || top >= strip.height) {
    throw new RangeError('Strip top must select a row inside the strip.');
  }
  positiveInteger(rows, 'Strip rows', strip.height - top);
  return { data: strip.data, top, rows };
}

/**
 * Encode one lossless RGBA PNG, including heights beyond browser canvas limits.
 *
 * strips is an (async) iterable of { width, height, data, top?, rows? }.
 * data contains tightly packed 8-bit RGBA pixels. Optional top/rows crop only
 * vertically. Selected strip rows must sum to height exactly. The source may
 * release/reuse its pixels after the encoder requests the following strip.
 *
 * Working memory is one source strip plus <=64 KiB scanline/IDAT chunks and the
 * compressed Blob (capped by maxOutputBytes); no full-height RGBA buffer exists.
 * AbortSignal cancellation also interrupts a pending iterator.next().
 */
export async function encodePng({
  width,
  height,
  strips,
  signal,
  maxPixels = MAX_PIXELS,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
} = {}) {
  positiveInteger(width, 'PNG width', MAX_WIDTH);
  positiveInteger(height, 'PNG height', MAX_HEIGHT);
  positiveInteger(maxPixels, 'Pixel budget');
  positiveInteger(maxOutputBytes, 'Output byte budget');
  if (width * height > Math.min(maxPixels, MAX_PIXELS)) {
    throw new RangeError('PNG exceeds the safe pixel budget.');
  }
  // Signature + IHDR + IEND; all IDAT payloads and their overhead count below.
  let outputBytes = 45;
  if (outputBytes > maxOutputBytes) throw new RangeError('PNG exceeds the output byte budget.');
  if (!strips || (!strips[Symbol.asyncIterator] && !strips[Symbol.iterator])) {
    throw new TypeError('RGBA strips must be an iterable or async iterable.');
  }
  if (signal?.aborted) throw signal.reason ?? new DOMException('PNG encoding aborted.', 'AbortError');
  if (typeof CompressionStream !== 'function') {
    throw new Error('This browser does not support streaming PNG compression.');
  }

  const iterator = strips[Symbol.asyncIterator]?.() ?? strips[Symbol.iterator]();
  const compressor = new CompressionStream('deflate');
  const writer = compressor.writable.getWriter();
  const reader = compressor.readable.getReader();
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8; // 8-bit channels.
  header[9] = 6; // Truecolour with alpha; no interlacing.
  const parts = [PNG_SIGNATURE, chunk('IHDR', header)];
  let failure;
  let failed = false;
  let rejectStopped;
  const stopped = new Promise((_, reject) => { rejectStopped = reject; });
  // A synchronous abort can precede the first race below.
  stopped.catch(() => {});
  const checked = promise => Promise.race([promise, stopped]);
  const stop = reason => {
    if (failed) return;
    failed = true;
    failure = reason;
    rejectStopped(reason);
    // Cancellation must not wait for a source blocked in a pending next().
    try { Promise.resolve(iterator.return?.()).catch(() => {}); } catch {}
    writer.abort(reason).catch(() => {});
    reader.cancel(reason).catch(() => {});
  };
  const onAbort = () => stop(signal.reason ?? new DOMException('PNG encoding aborted.', 'AbortError'));
  signal?.addEventListener('abort', onAbort, { once: true });

  const produce = async () => {
    const rowBytes = width * 4;
    const rowsPerChunk = Math.max(1, Math.floor(CHUNK_BYTES / (rowBytes + 1)));
    let writtenRows = 0;
    while (true) {
      if (failed) throw failure;
      const next = await checked(iterator.next());
      if (failed) throw failure;
      if (next.done) break;
      const { data, top, rows } = stripRows(next.value, width);
      if (writtenRows + rows > height) throw new RangeError('RGBA strips contain more rows than the PNG height.');
      for (let offset = 0; offset < rows; offset += rowsPerChunk) {
        const count = Math.min(rowsPerChunk, rows - offset);
        const scanlines = new Uint8Array(count * (rowBytes + 1));
        for (let row = 0; row < count; row++) {
          const sourceOffset = (top + offset + row) * rowBytes;
          // Every scanline begins with PNG filter 0 (None).
          scanlines.set(data.subarray(sourceOffset, sourceOffset + rowBytes), row * (rowBytes + 1) + 1);
        }
        await checked(writer.write(scanlines));
        if (failed) throw failure;
      }
      writtenRows += rows;
    }
    if (writtenRows !== height) throw new RangeError('RGBA strips contain fewer rows than the PNG height.');
    await checked(writer.close());
  };
  const consume = async () => {
    while (true) {
      const { done, value } = await checked(reader.read());
      if (failed) throw failure;
      if (done) return;
      for (let offset = 0; offset < value.byteLength; offset += CHUNK_BYTES) {
        const data = value.subarray(offset, Math.min(offset + CHUNK_BYTES, value.byteLength));
        outputBytes += data.byteLength + 12;
        if (outputBytes > maxOutputBytes) throw new RangeError('PNG exceeds the output byte budget.');
        parts.push(chunk('IDAT', data));
      }
    }
  };
  const guarded = work => work().catch(error => { stop(error); throw error; });
  const producer = guarded(produce);
  const consumer = guarded(consume);
  try {
    await Promise.all([producer, consumer]);
    if (failed) throw failure;
    parts.push(chunk('IEND', new Uint8Array(0)));
    return new Blob(parts, { type: 'image/png' });
  } catch (error) {
    stop(error);
    parts.length = 0;
    await Promise.allSettled([producer, consumer]);
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    writer.releaseLock();
    reader.releaseLock();
  }
}
