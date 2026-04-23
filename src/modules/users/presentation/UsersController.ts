import type { Request } from '../../../core/http/Request.js';
import type { Response } from '../../../core/http/Response.js';
import type { Router } from '../../../core/http/Router.js';
import { MiddlewarePipeline } from '../../../core/middleware/MiddlewarePipeline.js';
import { validationPipe, VALIDATED_BODY_KEY } from '../../../core/validation/ValidationPipe.js';
import type { RegisterUserUseCase } from '../application/RegisterUserUseCase.js';
import { RegisterUserDto } from './dto/RegisterUserDto.js';

/**
 * Контроллер пользователей.
 * Отвечает за приём HTTP-запросов, запуск валидации
 * и делегирование выполнения сценарию использования.
 */
export class UsersController {
  private readonly pipeline = new MiddlewarePipeline();

  /**
   * @param registerUseCase - сценарий регистрации нового пользователя
   */
  constructor(private readonly registerUseCase: RegisterUserUseCase) {}

  /**
   * Регистрирует маршруты контроллера в роутере приложения.
   * @param router - роутер, в который добавляются маршруты
   */
  register(router: Router): void {
    router.post('/users/register', (req, res) => this.handleRegister(req, res));
  }

  /**
   * Обрабатывает POST-запрос регистрации пользователя.
   * Пропускает запрос через пайплайн валидации, затем вызывает сценарий.
   * @param req - объект HTTP-запроса
   * @param res - объект HTTP-ответа
   */
  private async handleRegister(req: Request, res: Response): Promise<void> {
    await this.pipeline.run(
      req,
      res,
      [validationPipe(RegisterUserDto)],
      async () => {
        const dto = req.get<RegisterUserDto>(VALIDATED_BODY_KEY)!;

        const result = await this.registerUseCase.execute({
          email: dto.email,
          password: dto.password,
        });

        res.status(201).json(result);
      },
    );
  }
}
