import 'reflect-metadata';

import { IsEmail, IsString, MinLength } from '../../../../core/validation/decorators.js';

/**
 * DTO для запроса регистрации пользователя.
 * Декораторы валидации описывают ограничения прямо на классе,
 * что делает контракт API самодокументируемым.
 */
export class RegisterUserDto {
  /** Электронная почта пользователя; должна быть валидным email-адресом */
  @IsEmail()
  email!: string;

  /** Пароль пользователя; минимальная длина — 6 символов */
  @IsString()
  @MinLength(6)
  password!: string;
}
