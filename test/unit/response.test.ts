import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import test from 'node:test';
import { Response } from '../../src/core/http/Response.js';

function createResponse(): {
  res: Response;
  status: () => number;
  body: () => string | undefined;
  header: (name: string) => string | string[] | undefined;
  sent: () => boolean;
} {
  let statusCode = 200;
  let endData: string | undefined;
  let ended = false;
  const headers: Record<string, string | string[]> = {};

  const raw = {
    get statusCode() { return statusCode; },
    set statusCode(v: number) { statusCode = v; },
    setHeader(name: string, value: string | string[]) { headers[name.toLowerCase()] = value; },
    getHeader(name: string): string | number | string[] | undefined { return headers[name.toLowerCase()]; },
    removeHeader(name: string) { delete headers[name.toLowerCase()]; },
    end(data?: unknown) { endData = typeof data === 'string' ? data : undefined; ended = true; },
    get headersSent() { return ended; },
  } as unknown as ServerResponse;

  return {
    res: new Response(raw),
    status: () => statusCode,
    body: () => endData,
    header: (name) => headers[name.toLowerCase()],
    sent: () => ended,
  };
}

test('status() sets statusCode', () => {
  const { res, status } = createResponse();
  res.status(404);
  assert.equal(status(), 404);
});

test('status() is chainable', () => {
  const { res } = createResponse();
  assert.equal(res.status(201), res);
});

test('header() sets response header', () => {
  const { res, header } = createResponse();
  res.header('X-Custom', 'value');
  assert.equal(header('x-custom'), 'value');
});

test('header() is chainable', () => {
  const { res } = createResponse();
  assert.equal(res.header('X-A', '1'), res);
});

test('json() sets Content-Type application/json', () => {
  const { res, header } = createResponse();
  res.json({ ok: true });
  assert.ok((header('content-type') as string).includes('application/json'));
});

test('json() serializes data and ends response', () => {
  const { res, body, sent } = createResponse();
  res.json({ value: 42 });
  assert.equal(body(), JSON.stringify({ value: 42 }));
  assert.ok(sent());
});

test('send() sets Content-Type text/plain', () => {
  const { res, header } = createResponse();
  res.send('hello');
  assert.ok((header('content-type') as string).includes('text/plain'));
});

test('send() ends response with text body', () => {
  const { res, body } = createResponse();
  res.send('hello world');
  assert.equal(body(), 'hello world');
});

test('redirect() defaults to 302', () => {
  const { res, status, header } = createResponse();
  res.redirect('/new-path');
  assert.equal(status(), 302);
  assert.equal(header('location'), '/new-path');
});

test('redirect() uses provided status code', () => {
  const { res, status } = createResponse();
  res.redirect('/new-path', 301);
  assert.equal(status(), 301);
});

test('redirect() ignores previously set status and uses 302 by default', () => {
  const { res, status } = createResponse();
  res.status(308).redirect('/new-path');
  assert.equal(status(), 302);
});

test('redirect() code argument overrides status()', () => {
  const { res, status } = createResponse();
  res.status(308).redirect('/new-path', 301);
  assert.equal(status(), 301);
});

test('sent returns false before response ends', () => {
  const { res, sent } = createResponse();
  assert.equal(sent(), false);
  assert.equal(res.sent, false);
});

test('sent returns true after json()', () => {
  const { res } = createResponse();
  res.json({});
  assert.ok(res.sent);
});
