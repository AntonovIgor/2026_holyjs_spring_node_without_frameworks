import type { IPasswordPolicyStrategy } from '../domain/IPasswordPolicyStrategy.js';

/**
 * Строгая стратегия политики паролей.
 * Требует минимум 8 символов, наличие заглавной буквы,
 * цифры и специального символа.
 * Демонстрирует замену стратегии без изменения бизнес-логики.
 */
export class StrictPasswordPolicyStrategy implements IPasswordPolicyStrategy {
  /**
   * Проверяет пароль на соответствие строгой политике.
   * @param password - пароль в открытом виде
   * @returns массив нарушений; пустой массив — пароль допустим
   */
  validate(password: string): string[] {
    const violations: string[] = [];

    if (password.length < 8) {
      violations.push('must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      violations.push('must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      violations.push('must contain at least one digit');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      violations.push('must contain at least one special character');
    }

    return violations;
  }
}
