/**
 * Доменное исключение: пароль не соответствует политике безопасности.
 * Содержит список конкретных нарушений для передачи клиенту.
 */
export class WeakPasswordException extends Error {
  /**
   * @param violations - список описаний нарушений политики пароля
   */
  constructor(readonly violations: string[]) {
    super(`Password does not meet policy requirements: ${violations.join('; ')}`);
    this.name = 'WeakPasswordException';
  }
}
