import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { BadRequestException } from '../../src/core/exception/HttpException.js';
import { Request } from '../../src/core/http/Request.js';
import type { Response } from '../../src/core/http/Response.js';
import {
  FileUploadMiddleware,
  MULTIPART_KEY,
  type ParsedMultipart,
} from '../../src/core/middleware/built-in/FileUploadMiddleware.js';

function createMultipartBody(
  boundary: string,
  parts: Array<
    | { name: string; value: string }
    | { name: string; filename: string; contentType: string; value: string }
  >,
): Buffer {
  const chunks: Buffer[] = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));

    if ('filename' in part) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`,
        ),
      );
      chunks.push(Buffer.from(`Content-Type: ${part.contentType}\r\n\r\n`));
      chunks.push(Buffer.from(part.value));
      chunks.push(Buffer.from('\r\n'));
    } else {
      chunks.push(
        Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`),
      );
    }
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function createRequest(body: Buffer, contentType: string): Request {
  const raw = Object.assign(Readable.from([body]), {
    url: '/',
    method: 'POST',
    headers: {
      host: 'localhost',
      'content-type': contentType,
      'content-length': String(body.length),
    },
  }) as IncomingMessage;

  return new Request(raw);
}

test('FileUploadMiddleware parses multipart directly from request stream', async () => {
  const boundary = 'test-boundary';
  const uploadDir = await mkdtemp(join(tmpdir(), 'file-upload-middleware-'));
  const body = createMultipartBody(boundary, [
    { name: 'title', value: 'hello' },
    { name: 'avatar', filename: 'avatar.txt', contentType: 'text/plain', value: 'image-bytes' },
  ]);
  const req = createRequest(body, `multipart/form-data; boundary=${boundary}`);
  const middleware = new FileUploadMiddleware({ uploadDir });

  req.body.buffer = async (): Promise<Buffer> => {
    throw new Error('req.body.buffer should not be used for multipart parsing');
  };

  try {
    await middleware.handle(req, {} as Response, async () => {});

    const parsed = req.get<ParsedMultipart>(MULTIPART_KEY);
    assert.ok(parsed);
    assert.equal(parsed.fields.title, 'hello');
    assert.equal(parsed.files.avatar?.filename, 'avatar.txt');
    assert.equal(parsed.files.avatar?.mimetype, 'text/plain');
    assert.ok(parsed.files.avatar?.filepath);
    assert.equal(await readFile(parsed.files.avatar!.filepath, 'utf8'), 'image-bytes');
    assert.equal(await readStream(parsed.files.avatar!.createReadStream()), 'image-bytes');
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test('FileUploadMiddleware rejects files larger than the configured limit', async () => {
  const boundary = 'limit-boundary';
  const uploadDir = await mkdtemp(join(tmpdir(), 'file-upload-middleware-'));
  const body = createMultipartBody(boundary, [
    { name: 'avatar', filename: 'avatar.txt', contentType: 'text/plain', value: 'too-large' },
  ]);
  const req = createRequest(body, `multipart/form-data; boundary=${boundary}`);
  const middleware = new FileUploadMiddleware({ maxFileSize: 3, uploadDir });

  try {
    await assert.rejects(
      middleware.handle(req, {} as Response, async () => {}),
      (error: unknown) =>
        error instanceof BadRequestException &&
        error.message === 'Uploaded file exceeds size limit',
    );
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
