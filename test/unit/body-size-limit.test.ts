import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '../../src/core/exception/HttpException.js';
import { Request } from '../../src/core/http/Request.js';
import type { Response } from '../../src/core/http/Response.js';
import { BodyParserMiddleware } from '../../src/core/middleware/built-in/BodyParserMiddleware.js';
import { validationPipe } from '../../src/core/validation/ValidationPipe.js';

function createRequest(
  chunks: string[],
  headers: Record<string, string> = {},
): Request & { raw: IncomingMessage & { destroyCalls: number } } {
  const stream = Readable.from(chunks.map((chunk) => Buffer.from(chunk)));
  const originalDestroy = stream.destroy.bind(stream);
  let destroyCalls = 0;

  const raw = Object.assign(stream, {
    url: '/',
    method: 'POST',
    headers: { host: 'localhost', ...headers },
    destroy(error?: Error) {
      destroyCalls += 1;
      return originalDestroy(error);
    },
    get destroyCalls() {
      return destroyCalls;
    },
  }) as IncomingMessage & { destroyCalls: number };

  return new Request(raw) as Request & { raw: IncomingMessage & { destroyCalls: number } };
}

test('Request body rejects oversized chunked payload with PayloadTooLargeException', async () => {
  const req = createRequest(['abc', 'def']);
  req.maxBodySize = 5;

  await assert.rejects(req.body.buffer(), PayloadTooLargeException);
  assert.equal(req.raw.destroyCalls, 0);
});

test('BodyParserMiddleware rejects oversized content-length before reading body', async () => {
  const req = createRequest([], { 'content-length': '10' });
  const middleware = new BodyParserMiddleware({ maxBodySize: 5 });

  await assert.rejects(
    middleware.handle(req, {} as Response, async () => {}),
    PayloadTooLargeException,
  );
});

test('validationPipe preserves PayloadTooLargeException instead of masking it as invalid JSON', async () => {
  class CreateDto {}

  const req = createRequest(['abc', 'def']);
  req.maxBodySize = 5;
  const pipe = validationPipe(CreateDto);

  await assert.rejects(
    pipe.handle(req, {} as Response, async () => {}),
    (error: unknown) =>
      error instanceof PayloadTooLargeException &&
      !(error instanceof UnprocessableEntityException),
  );
});
