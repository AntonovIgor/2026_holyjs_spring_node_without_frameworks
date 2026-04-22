import 'reflect-metadata';

// HTTP
export { Application, Request, Response, Router, HttpClient } from './http/index.js';
export type { RouteHandler, ApplicationOptions, HttpClientResponse, CookieOptions } from './http/index.js';

// Logger
export { PinoLogger, LOGGER_KEY, getLogger } from './logger/index.js';
export type { Logger, PinoLoggerOptions } from './logger/index.js';

// Middleware
export {
  MiddlewarePipeline,
  TraceMiddleware,
  LoggerMiddleware,
  CorsMiddleware,
  BodyParserMiddleware,
  RequestTimeoutMiddleware,
  RateLimitMiddleware,
  SecurityHeadersMiddleware,
  CompressionMiddleware,
  StaticFilesMiddleware,
  FileUploadMiddleware,
  MULTIPART_KEY,
  CookieMiddleware,
  COOKIES_KEY,
  getCookies,
  JsonContentTypeMiddleware,
} from './middleware/index.js';
export type {
  Middleware,
  Next,
  CorsOptions,
  BodyParserOptions,
  RateLimitOptions,
  UploadedFile,
  ParsedMultipart,
  FileUploadOptions,
} from './middleware/index.js';

// Exception
export {
  GlobalExceptionHandler,
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
} from './exception/index.js';
export type { ExceptionFilter } from './exception/index.js';

// Context
export { requestContext, getContext, getTraceId } from './context/index.js';
export type { RequestContext } from './context/index.js';

// Config
export { ConfigService, field } from './config/index.js';
export type { ConfigSchema, ConfigField, PrimitiveType, Paths, ResolveType } from './config/index.js';

// Module
export { AppModule } from './module/index.js';

// Validation
export {
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
  validationPipe,
  VALIDATED_BODY_KEY,
  queryPipe,
  VALIDATED_QUERY_KEY,
  paramsPipe,
  VALIDATED_PARAMS_KEY,
} from './validation/index.js';
export type { ValidationError } from './validation/index.js';

// IoC
export { Container, injectable, inject, optional, TYPES } from './ioc/index.js';

// Utils
export { isDev, isProd, isTest } from './utils/env.js';
