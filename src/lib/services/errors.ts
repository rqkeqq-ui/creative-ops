export interface ErrorDetail {
  field: string
  message: string
}

export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: ErrorDetail[],
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errors = {
  unauthorized: (message = 'Требуется авторизация') => new AppError('UNAUTHORIZED', 401, message),
  invalidCredentials: () => new AppError('INVALID_CREDENTIALS', 401, 'Неверный email или пароль'),
  forbidden: (message = 'Недостаточно прав для этого действия') => new AppError('FORBIDDEN', 403, message),
  notFound: (message = 'Задача не найдена') => new AppError('NOT_FOUND', 404, message),
  conflict: (code: string, message: string) => new AppError(code, 409, message),
  validation: (message = 'Проверьте заполнение полей', details?: ErrorDetail[]) =>
    new AppError('VALIDATION_ERROR', 422, message, details),
}

const DENY_STATUS: Record<string, number> = {
  FORBIDDEN: 403,
  INVALID_TRANSITION: 409,
  ASSIGNED_TO_OTHER: 409,
  NOT_ASSIGNEE: 403,
  COMMENT_REQUIRED: 422,
}

export function errorFromDeny(code: string, message: string): AppError {
  return new AppError(code, DENY_STATUS[code] ?? 409, message)
}