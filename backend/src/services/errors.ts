import type { ApiFieldError, ApiErrorCode } from '@app/schema/errors';

export class DomainError extends Error {
  public readonly code: ApiErrorCode;
  public readonly fieldErrors: ApiFieldError[];

  constructor(
    message: string,
    public status = 400,
    options?: { code?: ApiErrorCode; fieldErrors?: ApiFieldError[] }
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = options?.code ?? 'INTERNAL_ERROR';
    this.fieldErrors = options?.fieldErrors ?? [];
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'No autorizado') {
    super(message, 401, { code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Prohibido') {
    super(message, 403, { code: 'FORBIDDEN' });
  }
}

