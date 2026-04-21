import { readFileSync } from 'node:fs';

import type {
  ConfigSchema,
  ConfigField,
  PrimitiveType,
  Paths,
  ResolveType,
  InferPrimitive,
} from './types.js';

/**
 * Типобезопасный сервис конфигурации.
 *
 * Читает значения из трёх источников в порядке приоритета:
 * 1. Переменные окружения (`process.env`)
 * 2. JSON-файл конфигурации (`config.<NODE_ENV>.json` или `config.default.json`)
 * 3. Значения по умолчанию из схемы
 *
 * Метод `get()` возвращает значение с правильным TypeScript-типом —
 * не нужно вручную кастовать строки в числа.
 */
export class ConfigService<TSchema extends ConfigSchema> {
  private readonly values = new Map<string, string | number | boolean>();

  constructor(private readonly schema: TSchema) {
    const fileValues = this.loadConfigFile();
    this.populate(schema, '', fileValues);
    this.assertRequired(schema, '');
  }

  /** Возвращает значение конфигурации по типобезопасному пути (например, `'db.port'`). */
  get<P extends Paths<TSchema>>(path: P): ResolveType<TSchema, P> {
    const value = this.values.get(path);
    if (value === undefined) {
      throw new Error(`[ConfigService] Key not found: "${path}"`);
    }
    return value as ResolveType<TSchema, P>;
  }

  private loadConfigFile(): Record<string, string> {
    const env = process.env['NODE_ENV'] ?? 'development';
    const candidates = [`config.${env}.json`, 'config.default.json'];

    for (const filename of candidates) {
      try {
        const raw = readFileSync(filename, 'utf8');
        return this.flattenObject(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        // файл не найден — пробуем следующий
      }
    }

    return {};
  }

  private flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, fullKey));
      } else {
        result[fullKey] = String(value);
      }
    }

    return result;
  }

  private populate(
    schema: ConfigSchema,
    prefix: string,
    fileValues: Record<string, string>,
  ): void {
    for (const [key, entry] of Object.entries(schema)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (this.isField(entry)) {
        // Приоритет: process.env > конфигурационный файл > значение по умолчанию
        const raw = process.env[entry.env] ?? fileValues[fullKey];

        if (raw !== undefined) {
          this.values.set(fullKey, this.coerce(raw, entry.type, fullKey));
        } else if (entry.default !== undefined) {
          this.values.set(fullKey, entry.default as InferPrimitive<PrimitiveType>);
        }
      } else {
        this.populate(entry as ConfigSchema, fullKey, fileValues);
      }
    }
  }

  private assertRequired(schema: ConfigSchema, prefix: string): void {
    const missing: string[] = [];
    this.collectMissing(schema, prefix, missing);

    if (missing.length > 0) {
      throw new Error(
        `[ConfigService] Missing required config values:\n  ${missing.join('\n  ')}`,
      );
    }
  }

  private collectMissing(schema: ConfigSchema, prefix: string, missing: string[]): void {
    for (const [key, entry] of Object.entries(schema)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (this.isField(entry)) {
        if (!this.values.has(fullKey)) {
          missing.push(`${fullKey}  (env: ${entry.env})`);
        }
      } else {
        this.collectMissing(entry as ConfigSchema, fullKey, missing);
      }
    }
  }

  private isField(value: ConfigField | ConfigSchema): value is ConfigField {
    return 'env' in value && 'type' in value;
  }

  private coerce(raw: string, type: PrimitiveType, key: string): string | number | boolean {
    switch (type) {
      case 'number': {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          throw new Error(`[ConfigService] Cannot parse "${key}" as number: "${raw}"`);
        }
        return n;
      }
      case 'boolean':
        return raw === 'true' || raw === '1';
      default:
        return raw;
    }
  }
}
