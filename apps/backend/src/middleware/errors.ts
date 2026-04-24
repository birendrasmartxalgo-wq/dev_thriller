import { Elysia } from "elysia";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const errorPlugin = new Elysia({ name: "errors" }).onError(({ error, code, set, request }) => {
  if (error instanceof AppError) {
    set.status = error.status;
    return {
      type: `https://devthriller.app/problems/${error.code}`,
      title: error.code,
      status: error.status,
      detail: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  if (code === "VALIDATION") {
    set.status = 422;
    return {
      type: "https://devthriller.app/problems/validation",
      title: "validation_failed",
      status: 422,
      detail: (error as Error).message,
    };
  }

  if (code === "NOT_FOUND") {
    set.status = 404;
    return { type: "https://devthriller.app/problems/not_found", title: "not_found", status: 404, detail: "Route not found" };
  }

  logger.error({ err: error, path: new URL(request.url).pathname }, "unhandled error");
  set.status = 500;
  return {
    type: "https://devthriller.app/problems/internal",
    title: "internal",
    status: 500,
    detail: "Internal server error",
  };
});
