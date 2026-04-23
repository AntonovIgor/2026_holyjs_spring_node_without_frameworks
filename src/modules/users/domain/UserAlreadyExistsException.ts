/**
 * Доменное исключение: пользователь с таким email уже зарегистрирован.
 * Выбрасывается сценарием использования при попытке повторной регистрации.
 */
export class UserAlreadyExistsException extends Error {
  /**
   * @param email - адрес электронной почты, который уже занят
   */
  constructor(email: string) {
    super(`User with email "${email}" already exists`);
    this.name = 'UserAlreadyExistsException';
  }
}
