export class AppError extends Error {
  constructor(
    message: string,
    public readonly code = "APP_ERROR",
    public readonly statusCode = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InputValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "INPUT_VALIDATION_ERROR", 400, details);
  }
}

export class ResourceNotFoundError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "RESOURCE_NOT_FOUND", 404, details);
  }
}

export class AcbrIntegrationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "ACBR_INTEGRATION_ERROR", 502, details);
  }
}
