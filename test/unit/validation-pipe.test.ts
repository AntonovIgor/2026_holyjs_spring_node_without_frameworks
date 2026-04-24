import 'reflect-metadata';
import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import test from 'node:test';
import { UnprocessableEntityException } from '../../src/core/exception/HttpException.js';
import { Request } from '../../src/core/http/Request.js';
import type { Response } from '../../src/core/http/Response.js';
import { IsNumber, IsString, IsBoolean } from '../../src/core/validation/decorators.js';
import {
  queryPipe,
  paramsPipe,
  VALIDATED_QUERY_KEY,
  VALIDATED_PARAMS_KEY,
} from '../../src/core/validation/ValidationPipe.js';

function createRequest(query: Record<string, string> = {}, params: Record<string, string> = {}): Request {
  const qs = new URLSearchParams(query).toString();
  const req = new Request({
    url: qs ? `/?${qs}` : '/',
    method: 'GET',
    headers: { host: 'localhost' },
  } as IncomingMessage);
  req.params = params;
  return req;
}

class QueryDto {
  @IsString() name!: string;
}

class NumberDto {
  @IsNumber() page!: number;
}

class BooleanDto {
  @IsBoolean() active!: boolean;
}

class SpaceDto { @IsString() val!: string; }
class ParamsDto { @IsNumber() id!: number; }
class InvalidParamsDto { @IsNumber() id!: number; }

test('queryPipe passes string through as string', async () => {
  const req = createRequest({ name: 'alice' });
  await queryPipe(QueryDto).handle(req, {} as Response, async () => {});
  assert.equal(req.get<QueryDto>(VALIDATED_QUERY_KEY)?.name, 'alice');
});

test('queryPipe coerces numeric string to number', async () => {
  const req = createRequest({ page: '5' });
  await queryPipe(NumberDto).handle(req, {} as Response, async () => {});
  assert.equal(req.get<NumberDto>(VALIDATED_QUERY_KEY)?.page, 5);
});

test('queryPipe coerces "true" to boolean true', async () => {
  const req = createRequest({ active: 'true' });
  await queryPipe(BooleanDto).handle(req, {} as Response, async () => {});
  assert.equal(req.get<BooleanDto>(VALIDATED_QUERY_KEY)?.active, true);
});

test('queryPipe coerces "false" to boolean false', async () => {
  const req = createRequest({ active: 'false' });
  await queryPipe(BooleanDto).handle(req, {} as Response, async () => {});
  assert.equal(req.get<BooleanDto>(VALIDATED_QUERY_KEY)?.active, false);
});

test('queryPipe does not coerce whitespace-only string to 0', async () => {
  const req = createRequest({ val: '   ' });
  await queryPipe(SpaceDto).handle(req, {} as Response, async () => {});
  assert.equal(typeof req.get<SpaceDto>(VALIDATED_QUERY_KEY)?.val, 'string');
});

test('queryPipe throws UnprocessableEntityException on validation failure', async () => {
  const req = createRequest({ page: 'abc' });
  await assert.rejects(
    queryPipe(NumberDto).handle(req, {} as Response, async () => {}),
    UnprocessableEntityException,
  );
});

test('paramsPipe coerces and validates path params', async () => {
  const req = createRequest({}, { id: '42' });
  await paramsPipe(ParamsDto).handle(req, {} as Response, async () => {});
  assert.equal(req.get<ParamsDto>(VALIDATED_PARAMS_KEY)?.id, 42);
});

test('paramsPipe throws UnprocessableEntityException on invalid param', async () => {
  const req = createRequest({}, { id: 'abc' });
  await assert.rejects(
    paramsPipe(InvalidParamsDto).handle(req, {} as Response, async () => {}),
    UnprocessableEntityException,
  );
});
