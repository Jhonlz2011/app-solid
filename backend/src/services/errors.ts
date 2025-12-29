export class DomainError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'DomainError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'No autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Prohibido') {
    super(message, 403);
  }
}

