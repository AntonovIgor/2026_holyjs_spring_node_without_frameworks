import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import test from 'node:test';
import { Request } from '../../src/core/http/Request.js';
import type { Response } from '../../src/core/http/Response.js';
import {
  CookieMiddleware,
  getCookies,
} from '../../src/core/middleware/built-in/CookieMiddleware.js';

function createRequest(cookieHeader?: string): Request {
  return new Request({
    url: '/',
    method: 'GET',
    headers: {
      host: 'localhost',
      ...(cookieHeader !== undefined ? { cookie: cookieHeader } : {}),
    },
  } as IncomingMessage);
}

async function runMiddleware(req: Request): Promise<void> {
  await new CookieMiddleware().handle(req, {} as Response, async () => {});
}

test('CookieMiddleware parses a single cookie', async () => {
  const req = createRequest('session=abc123');
  await runMiddleware(req);
  assert.deepEqual(getCookies(req), { session: 'abc123' });
});

test('CookieMiddleware parses multiple cookies', async () => {
  const req = createRequest('a=1; b=2; c=3');
  await runMiddleware(req);
  assert.deepEqual(getCookies(req), { a: '1', b: '2', c: '3' });
});

test('CookieMiddleware handles value containing "="', async () => {
  const req = createRequest('token=abc=def==');
  await runMiddleware(req);
  assert.deepEqual(getCookies(req), { token: 'abc=def==' });
});

test('CookieMiddleware decodes URL-encoded values', async () => {
  const req = createRequest('name=hello%20world');
  await runMiddleware(req);
  assert.deepEqual(getCookies(req), { name: 'hello world' });
});

test('CookieMiddleware falls back to raw value on invalid URL-encoding', async () => {
  const req = createRequest('bad=%GG');
  await runMiddleware(req);
  assert.deepEqual(getCookies(req), { bad: '%GG' });
});

test('CookieMiddleware returns empty object for empty header', async () => {
  const req = createRequest('');
  await runMiddleware(req);
  assert.deepEqual(getCookies(req), {});
});

test('CookieMiddleware returns empty object when Cookie header is absent', async () => {
  const req = createRequest(undefined);
  await runMiddleware(req);
  assert.deepEqual(getCookies(req), {});
});

test('CookieMiddleware trims whitespace around name and value', async () => {
  const req = createRequest('  name  =  value  ');
  await runMiddleware(req);
  assert.deepEqual(getCookies(req), { name: 'value' });
});

test('getCookies returns empty object when CookieMiddleware was not used', () => {
  const req = createRequest('session=abc');
  assert.deepEqual(getCookies(req), {});
});
