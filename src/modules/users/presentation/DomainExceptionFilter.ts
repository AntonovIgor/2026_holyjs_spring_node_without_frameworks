import type { ExceptionFilter } from '../../../core/exception/types.js';
import type { Request } from '../../../core/http/Request.js';
import type { Response } from '../../../core/http/Response.js';
import { UserAlreadyExistsException } from '../domain/UserAlreadyExistsException.js';
import { WeakPasswordException } from '../domain/WeakPasswordException.js';

/**
 * Фильтр доменных исключений модуля пользователей.
 * Перехватывает известные доменные ошибки и преобразует их
 * в соответствующие HTTP-ответы с понятными кодами статуса.
 */
export class DomainExceptionFilter implements ExceptionFilter {
  /**
   * Обрабатывает исключение и формирует HTTP-ответ.
   * @param exception - перехваченное исключение любого типа
   * @param _req - объект HTTP-запроса (не используется)
   * @param res - объект HTTP-ответа для отправки результата
   */
  async catch(exception: unknown, _req: Request, res: Response): Promise<void> {
    if (exception instanceof UserAlreadyExistsException) {
      res.status(409).json({
        statusCode: 409,
        message: exception.message,
      });
      return;
    }

    if (exception instanceof WeakPasswordException) {
      res.status(422).json({
        statusCode: 422,
        message: 'Password does not meet policy requirements',
        details: exception.violations,
      });
      return;
    }
  }
}
