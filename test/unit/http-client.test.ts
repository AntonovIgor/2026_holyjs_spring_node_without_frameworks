import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { HttpClient } from '../../src/core/http/HttpClient.js';
import { requestContext } from '../../src/core/context/RequestContext.js';
import type { Logger } from '../../src/core/logger/Logger.js';

const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};

async function startMockServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ url: (path: string) => string; close: () => Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: (path) => `http://localhost:${port}${path}`,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    ),
  };
}

test('fetches JSON response and returns parsed data', async () => {
  const mock = await startMockServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'ok' }));
  });

  try {
    const client = new HttpClient();
    const result = await client.fetch<{ message: string }>(mock.url('/'));
    assert.equal(result.status, 200);
    assert.equal(result.data.message, 'ok');
  } finally {
    await mock.close();
  }
});

test('fetches non-JSON response as text', async () => {
  const mock = await startMockServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('hello');
  });

  try {
    const client = new HttpClient();
    const result = await client.fetch<string>(mock.url('/'));
    assert.equal(result.status, 200);
    assert.equal(result.data, 'hello');
  } finally {
    await mock.close();
  }
});

test('returns response status and headers', async () => {
  const mock = await startMockServer((_req, res) => {
    res.writeHead(201, { 'Content-Type': 'application/json', 'X-Custom': 'value' });
    res.end('{}');
  });

  try {
    const client = new HttpClient();
    const result = await client.fetch(mock.url('/'));
    assert.equal(result.status, 201);
    assert.equal(result.headers.get('x-custom'), 'value');
  } finally {
    await mock.close();
  }
});

test('propagates x-trace-id from requestContext', async () => {
  let receivedTraceId: string | undefined;

  const mock = await startMockServer((req, res) => {
    receivedTraceId = req.headers['x-trace-id'] as string | undefined;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });

  try {
    const client = new HttpClient();
    await requestContext.run(
      { traceId: 'trace-abc-123', startedAt: Date.now(), logger: silentLogger },
      () => client.fetch(mock.url('/')),
    );
    assert.equal(receivedTraceId, 'trace-abc-123');
  } finally {
    await mock.close();
  }
});

test('does not add x-trace-id when no requestContext is active', async () => {
  let hasTraceHeader = false;

  const mock = await startMockServer((req, res) => {
    hasTraceHeader = 'x-trace-id' in req.headers;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });

  try {
    const client = new HttpClient();
    await client.fetch(mock.url('/'));
    assert.equal(hasTraceHeader, false);
  } finally {
    await mock.close();
  }
});

test('re-throws on network error', async () => {
  const client = new HttpClient();
  await assert.rejects(
    client.fetch('http://localhost:1/'),
    (err: unknown) => err instanceof Error,
  );
});
