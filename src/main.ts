import 'reflect-metadata';

import { Application } from './core/http/Application.js';
import { BodyParserMiddleware } from './core/middleware/built-in/BodyParserMiddleware.js';
import { JsonContentTypeMiddleware } from './core/middleware/built-in/JsonContentTypeMiddleware.js';
import { LoggerMiddleware } from './core/middleware/built-in/LoggerMiddleware.js';

// Инфраструктура
import { SqliteUserRepository } from './modules/users/infrastructure/SqliteUserRepository.js';
import { ScryptPasswordHasher } from './modules/users/infrastructure/ScryptPasswordHasher.js';
import { StrictPasswordPolicyStrategy } from './modules/users/infrastructure/StrictPasswordPolicyStrategy.js';

// Бизнес-логика (application layer)
import { RegisterUserUseCase } from './modules/users/application/RegisterUserUseCase.js';

// Презентационный слой
import { UsersController } from './modules/users/presentation/UsersController.js';
import { DomainExceptionFilter } from './modules/users/presentation/DomainExceptionFilter.js';

// Модуль
import { UsersModule } from './modules/users/UsersModule.js';

// --- Корень зависимостей (Composition Root) ---

const userRepository = new SqliteUserRepository(':memory:');
const passwordHasher = new ScryptPasswordHasher();
const passwordPolicy = new StrictPasswordPolicyStrategy();

const registerUserUseCase = new RegisterUserUseCase(
  userRepository,
  passwordHasher,
  passwordPolicy,
);

const usersController = new UsersController(registerUserUseCase);
const usersModule = new UsersModule(usersController);

// --- Запуск приложения ---

const app = new Application();

app
  .use(new LoggerMiddleware())
  .use(new BodyParserMiddleware())
  .use(new JsonContentTypeMiddleware())
  .addExceptionFilter(new DomainExceptionFilter())
  .registerModule(usersModule);

const PORT = Number(process.env['PORT'] ?? 3000);

await app.listen(PORT);

app.logger.info(`Server started on port ${PORT}`);
