import type { Request } from '../http/Request.js';
import type { Response } from '../http/Response.js';

/**
 * Контракт для фильтров исключений.
 *
 * Фильтры перехватывают конкретные типы ошибок и формируют HTTP-ответ.
 * Подключаются к приложению через `app.addExceptionFilter()`.
 * Если фильтр не обработал исключение — оно попадает в GlobalExceptionHandler.
 */
export interface ExceptionFilter {
  catch(exception: unknown, req: Request, res: Response): Promise<void>;
}
