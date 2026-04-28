# clean-node-framework

Учебный пример для доклада на HolyJS 2026 — «Чистый бэкенд на Node.js без фреймворков».

Проект демонстрирует, как выстроить чистую архитектуру в Node.js-приложении:
- HTTP-сервер и маршрутизация — на нативных API Node.js без express
- Внутренний мини-фреймворк с middleware, IoC и валидацией
- Бизнес-логика, полностью изолированная от инфраструктуры

---

## Быстрый старт

```bash
node --version   # нужен Node.js >= 24
npm install
cp .env.example .env   # или создайте .env вручную

npm run dev      # dev-режим с hot reload
npm run build    # TypeScript → dist/
npm start        # запуск из dist/
npm test         # unit-тесты
npm run test:e2e # e2e-тесты
```

---

## Структура проекта

```
src/
├── core/                  # мини-фреймворк
│   ├── config/            # типобезопасная конфигурация
│   ├── context/           # RequestContext через AsyncLocalStorage
│   ├── exception/         # HTTP-исключения и глобальный обработчик
│   ├── http/              # Application, Request, Response, Router, HttpClient
│   ├── ioc/               # IoC-контейнер (Inversify)
│   ├── logger/            # Logger interface + PinoLogger
│   ├── middleware/        # MiddlewarePipeline + встроенные middleware
│   ├── module/            # AppModule
│   └── validation/        # декораторы + ValidationPipe
└── modules/
    └── users/             # модуль Users (пример чистой архитектуры)
        ├── domain/        # сущности, интерфейсы, доменные исключения
        ├── application/   # use case-ы
        ├── infrastructure/# реализации репозиториев и сервисов
        └── presentation/  # контроллеры, фильтры, DTO
```

---

## Абстракции фреймворка

### `Application`

Центральный класс. Принимает middleware, регистрирует модули, запускает HTTP-сервер.
Поддерживает graceful shutdown: при остановке ждёт завершения всех активных запросов.

```typescript
const app = new Application({ drainTimeoutMs: 10_000 });
app.use(new LoggerMiddleware()).registerModule(usersModule);
await app.listen(3000);
```

---

### `Request` / `Response`

Тонкие обёртки над `IncomingMessage` и `ServerResponse`.

`Request` добавляет:
- Ленивое чтение тела с ограничением размера
- `AbortSignal` для отмены долгих операций
- Типобезопасное хранилище для данных middleware (`.set()` / `.get()`)

`Response` предоставляет fluent API:
```typescript
res.status(201).json({ id: user.id });
res.setCookie('session', token, { httpOnly: true, secure: true });
```

---

### `Router`

Маршрутизатор на базе нативного `URLPattern` API (Node.js 22+).
Поддерживает параметры пути: `/users/:id`.

```typescript
router.get('/users/:id', async (req, res) => {
  res.json({ id: req.params.id });
});
```

---

### `Middleware` / `MiddlewarePipeline`

Контракт middleware и движок для их выполнения.

```typescript
interface Middleware {
  readonly name: string;
  handle(req: Request, res: Response, next: Next): Promise<void>;
}
```

`MiddlewarePipeline` реализует паттерн «цепочка обязанностей»:
вызов `next()` передаёт управление следующему звену. Перед каждым шагом
проверяется `AbortSignal` запроса.

---

### `AppModule`

Абстрактный базовый класс для модулей. Инкапсулирует регистрацию маршрутов
и управление жизненным циклом (подключение к БД при старте, освобождение ресурсов при остановке).

```typescript
export class UsersModule extends AppModule {
  register(router: Router): void { /* регистрируем маршруты */ }
  async onStart(): Promise<void> { /* открываем соединение с БД */ }
  async onStop(): Promise<void> { /* закрываем соединение */ }
}
```

---

### `HttpException` и подклассы

Базовый класс для HTTP-ошибок. `GlobalExceptionHandler` превращает их
в JSON-ответы с правильным статусом.

Готовые классы: `BadRequestException` (400), `UnauthorizedException` (401),
`ForbiddenException` (403), `NotFoundException` (404), `ConflictException` (409),
`UnprocessableEntityException` (422), `PayloadTooLargeException` (413),
`UnsupportedMediaTypeException` (415), `RequestTimeoutException` (408),
`TooManyRequestsException` (429), `InternalServerErrorException` (500).

---

### `ExceptionFilter`

Интерфейс фильтра исключений. Позволяет перехватывать конкретные типы ошибок
до того, как их обработает `GlobalExceptionHandler`.

```typescript
export class DomainExceptionFilter implements ExceptionFilter {
  async catch(exception: unknown, _req: Request, res: Response): Promise<void> {
    if (exception instanceof UserAlreadyExistsException) {
      res.status(409).json({ message: exception.message });
    }
  }
}
```

---

### `RequestContext`

Хранит данные запроса (traceId, логгер, userId) в `AsyncLocalStorage`.
Благодаря этому контекст доступен из любой части кода в рамках запроса
без явной передачи параметров.

```typescript
import { getTraceId, getLogger } from './core/context/RequestContext.js';

const logger = getLogger(); // доступен из любого места в цепочке вызовов
```

---

### `Logger` / `PinoLogger`

`Logger` — минимальный интерфейс (debug/info/warn/error + child).
`PinoLogger` — реализация на базе [pino](https://github.com/pinojs/pino):
JSON в production, pretty-вывод в development.

---

### `ConfigService`

Типобезопасный сервис конфигурации. Читает значения из переменных окружения,
JSON-файла и дефолтов. Метод `get()` возвращает значение с правильным TypeScript-типом.

```typescript
const config = new ConfigService({
  db: { port: field({ env: 'DB_PORT', type: 'number', default: 5432 }) },
});
const port = config.get('db.port'); // тип: number
```

---

### `HttpClient`

HTTP-клиент с автоматическим проброском `x-trace-id` из текущего `RequestContext`.
Помогает отслеживать цепочку вызовов между микросервисами.

---

### Декораторы валидации + `ValidationPipe`

Декораторы (`@IsEmail()`, `@IsString()`, `@MinLength()` и др.) описывают правила
валидации прямо на DTO-классе. `validationPipe()` превращает это в middleware:

```typescript
router.post('/users', validationPipe(RegisterUserDto), handler);
const dto = req.get<RegisterUserDto>(VALIDATED_BODY_KEY)!;
```

Аналогично работают `queryPipe()` и `paramsPipe()` для query-параметров и path-параметров.

---

### Встроенные middleware

| Класс | Назначение |
|---|---|
| `BodyParserMiddleware` | Ограничивает размер тела запроса |
| `CompressionMiddleware` | Сжатие ответов (Brotli / Gzip) |
| `CookieMiddleware` | Парсинг заголовка Cookie |
| `CorsMiddleware` | CORS-заголовки и preflight |
| `FileUploadMiddleware` | Загрузка файлов (multipart/form-data) |
| `JsonContentTypeMiddleware` | Проверка Content-Type: application/json |
| `LoggerMiddleware` | Логирование начала/конца запроса |
| `RateLimitMiddleware` | Rate limiting (token bucket) |
| `RequestTimeoutMiddleware` | Таймаут обработки запроса |
| `SecurityHeadersMiddleware` | Базовые заголовки безопасности |
| `StaticFilesMiddleware` | Отдача статических файлов с ETag |
| `TraceMiddleware` | traceId + RequestContext (без Application) |

---

## Модуль Users — пример чистой архитектуры

### Доменный слой (`domain/`)

- **`User`** — доменная сущность (id, email, passwordHash, createdAt)
- **`IUserRepository`** — интерфейс репозитория (findByEmail, save)
- **`IPasswordHasher`** — интерфейс хэширования паролей (hash, verify)
- **`IPasswordPolicyStrategy`** — стратегия политики паролей (validate)
- **`UserAlreadyExistsException`** — доменное исключение: пользователь уже существует
- **`WeakPasswordException`** — доменное исключение: пароль не соответствует политике

Доменный слой не зависит ни от чего — только от стандартных типов TypeScript.

---

### Слой приложения (`application/`)

- **`RegisterUserUseCase`** — оркестрирует регистрацию: проверяет политику пароля,
  ищет дубликат email, хэширует пароль, сохраняет пользователя.

Use case зависит только от интерфейсов домена — конкретные реализации
подставляются снаружи (Dependency Inversion).

---

### Инфраструктурный слой (`infrastructure/`)

- **`SqliteUserRepository`** — хранит пользователей в SQLite (встроенный `node:sqlite`)
- **`ScryptPasswordHasher`** — хэширует пароли через `scrypt` (встроенный `node:crypto`)
- **`BasicPasswordPolicyStrategy`** — простая политика: минимум 6 символов
- **`StrictPasswordPolicyStrategy`** — строгая политика: длина, буквы, цифры, спецсимволы

---

### Презентационный слой (`presentation/`)

- **`UsersController`** — регистрирует маршруты, запускает валидацию через `validationPipe`, вызывает use case
- **`DomainExceptionFilter`** — превращает доменные исключения в HTTP-ответы (409, 422)
- **`RegisterUserDto`** — DTO с декораторами `@IsEmail()`, `@IsString()`, `@MinLength()`

---

## Зависимости

| Пакет | Назначение |
|---|---|
| `pino` | Структурированное логирование |
| `pino-pretty` | Читаемый вывод в dev-режиме |
| `inversify` + `reflect-metadata` | IoC-контейнер |
| `formidable` | Парсинг multipart/form-data |
