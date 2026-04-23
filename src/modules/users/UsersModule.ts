import { AppModule } from '../../core/module/AppModule.js';
import type { Router } from '../../core/http/Router.js';
import type { UsersController } from './presentation/UsersController.js';

/**
 * Модуль пользователей.
 * Объединяет все слои (домен, приложение, инфраструктура, презентация)
 * и регистрирует маршруты через контроллер.
 */
export class UsersModule extends AppModule {
  /**
   * @param controller - контроллер, обрабатывающий HTTP-запросы модуля
   */
  constructor(private readonly controller: UsersController) {
    super();
  }

  /**
   * Регистрирует маршруты модуля в роутере приложения.
   * @param router - роутер приложения
   */
  register(router: Router): void {
    this.controller.register(router);
  }
}
