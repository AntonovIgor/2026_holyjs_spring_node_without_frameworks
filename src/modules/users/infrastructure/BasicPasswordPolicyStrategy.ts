import type { IPasswordPolicyStrategy } from '../domain/IPasswordPolicyStrategy.js';

/**
 * Базовая стратегия политики паролей.
 * Предъявляет минимальное требование: длина пароля не менее 6 символов.
 * Подходит для демонстрационных и тестовых окружений.
 */
export class BasicPasswordPolicyStrategy implements IPasswordPolicyStrategy {
  /**
   * Проверяет пароль на соответствие базовой политике.
   * @param password - пароль в открытом виде
   * @returns массив нарушений; пустой массив — пароль допустим
   */
  validate(password: string): string[] {
    if (password.length < 6) {
      return ['must be at least 6 characters'];
    }
    return [];
  }
}
