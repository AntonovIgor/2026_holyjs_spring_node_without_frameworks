import { DatabaseSync } from 'node:sqlite';

import type { IUserRepository } from '../domain/IUserRepository.js';
import type { User } from '../domain/User.js';

/**
 * Строка таблицы users в базе данных SQLite.
 * Используется для маппинга между snake_case колонками и доменной сущностью.
 */
interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

/**
 * Реализация репозитория пользователей на основе встроенного SQLite.
 * Использует синхронный API node:sqlite для простоты демонстрации.
 */
export class SqliteUserRepository implements IUserRepository {
  private readonly db: DatabaseSync;

  /**
   * @param dbPath - путь к файлу базы данных; по умолчанию ':memory:' для тестов
   */
  constructor(dbPath = ':memory:') {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  }

  /**
   * Ищет пользователя по адресу электронной почты.
   * @param email - email для поиска
   * @returns доменная сущность или null, если пользователь не найден
   */
  async findByEmail(email: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as UserRow | undefined;
    return row ? this.toEntity(row) : null;
  }

  /**
   * Сохраняет нового пользователя в базу данных.
   * @param user - доменная сущность пользователя
   */
  async save(user: User): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
    );
    stmt.run(user.id, user.email, user.passwordHash, user.createdAt.toISOString());
  }

  /**
   * Преобразует строку из БД в доменную сущность.
   * @param row - строка таблицы users
   * @returns доменная сущность пользователя
   */
  private toEntity(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at),
    };
  }
}
