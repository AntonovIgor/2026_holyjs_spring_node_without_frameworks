import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { Request } from '../../src/core/http/Request.js';
import { Response } from '../../src/core/http/Response.js';
import { CorsMiddleware } from '../../src/core/middleware/built-in/CorsMiddleware.js';

function createContext(method: string, headers: Record<string, string> = {}): {
  req: Request;
  res: Response;
  resHeaders: Record<string, string | string[]>;
} {
  const req = new Request({
    url: '/',
    method,
    headers: { host: 'localhost', ...headers },
  } as IncomingMessage);

  const resHeaders: Record<string, string | string[]> = {};
  let statusCode = 200;
  const raw = {
    get statusCode() { return statusCode; },
    set statusCode(v: number) { statusCode = v; },
    setHeader(name: string, value: string | string[]) { resHeaders[name.toLowerCase()] = value; },
    getHeader(name: string) { return resHeaders[name.toLowerCase()]; },
    removeHeader(name: string) { delete resHeaders[name.toLowerCase()]; },
    end() {},
    headersSent: false,
  } as unknown as ServerResponse;

  return { req, res: new Response(raw), resHeaders };
}

test('no Origin header sets ACAO to *', async () => {
  const { req, res, resHeaders } = createContext('GET');
  await new CorsMiddleware().handle(req, res, async () => {});
  assert.equal(resHeaders['access-control-allow-origin'], '*');
});

test('allowed origin is reflected', async () => {
  const { req, res, resHeaders } = createContext('GET', { origin: 'https://example.com' });
  await new CorsMiddleware({ origins: 'https://example.com' }).handle(req, res, async () => {});
  assert.equal(resHeaders['access-control-allow-origin'], 'https://example.com');
  assert.equal(resHeaders['vary'], 'Origin');
});

test('disallowed origin gets no ACAO header', async () => {
  const { req, res, resHeaders } = createContext('GET', { origin: 'https://evil.com' });
  await new CorsMiddleware({ origins: 'https://example.com' }).handle(req, res, async () => {});
  assert.equal(resHeaders['access-control-allow-origin'], undefined);
});

test('origins as array allows matching origin', async () => {
  const { req, res, resHeaders } = createContext('GET', { origin: 'https://b.com' });
  await new CorsMiddleware({ origins: ['https://a.com', 'https://b.com'] }).handle(req, res, async () => {});
  assert.equal(resHeaders['access-control-allow-origin'], 'https://b.com');
});

test('origins as function allows matching origin', async () => {
  const { req, res, resHeaders } = createContext('GET', { origin: 'https://trusted.com' });
  await new CorsMiddleware({ origins: (o) => o.endsWith('.com') }).handle(req, res, async () => {});
  assert.equal(resHeaders['access-control-allow-origin'], 'https://trusted.com');
});

test('credentials option sets ACAC header', async () => {
  const { req, res, resHeaders } = createContext('GET', { origin: 'https://example.com' });
  await new CorsMiddleware({ credentials: true }).handle(req, res, async () => {});
  assert.equal(resHeaders['access-control-allow-credentials'], 'true');
});

test('maxAge sets ACMA header', async () => {
  const { req, res, resHeaders } = createContext('GET');
  await new CorsMiddleware({ maxAge: 3600 }).handle(req, res, async () => {});
  assert.equal(resHeaders['access-control-max-age'], '3600');
});

test('OPTIONS preflight returns 204 without calling next', async () => {
  const { req, res, resHeaders } = createContext('OPTIONS', { origin: 'https://example.com' });
  let nextCalled = false;
  await new CorsMiddleware().handle(req, res, async () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal((res.raw as unknown as { statusCode: number }).statusCode, 204);
});
