/**
 * Абстракция логгера.
 *
 * Интерфейс намеренно минимальный — четыре уровня логирования
 * плюс метод child() для создания дочернего логгера с контекстными полями.
 * Конкретная реализация (PinoLogger) подключается при создании Application.
 */
export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  /** Создаёт дочерний логгер, который добавляет переданные поля к каждой записи. */
  child(bindings: Record<string, unknown>): Logger;
}

/** Символ-ключ для хранения логгера запроса в extras объекта Request. */
export const LOGGER_KEY = Symbol('request:logger');
