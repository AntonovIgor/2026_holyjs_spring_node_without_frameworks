import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import test from 'node:test';
import { Request } from '../../src/core/http/Request.js';
import { Response } from '../../src/core/http/Response.js';
import { StaticFilesMiddleware } from '../../src/core/middleware/built-in/StaticFilesMiddleware.js';
import { resolveStaticFilePath } from '../../src/core/utils/fs.js';

// ─── resolveStaticFilePath unit tests ───────────────────────────────────────

test('resolveStaticFilePath keeps requests inside static root', () => {
  const root = resolve('/var/www');

  assert.equal(
    resolveStaticFilePath(root, '/assets/app.js'),
    resolve(root, 'assets/app.js'),
  );
  assert.equal(
    resolveStaticFilePath(root, '/'),
    resolve(root, 'index.html'),
  );
});

test('resolveStaticFilePath rejects path traversal outside static root', () => {
  const root = resolve('/var/www');

  assert.equal(resolveStaticFilePath(root, '../www2/secret.txt'), null);
  assert.equal(resolveStaticFilePath(root, '/../www2/secret.txt'), null);
  assert.equal(resolveStaticFilePath(root, '../../etc/passwd'), null);
});

// ─── StaticFilesMiddleware tests ─────────────────────────────────────────────

class WritableCapture extends Writable {
  statusCode = 200;
  readonly responseHeaders: Record<string, string | string[]> = {};
  readonly chunks: Buffer[] = [];
  headersSent = false;

  setHeader(name: string, value: string | string[]): this {
    this.responseHeaders[name.toLowerCase()] = value;
    return this;
  }

  getHeader(name: string): string | number | string[] | undefined {
    return this.responseHeaders[name.toLowerCase()];
  }

  removeHeader(name: string): void {
    delete this.responseHeaders[name.toLowerCase()];
  }

  override _write(chunk: Buffer, _enc: BufferEncoding, cb: () => void): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    cb();
  }

  get body(): string {
    return Buffer.concat(this.chunks).toString();
  }
}

function createContext(urlPath: string, reqHeaders: Record<string, string> = {}): {
  req: Request;
  res: Response;
  capture: WritableCapture;
} {
  const req = new Request({
    url: urlPath,
    method: 'GET',
    headers: { host: 'localhost', ...reqHeaders },
  } as IncomingMessage);

  const capture = new WritableCapture();
  const res = new Response(capture as unknown as ServerResponse);
  return { req, res, capture };
}

test('StaticFilesMiddleware calls next() for paths outside prefix', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'sfm-'));
  try {
    const mw = new StaticFilesMiddleware(tmpDir, '/static');
    const { req, res } = createContext('/api/data');
    let nextCalled = false;
    await mw.handle(req, res, async () => { nextCalled = true; });
    assert.ok(nextCalled);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('StaticFilesMiddleware calls next() when file does not exist', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'sfm-'));
  try {
    const mw = new StaticFilesMiddleware(tmpDir, '/static');
    const { req, res } = createContext('/static/missing.txt');
    let nextCalled = false;
    await mw.handle(req, res, async () => { nextCalled = true; });
    assert.ok(nextCalled);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('StaticFilesMiddleware calls next() for path traversal attempts', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'sfm-'));
  try {
    const mw = new StaticFilesMiddleware(tmpDir, '/static');
    const { req, res } = createContext('/static/../../../etc/passwd');
    let nextCalled = false;
    await mw.handle(req, res, async () => { nextCalled = true; });
    assert.ok(nextCalled);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('StaticFilesMiddleware serves a file with correct Content-Type', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'sfm-'));
  try {
    await writeFile(join(tmpDir, 'app.js'), 'console.log("hello")');
    const mw = new StaticFilesMiddleware(tmpDir, '/static');
    const { req, res, capture } = createContext('/static/app.js');
    await mw.handle(req, res, async () => {});

    assert.equal(capture.statusCode, 200);
    assert.ok(
      (capture.responseHeaders['content-type'] as string).includes('application/javascript'),
    );
    assert.equal(capture.body, 'console.log("hello")');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('StaticFilesMiddleware sets ETag header', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'sfm-'));
  try {
    await writeFile(join(tmpDir, 'data.json'), '{}');
    const mw = new StaticFilesMiddleware(tmpDir, '/static');
    const { req, res, capture } = createContext('/static/data.json');
    await mw.handle(req, res, async () => {});

    assert.ok(typeof capture.responseHeaders['etag'] === 'string');
    assert.ok((capture.responseHeaders['etag'] as string).startsWith('"'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('StaticFilesMiddleware returns 304 when ETag matches', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'sfm-'));
  try {
    await writeFile(join(tmpDir, 'data.json'), '{}');
    const mw = new StaticFilesMiddleware(tmpDir, '/static');

    // First request to get ETag
    const { req: req1, res: res1, capture: cap1 } = createContext('/static/data.json');
    await mw.handle(req1, res1, async () => {});
    const etag = cap1.responseHeaders['etag'] as string;

    // Second request with matching If-None-Match
    const { req: req2, res: res2, capture: cap2 } = createContext('/static/data.json', {
      'if-none-match': etag,
    });
    let nextCalled = false;
    await mw.handle(req2, res2, async () => { nextCalled = true; });

    assert.equal(cap2.statusCode, 304);
    assert.equal(nextCalled, false);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('StaticFilesMiddleware serves HTML with correct MIME type', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'sfm-'));
  try {
    await writeFile(join(tmpDir, 'index.html'), '<html></html>');
    const mw = new StaticFilesMiddleware(tmpDir, '/static');
    const { req, res, capture } = createContext('/static/index.html');
    await mw.handle(req, res, async () => {});

    assert.ok((capture.responseHeaders['content-type'] as string).includes('text/html'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
