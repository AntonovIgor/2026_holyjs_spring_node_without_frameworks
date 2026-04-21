/** Примитивные типы значений конфигурации. */
export type PrimitiveType = 'string' | 'number' | 'boolean';

/** Преобразует строковое имя типа в TypeScript-тип. */
export type InferPrimitive<T extends PrimitiveType> =
  T extends 'string' ? string :
  T extends 'number' ? number :
  boolean;

/**
 * Описание одного поля конфигурации.
 * Содержит имя переменной окружения, тип и опциональное значение по умолчанию.
 */
export interface ConfigField<T extends PrimitiveType = PrimitiveType> {
  env: string;
  type: T;
  default?: InferPrimitive<T>;
}

/**
 * Схема конфигурации — дерево полей, которое описывает всю конфигурацию приложения.
 * Вложенные объекты превращаются в точечные пути: `{ db: { port: field(...) } }` → `'db.port'`.
 */
export type ConfigSchema = {
  [key: string]: ConfigField | ConfigSchema;
};

type IsField<T> = T extends { env: string; type: PrimitiveType } ? true : false;

/** Вычисляет все допустимые пути в схеме конфигурации. */
export type Paths<T, P extends string = ''> = {
  [K in keyof T & string]:
    IsField<T[K]> extends true
      ? `${P}${K}`
      : T[K] extends object
        ? Paths<T[K], `${P}${K}.`>
        : never;
}[keyof T & string];

type Get<T, K extends string> = K extends keyof T ? T[K] : never;

/** Вычисляет TypeScript-тип значения по пути в схеме. */
export type ResolveType<T, P extends string> =
  P extends `${infer H}.${infer R}`
    ? ResolveType<Get<T, H>, R>
    : Get<T, P> extends ConfigField<infer Type>
      ? InferPrimitive<Type>
      : never;

/** Вспомогательная функция для определения поля конфигурации с выводом типов. */
export function field<T extends PrimitiveType>(def: ConfigField<T>): ConfigField<T> {
  return def;
}
