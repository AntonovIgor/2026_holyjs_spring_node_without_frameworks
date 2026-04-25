import assert from 'node:assert/strict';
import test from 'node:test';

import { NotFoundException, InternalServerErrorException } from '../../src/core/exception/HttpException.js';
import { BodyParserMiddleware } from '../../src/core/middleware/built-in/BodyParserMiddleware.js';
import { startApp } from './helpers.js';

test('GET route responds with JSON', async () => {
  const { app, url } = await startApp((app) => {
    app.registerModule({
      register(router) {
        router.get('/hello', async (_req, res) => {
          res.status(200).json({ message: 'hello' });
        });
      },
      onStart() {},
      onStop() {},
    });
  });

  try {
    const res = await fetch(url('/hello'));
    const body = await res.json() as { message: string };
    assert.equal(res.status, 200);
    assert.equal(body.message, 'hello');
  } finally {
    await app.close();
  }
});

test('unknown path returns 404', async () => {
  const { app, url } = await startApp(() => {});

  try {
    const res = await fetch(url('/missing'));
    assert.equal(res.status, 404);
    const body = await res.json() as { statusCode: number };
    assert.equal(body.statusCode, 404);
  } finally {
    await app.close();
  }
});

test('HttpException is serialized to correct status and body', async () => {
  const { app, url } = await startApp((app) => {
    app.registerModule({
      register(router) {
        router.get('/not-found', async () => {
          throw new NotFoundException('item missing');
        });
      },
      onStart() {},
      onStop() {},
    });
  });

  try {
    const res = await fetch(url('/not-found'));
    const body = await res.json() as { statusCode: number; message: string };
    assert.equal(res.status, 404);
    assert.equal(body.statusCode, 404);
    assert.equal(body.message, 'item missing');
  } finally {
    await app.close();
  }
});

test('unhandled error returns 500', async () => {
  const { app, url } = await startApp((app) => {
    app.registerModule({
      register(router) {
        router.get('/crash', async () => {
          throw new Error('unexpected');
        });
      },
      onStart() {},
      onStop() {},
    });
  });

  try {
    const res = await fetch(url('/crash'));
    assert.equal(res.status, 500);
  } finally {
    await app.close();
  }
});

test('path params are extracted and accessible', async () => {
  const { app, url } = await startApp((app) => {
    app.registerModule({
      register(router) {
        router.get('/users/:id', async (req, res) => {
          res.json({ id: req.params.id });
        });
      },
      onStart() {},
      onStop() {},
    });
  });

  try {
    const res = await fetch(url('/users/42'));
    const body = await res.json() as { id: string };
    assert.equal(res.status, 200);
    assert.equal(body.id, '42');
  } finally {
    await app.close();
  }
});

test('middleware is applied before route handler', async () => {
  const { app, url } = await startApp((app) => {
    app.use(new BodyParserMiddleware());
    app.registerModule({
      register(router) {
        router.post('/echo', async (req, res) => {
          const body = await req.body.json<{ value: number }>();
          res.json({ value: body.value });
        });
      },
      onStart() {},
      onStop() {},
    });
  });

  try {
    const res = await fetch(url('/echo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 99 }),
    });
    const body = await res.json() as { value: number };
    assert.equal(body.value, 99);
  } finally {
    await app.close();
  }
});

test('InternalServerErrorException returns 500 with message', async () => {
  const { app, url } = await startApp((app) => {
    app.registerModule({
      register(router) {
        router.get('/ise', async () => {
          throw new InternalServerErrorException('db connection failed');
        });
      },
      onStart() {},
      onStop() {},
    });
  });

  try {
    const res = await fetch(url('/ise'));
    const body = await res.json() as { statusCode: number; message: string };
    assert.equal(res.status, 500);
    assert.equal(body.message, 'db connection failed');
  } finally {
    await app.close();
  }
});
