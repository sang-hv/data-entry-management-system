export class ActionError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number = 400,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ActionError'
  }
}

export class ValidationError extends ActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION', message, 400, details)
  }
}

export class NotFoundError extends ActionError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} ${id} not found`, 404, { entity, id })
  }
}

export class ConflictError extends ActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details)
  }
}

export class ForbiddenError extends ActionError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
  }
}

export class UnauthorizedError extends ActionError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class OptimisticLockError extends ActionError {
  constructor() {
    super('STALE_VERSION', 'Resource was modified by another request, please reload', 409)
  }
}
