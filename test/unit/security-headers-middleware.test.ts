import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { Request } from '../../src/core/http/Request.js';
import { Response } from '../../src/core/http/Response.js';
import { SecurityHeadersMiddleware } from '../../src/core/middleware/built-in/SecurityHeadersMiddleware.js';

function createContext(): { req: Request; res: Response; resHeaders: Record<string, string> } {
  const req = new Request({
    url: '/',
    method: 'GET',
    headers: { host: 'localhost' },
  } as IncomingMessage);

  const resHeaders: Record<string, string> = {};
  const raw = {
    statusCode: 200,
    setHeader(name: string, value: string) { resHeaders[name.toLowerCase()] = value; },
    getHeader(name: string) { return resHeaders[name.toLowerCase()]; },
    removeHeader(name: string) { delete resHeaders[name.toLowerCase()]; },
    end() {},
    headersSent: false,
  } as unknown as ServerResponse;

  return { req, res: new Response(raw), resHeaders };
}

const middleware = new SecurityHeadersMiddleware();

test('SecurityHeadersMiddleware sets X-Content-Type-Options: nosniff', async () => {
  const { req, res, resHeaders } = createContext();
  await middleware.handle(req, res, async () => {});
  assert.equal(resHeaders['x-content-type-options'], 'nosniff');
});

test('SecurityHeadersMiddleware sets X-Frame-Options: DENY', async () => {
  const { req, res, resHeaders } = createContext();
  await middleware.handle(req, res, async () => {});
  assert.equal(resHeaders['x-frame-options'], 'DENY');
});

test('SecurityHeadersMiddleware sets X-XSS-Protection', async () => {
  const { req, res, resHeaders } = createContext();
  await middleware.handle(req, res, async () => {});
  assert.equal(resHeaders['x-xss-protection'], '1; mode=block');
});

test('SecurityHeadersMiddleware sets Referrer-Policy', async () => {
  const { req, res, resHeaders } = createContext();
  await middleware.handle(req, res, async () => {});
  assert.equal(resHeaders['referrer-policy'], 'strict-origin-when-cross-origin');
});

test('SecurityHeadersMiddleware sets Permissions-Policy', async () => {
  const { req, res, resHeaders } = createContext();
  await middleware.handle(req, res, async () => {});
  assert.equal(resHeaders['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
});

test('SecurityHeadersMiddleware calls next()', async () => {
  const { req, res } = createContext();
  let nextCalled = false;
  await middleware.handle(req, res, async () => { nextCalled = true; });
  assert.ok(nextCalled);
});
