import type { ServerResponse } from 'node:http';

/** Настройки куки при установке через setCookie. */
export interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Обёртка над ServerResponse с fluent API.
 *
 * Позволяет цепочкой вызывать `.status(201).json(body)` вместо
 * многострочной работы с нативным `ServerResponse`.
 */
export class Response {
  constructor(readonly raw: ServerResponse) {}

  /** Устанавливает HTTP-статус и возвращает this для чейнинга. */
  status(code: number): this {
    this.raw.statusCode = code;
    return this;
  }

  /** Устанавливает заголовок ответа. */
  header(name: string, value: string): this {
    this.raw.setHeader(name, value);
    return this;
  }

  /** Отправляет JSON-ответ и завершает соединение. */
  json(data: unknown): void {
    this.raw.setHeader('Content-Type', 'application/json; charset=utf-8');
    this.raw.end(JSON.stringify(data));
  }

  /** Отправляет текстовый ответ и завершает соединение. */
  send(text: string): void {
    this.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
    this.raw.end(text);
  }

  /** Выполняет HTTP-редирект (по умолчанию 302). */
  redirect(url: string, code = 302): void {
    this.raw.statusCode = code;
    this.raw.setHeader('Location', url);
    this.raw.end();
  }

  /** Добавляет куки в заголовок Set-Cookie с нужными атрибутами безопасности. */
  setCookie(name: string, value: string, options: CookieOptions = {}): this {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options.maxAge !== undefined) {
      cookie += `; Max-Age=${options.maxAge}`;
    }

    if (options.expires !== undefined) {
      cookie += `; Expires=${options.expires.toUTCString()}`;
    }

    cookie += `; Path=${options.path ?? '/'}`;

    if (options.domain !== undefined) {
      cookie += `; Domain=${options.domain}`;
    }

    // SameSite=None требует Secure по спецификации
    const secure = options.secure === true || options.sameSite === 'None';

    if (secure) {
      cookie += '; Secure';
    }

    if (options.httpOnly === true) {
      cookie += '; HttpOnly';
    }

    if (options.sameSite !== undefined) {
      cookie += `; SameSite=${options.sameSite}`;
    }

    const existing = this.raw.getHeader('Set-Cookie');
    const cookies: string[] = Array.isArray(existing)
      ? existing.map(String)
      : existing !== undefined
        ? [String(existing)]
        : [];
    cookies.push(cookie);
    this.raw.setHeader('Set-Cookie', cookies);

    return this;
  }

  /** true, если заголовки уже отправлены (тело записано). */
  get sent(): boolean {
    return this.raw.headersSent;
  }
}
