import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  RequestTimeoutException,
  TooManyRequestsException,
  InternalServerErrorException,
} from '../../src/core/exception/HttpException.js';

const cases: Array<[new () => HttpException, number, string]> = [
  [BadRequestException, 400, 'Bad Request'],
  [UnauthorizedException, 401, 'Unauthorized'],
  [ForbiddenException, 403, 'Forbidden'],
  [NotFoundException, 404, 'Not Found'],
  [ConflictException, 409, 'Conflict'],
  [UnprocessableEntityException, 422, 'Unprocessable Entity'],
  [PayloadTooLargeException, 413, 'Payload Too Large'],
  [UnsupportedMediaTypeException, 415, 'Unsupported Media Type'],
  [RequestTimeoutException, 408, 'Request Timeout'],
  [TooManyRequestsException, 429, 'Too Many Requests'],
  [InternalServerErrorException, 500, 'Internal Server Error'],
];

for (const [ExClass, expectedStatus, expectedMessage] of cases) {
  test(`${ExClass.name} has statusCode ${expectedStatus} and default message`, () => {
    const err = new ExClass();
    assert.equal(err.statusCode, expectedStatus);
    assert.equal(err.message, expectedMessage);
    assert.ok(err instanceof HttpException);
    assert.ok(err instanceof Error);
  });
}

test('HttpException preserves custom message', () => {
  const err = new BadRequestException('custom message');
  assert.equal(err.message, 'custom message');
});

test('HttpException stores details', () => {
  const details = [{ field: 'name', message: 'required' }];
  const err = new UnprocessableEntityException('Validation failed', details);
  assert.deepEqual(err.details, details);
});

test('HttpException name matches constructor name', () => {
  const err = new NotFoundException();
  assert.equal(err.name, 'NotFoundException');
});
