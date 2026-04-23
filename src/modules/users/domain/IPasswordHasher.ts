/**
 * Порт хэширования паролей.
 * Абстрагирует алгоритм хэширования от бизнес-логики,
 * позволяя легко менять реализацию (scrypt, bcrypt, argon2 и др.).
 */
export interface IPasswordHasher {
  /**
   * Хэширует открытый пароль.
   * @param password - открытый пароль пользователя
   * @returns строка с солью и хэшем, готовая для хранения
   */
  hash(password: string): Promise<string>;

  /**
   * Проверяет, соответствует ли открытый пароль сохранённому хэшу.
   * @param password - открытый пароль для проверки
   * @param hash - ранее сохранённый хэш с солью
   * @returns true, если пароль верный
   */
  verify(password: string, hash: string): Promise<boolean>;
}
