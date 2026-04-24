import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import test from 'node:test';
import { Response } from '../../src/core/http/Response.js';

function createResponse(): { res: Response; getSetCookie: () => string[] } {
  const headers: Record<string, string | string[]> = {};

  const raw = {
    statusCode: 200,
    setHeader(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    removeHeader(name: string) {
      delete headers[name.toLowerCase()];
    },
    end() {},
    headersSent: false,
  } as unknown as ServerResponse;

  const res = new Response(raw);
  const getSetCookie = (): string[] => {
    const v = headers['set-cookie'];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  };
  return { res, getSetCookie };
}

test('setCookie sets a basic cookie with default Path=/', () => {
  const { res, getSetCookie } = createResponse();
  res.setCookie('session', 'abc');
  assert.equal(getSetCookie().length, 1);
  assert.ok(getSetCookie()[0]?.includes('session=abc'));
  assert.ok(getSetCookie()[0]?.includes('Path=/'));
});

test('setCookie accumulates multiple cookies', () => {
  const { res, getSetCookie } = createResponse();
  res.setCookie('a', '1');
  res.setCookie('b', '2');
  assert.equal(getSetCookie().length, 2);
});

test('setCookie adds HttpOnly and Secure flags', () => {
  const { res, getSetCookie } = createResponse();
  res.setCookie('token', 'xyz', { httpOnly: true, secure: true });
  const cookie = getSetCookie()[0]!;
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('Secure'));
});

test('setCookie with SameSite=None forces Secure', () => {
  const { res, getSetCookie } = createResponse();
  res.setCookie('x', '1', { sameSite: 'None' });
  const cookie = getSetCookie()[0]!;
  assert.ok(cookie.includes('Secure'));
  assert.ok(cookie.includes('SameSite=None'));
});

test('setCookie with SameSite=Strict does not force Secure', () => {
  const { res, getSetCookie } = createResponse();
  res.setCookie('x', '1', { sameSite: 'Strict' });
  const cookie = getSetCookie()[0]!;
  assert.ok(!cookie.includes('Secure'));
  assert.ok(cookie.includes('SameSite=Strict'));
});

test('setCookie includes MaxAge when provided', () => {
  const { res, getSetCookie } = createResponse();
  res.setCookie('x', '1', { maxAge: 3600 });
  assert.ok(getSetCookie()[0]?.includes('Max-Age=3600'));
});

test('setCookie includes Expires when provided', () => {
  const { res, getSetCookie } = createResponse();
  const expires = new Date('2030-01-01T00:00:00.000Z');
  res.setCookie('x', '1', { expires });
  assert.ok(getSetCookie()[0]?.includes('Expires='));
});

test('setCookie includes Domain when provided', () => {
  const { res, getSetCookie } = createResponse();
  res.setCookie('x', '1', { domain: 'example.com' });
  assert.ok(getSetCookie()[0]?.includes('Domain=example.com'));
});

test('setCookie respects custom Path', () => {
  const { res, getSetCookie } = createResponse();
  res.setCookie('x', '1', { path: '/api' });
  assert.ok(getSetCookie()[0]?.includes('Path=/api'));
});

test('setCookie URL-encodes name and value', () => {
  const { res, getSetCookie } = createResponse();
  res.setCookie('my cookie', 'val ue');
  const cookie = getSetCookie()[0]!;
  assert.ok(cookie.startsWith('my%20cookie=val%20ue'));
});

test('setCookie is chainable', () => {
  const { res } = createResponse();
  const result = res.setCookie('a', '1');
  assert.equal(result, res);
});
