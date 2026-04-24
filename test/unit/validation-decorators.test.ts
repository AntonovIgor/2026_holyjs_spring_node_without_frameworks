import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsEmail,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsOptional,
  validate,
} from '../../src/core/validation/decorators.js';

class StringDto { @IsString() name!: string; }
class NumberDto { @IsNumber() age!: number; }
class BooleanDto { @IsBoolean() active!: boolean; }
class EmailDto { @IsEmail() email!: string; }
class MinLengthDto { @MinLength(3) username!: string; }
class MaxLengthDto { @MaxLength(5) code!: string; }
class MinDto { @Min(0) count!: number; }
class MaxDto { @Max(100) score!: number; }
class OptionalDto { @IsOptional() @IsString() bio!: string; }
class RequiredDto { @IsString() name!: string; }
class MinMaxDto { @MinLength(3) @MaxLength(10) name!: string; }

test('IsString passes for string, fails for number', () => {
  assert.equal(validate(StringDto, { name: 'alice' }).length, 0);
  assert.ok(validate(StringDto, { name: 42 }).length > 0);
});

test('IsNumber passes for number, fails for string and NaN', () => {
  assert.equal(validate(NumberDto, { age: 25 }).length, 0);
  assert.ok(validate(NumberDto, { age: 'old' }).length > 0);
  assert.ok(validate(NumberDto, { age: NaN }).length > 0);
});

test('IsBoolean passes for boolean, fails for string', () => {
  assert.equal(validate(BooleanDto, { active: true }).length, 0);
  assert.equal(validate(BooleanDto, { active: false }).length, 0);
  assert.ok(validate(BooleanDto, { active: 'true' }).length > 0);
});

test('IsEmail passes for valid email, fails for invalid', () => {
  assert.equal(validate(EmailDto, { email: 'user@example.com' }).length, 0);
  assert.ok(validate(EmailDto, { email: 'not-an-email' }).length > 0);
});

test('MinLength passes for string at or above min', () => {
  assert.equal(validate(MinLengthDto, { username: 'abc' }).length, 0);
  assert.ok(validate(MinLengthDto, { username: 'ab' }).length > 0);
});

test('MaxLength passes for string at or below max', () => {
  assert.equal(validate(MaxLengthDto, { code: 'abcde' }).length, 0);
  assert.ok(validate(MaxLengthDto, { code: 'abcdef' }).length > 0);
});

test('Min passes for number at or above min', () => {
  assert.equal(validate(MinDto, { count: 0 }).length, 0);
  assert.ok(validate(MinDto, { count: -1 }).length > 0);
});

test('Max passes for number at or below max', () => {
  assert.equal(validate(MaxDto, { score: 100 }).length, 0);
  assert.ok(validate(MaxDto, { score: 101 }).length > 0);
});

test('IsOptional allows missing field', () => {
  assert.equal(validate(OptionalDto, {}).length, 0);
});

test('required field missing produces error', () => {
  const errors = validate(RequiredDto, {});
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.field, 'name');
});

test('validate returns _root error for non-object input', () => {
  assert.equal(validate(RequiredDto, 'string').length, 1);
  assert.equal(validate(RequiredDto, null).length, 1);
  assert.equal(validate(RequiredDto, []).length, 1);
});

test('multiple validators on one field report all failures', () => {
  assert.equal(validate(MinMaxDto, { name: 'ok' }).length, 1);
});
