import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { IPasswordHasher } from '../domain/IPasswordHasher.js';

const scryptAsync = promisify(scrypt);

/** Длина соли в байтах */
const SALT_LEN = 16;

/** Длина производного ключа в байтах */
const KEY_LEN = 64;

/**
 * Реализация хэширования паролей на основе алгоритма scrypt.
 * Использует случайную соль и защищённое сравнение для предотвращения timing-атак.
 */
export class ScryptPasswordHasher implements IPasswordHasher {
  /**
   * Хэширует пароль с использованием случайной соли и алгоритма scrypt.
   * Результат хранится в формате `<соль>:<ключ>` в шестнадцатеричном представлении.
   * @param password - открытый пароль
   * @returns строка формата `salt:key`
   */
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LEN).toString('hex');
    const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
    return `${salt}:${key.toString('hex')}`;
  }

  /**
   * Проверяет пароль по сохранённому хэшу.
   * Использует timingSafeEqual для защиты от timing-атак.
   * @param password - открытый пароль для проверки
   * @param hash - ранее сохранённый хэш в формате `salt:key`
   * @returns true, если пароль совпадает с хэшем
   */
  async verify(password: string, hash: string): Promise<boolean> {
    const [salt, stored] = hash.split(':');
    if (!salt || !stored) {
      return false;
    }

    const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
    const storedBuf = Buffer.from(stored, 'hex');

    return key.length === storedBuf.length && timingSafeEqual(key, storedBuf);
  }
}
