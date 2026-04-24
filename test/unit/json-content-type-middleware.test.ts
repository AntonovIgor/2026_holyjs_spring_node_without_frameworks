import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import test from 'node:test';
import { UnsupportedMediaTypeException } from '../../src/core/exception/HttpException.js';
import { Request } from '../../src/core/http/Request.js';
import type { Response } from '../../src/core/http/Response.js';
import { JsonContentTypeMiddleware } from '../../src/core/middleware/built-in/JsonContentTypeMiddleware.js';

function createRequest(method: string, contentType?: string): Request {
  return new Request({
    url: '/',
    method,
    headers: {
      host: 'localhost',
      ...(contentType !== undefined ? { 'content-type': contentType } : {}),
    },
  } as IncomingMessage);
}

const middleware = new JsonContentTypeMiddleware();

test('POST without Content-Type throws UnsupportedMediaTypeException', async () => {
  const req = createRequest('POST');
  await assert.rejects(
    middleware.handle(req, {} as Response, async () => {}),
    UnsupportedMediaTypeException,
  );
});

test('PUT without Content-Type throws UnsupportedMediaTypeException', async () => {
  const req = createRequest('PUT');
  await assert.rejects(
    middleware.handle(req, {} as Response, async () => {}),
    UnsupportedMediaTypeException,
  );
});

test('PATCH without Content-Type throws UnsupportedMediaTypeException', async () => {
  const req = createRequest('PATCH');
  await assert.rejects(
    middleware.handle(req, {} as Response, async () => {}),
    UnsupportedMediaTypeException,
  );
});

test('POST with application/json passes through', async () => {
  let nextCalled = false;
  const req = createRequest('POST', 'application/json');
  await middleware.handle(req, {} as Response, async () => { nextCalled = true; });
  assert.ok(nextCalled);
});

test('POST with application/json; charset=utf-8 passes through', async () => {
  let nextCalled = false;
  const req = createRequest('POST', 'application/json; charset=utf-8');
  await middleware.handle(req, {} as Response, async () => { nextCalled = true; });
  assert.ok(nextCalled);
});

test('GET without Content-Type passes through', async () => {
  let nextCalled = false;
  const req = createRequest('GET');
  await middleware.handle(req, {} as Response, async () => { nextCalled = true; });
  assert.ok(nextCalled);
});

test('DELETE without Content-Type passes through', async () => {
  let nextCalled = false;
  const req = createRequest('DELETE');
  await middleware.handle(req, {} as Response, async () => { nextCalled = true; });
  assert.ok(nextCalled);
});
