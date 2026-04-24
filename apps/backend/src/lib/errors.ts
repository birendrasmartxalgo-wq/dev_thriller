export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  badRequest: (code: string, message: string, details?: Record<string, unknown>) =>
    new AppError(400, code, message, details),
  unauthorized: (message = "Not authenticated") => new AppError(401, "unauthorized", message),
  forbidden: (message = "Forbidden") => new AppError(403, "forbidden", message),
  notFound: (resource = "Resource") => new AppError(404, "not_found", `${resource} not found`),
  conflict: (code: string, message: string) => new AppError(409, code, message),
  unprocessable: (code: string, message: string, details?: Record<string, unknown>) =>
    new AppError(422, code, message, details),
  tooMany: (message = "Too many requests") => new AppError(429, "rate_limited", message),
  internal: (message = "Internal error") => new AppError(500, "internal", message),
};
