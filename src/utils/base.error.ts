class BaseError extends Error {
  status: number;
  errors: any[];

  constructor(status: number, message: string, errors: any[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.name = this.constructor.name;
  }

  static BadRequest(message: string, errors: any[] = []) {
    return new BaseError(400, message, errors);
  }

  static UnauthorizedError(message = "Foydalanuvchiga ruxsat berilmagan") {
    return new BaseError(401, message);
  }

  static ForbiddenError(message = "Ruxsat berilmagan") {
    return new BaseError(403, message);
  }

  static NotFoundError(message: string) {
    return new BaseError(404, message);
  }

  static ConflictError(message: string) {
    return new BaseError(409, message);
  }

  static TooManyRequests(message: string) {
    return new BaseError(429, message);
  }

  static InternalServerError(message: string): Error {
    return new Error(`500 Internal Server Error: ${message}`);
  }
}

export default BaseError;
