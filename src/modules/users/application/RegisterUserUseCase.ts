import { randomUUID } from 'node:crypto';

import type { IUserRepository } from '../domain/IUserRepository.js';
import type { IPasswordHasher } from '../domain/IPasswordHasher.js';
import type { IPasswordPolicyStrategy } from '../domain/IPasswordPolicyStrategy.js';
import { UserAlreadyExistsException } from '../domain/UserAlreadyExistsException.js';
import { WeakPasswordException } from '../domain/WeakPasswordException.js';

/**
 * Входные данные для сценария регистрации пользователя.
 */
export interface RegisterUserRequest {
  /** Электронная почта нового пользователя */
  email: string;
  /** Пароль в открытом виде */
  password: string;
}

/**
 * Результат успешной регистрации пользователя.
 */
export interface RegisterUserResponse {
  /** Уникальный идентификатор созданного пользователя */
  id: string;
  /** Электронная почта созданного пользователя */
  email: string;
  /** Дата и время создания в формате ISO 8601 */
  createdAt: string;
}

/**
 * Сценарий использования: регистрация нового пользователя.
 * Оркестрирует проверку политики пароля, уникальности email,
 * хэширование пароля и сохранение сущности.
 */
export class RegisterUserUseCase {
  /**
   * @param userRepository - порт репозитория пользователей
   * @param passwordHasher - порт хэширования паролей
   * @param passwordPolicy - стратегия проверки политики паролей
   */
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly passwordPolicy: IPasswordPolicyStrategy,
  ) {}

  /**
   * Выполняет регистрацию нового пользователя.
   * @param request - входные данные с email и паролем
   * @returns данные созданного пользователя
   * @throws WeakPasswordException если пароль не соответствует политике
   * @throws UserAlreadyExistsException если email уже занят
   */
  async execute(request: RegisterUserRequest): Promise<RegisterUserResponse> {
    const violations = this.passwordPolicy.validate(request.password);
    if (violations.length > 0) {
      throw new WeakPasswordException(violations);
    }

    const existing = await this.userRepository.findByEmail(request.email);
    if (existing) {
      throw new UserAlreadyExistsException(request.email);
    }

    const passwordHash = await this.passwordHasher.hash(request.password);

    const user = {
      id: randomUUID(),
      email: request.email,
      passwordHash,
      createdAt: new Date(),
    };

    await this.userRepository.save(user);

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
