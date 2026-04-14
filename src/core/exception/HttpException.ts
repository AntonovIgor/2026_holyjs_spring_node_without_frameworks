/**
 * Базовый класс для всех HTTP-ошибок фреймворка.
 *
 * Наследуется от стандартного Error, поэтому прекрасно ловится через try/catch.
 * GlobalExceptionHandler умеет превращать его в JSON-ответ с нужным статусом.
 */
export class HttpException extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** 400 Bad Request — некорректный запрос от клиента. */
export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request', details?: unknown) {
    super(400, message, details);
  }
}

/** 401 Unauthorized — требуется аутентификация. */
export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, message, details);
  }
}

/** 403 Forbidden — доступ запрещён. */
export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, message, details);
  }
}

/** 404 Not Found — ресурс не найден. */
export class NotFoundException extends HttpException {
  constructor(message = 'Not Found', details?: unknown) {
    super(404, message, details);
  }
}

/** 409 Conflict — конфликт состояния ресурса. */
export class ConflictException extends HttpException {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, message, details);
  }
}

/** 422 Unprocessable Entity — тело запроса семантически некорректно. */
export class UnprocessableEntityException extends HttpException {
  constructor(message = 'Unprocessable Entity', details?: unknown) {
    super(422, message, details);
  }
}

/** 413 Payload Too Large — тело запроса превышает допустимый размер. */
export class PayloadTooLargeException extends HttpException {
  constructor(message = 'Payload Too Large', details?: unknown) {
    super(413, message, details);
  }
}

/** 415 Unsupported Media Type — неподдерживаемый Content-Type. */
export class UnsupportedMediaTypeException extends HttpException {
  constructor(message = 'Unsupported Media Type', details?: unknown) {
    super(415, message, details);
  }
}

/** 408 Request Timeout — клиент не успел отправить запрос вовремя. */
export class RequestTimeoutException extends HttpException {
  constructor(message = 'Request Timeout') {
    super(408, message);
  }
}

/** 429 Too Many Requests — превышен лимит запросов. */
export class TooManyRequestsException extends HttpException {
  constructor(message = 'Too Many Requests') {
    super(429, message);
  }
}

/** 500 Internal Server Error — непредвиденная ошибка на стороне сервера. */
export class InternalServerErrorException extends HttpException {
  constructor(message = 'Internal Server Error', details?: unknown) {
    super(500, message, details);
  }
}
