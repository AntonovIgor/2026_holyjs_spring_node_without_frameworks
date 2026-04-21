import 'reflect-metadata';

/** Правило валидации одного поля. */
interface ValidationRule {
  check: (value: unknown) => boolean;
  message: (field: string) => string;
}

const RULES_KEY = Symbol('validation:rules');
const OPTIONAL_KEY = Symbol('validation:optional');

function addRule(target: object, key: string, rule: ValidationRule): void {
  const map: Map<string, ValidationRule[]> =
    Reflect.getMetadata(RULES_KEY, target.constructor) ?? new Map();

  const rules = map.get(key) ?? [];
  rules.push(rule);
  map.set(key, rules);
  Reflect.defineMetadata(RULES_KEY, map, target.constructor);
}

function markOptional(target: object, key: string): void {
  const set: Set<string> = Reflect.getMetadata(OPTIONAL_KEY, target.constructor) ?? new Set();
  set.add(key);
  Reflect.defineMetadata(OPTIONAL_KEY, set, target.constructor);
}

/** Проверяет, что значение является строкой. */
export function IsString(): PropertyDecorator {
  return (target, key) => {
    addRule(target, String(key), {
      check: (v) => typeof v === 'string',
      message: (f) => `${f} must be a string`,
    });
  };
}

/** Проверяет, что значение является числом (не NaN). */
export function IsNumber(): PropertyDecorator {
  return (target, key) => {
    addRule(target, String(key), {
      check: (v) => typeof v === 'number' && !Number.isNaN(v),
      message: (f) => `${f} must be a number`,
    });
  };
}

/** Проверяет, что значение является булевым. */
export function IsBoolean(): PropertyDecorator {
  return (target, key) => {
    addRule(target, String(key), {
      check: (v) => typeof v === 'boolean',
      message: (f) => `${f} must be a boolean`,
    });
  };
}

/** Проверяет, что значение является корректным email-адресом. */
export function IsEmail(): PropertyDecorator {
  return (target, key) => {
    addRule(target, String(key), {
      check: (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: (f) => `${f} must be a valid email address`,
    });
  };
}

/** Проверяет минимальную длину строки. */
export function MinLength(min: number): PropertyDecorator {
  return (target, key) => {
    addRule(target, String(key), {
      check: (v) => typeof v === 'string' && v.length >= min,
      message: (f) => `${f} must be at least ${min} characters long`,
    });
  };
}

/** Проверяет максимальную длину строки. */
export function MaxLength(max: number): PropertyDecorator {
  return (target, key) => {
    addRule(target, String(key), {
      check: (v) => typeof v === 'string' && v.length <= max,
      message: (f) => `${f} must be at most ${max} characters long`,
    });
  };
}

/** Проверяет, что число не меньше min. */
export function Min(min: number): PropertyDecorator {
  return (target, key) => {
    addRule(target, String(key), {
      check: (v) => typeof v === 'number' && v >= min,
      message: (f) => `${f} must be >= ${min}`,
    });
  };
}

/** Проверяет, что число не больше max. */
export function Max(max: number): PropertyDecorator {
  return (target, key) => {
    addRule(target, String(key), {
      check: (v) => typeof v === 'number' && v <= max,
      message: (f) => `${f} must be <= ${max}`,
    });
  };
}

/** Помечает поле как необязательное — валидация не сработает, если оно отсутствует. */
export function IsOptional(): PropertyDecorator {
  return (target, key) => { markOptional(target, String(key)); };
}

/** Результат валидации одного поля. */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Валидирует произвольный объект по правилам, заданным декораторами на DTO-классе.
 * Возвращает массив ошибок (пустой, если всё в порядке).
 */
export function validate<T extends object>(
  DtoClass: new () => T,
  data: unknown,
): ValidationError[] {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return [{ field: '_root', message: 'Request body must be a JSON object' }];
  }

  const body = data as Record<string, unknown>;
  const rules: Map<string, ValidationRule[]> =
    Reflect.getMetadata(RULES_KEY, DtoClass) ?? new Map();
  const optional: Set<string> =
    Reflect.getMetadata(OPTIONAL_KEY, DtoClass) ?? new Set();

  const errors: ValidationError[] = [];

  for (const [field, fieldRules] of rules) {
    const value = body[field];

    if (value === undefined || value === null) {
      if (!optional.has(field)) {
        errors.push({ field, message: `${field} is required` });
      }
      continue;
    }

    for (const rule of fieldRules) {
      if (!rule.check(value)) {
        errors.push({ field, message: rule.message(field) });
      }
    }
  }

  return errors;
}
