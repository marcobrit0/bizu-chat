import { messages as ui } from "@/lib/i18n/messages";

export type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "offline";

export type Surface =
  | "chat"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "vote"
  | "document"
  | "suggestions"
  | "activate_gateway";

export type ErrorCode = `${ErrorType}:${Surface}`;

export type ErrorVisibility = "response" | "log" | "none";

export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  activate_gateway: "response",
  api: "response",
  auth: "response",
  chat: "response",
  database: "log",
  document: "response",
  history: "response",
  stream: "response",
  suggestions: "response",
  vote: "response",
};

export class ChatbotError extends Error {
  type: ErrorType;
  surface: Surface;
  statusCode: number;

  constructor(errorCode: ErrorCode, cause?: string | ErrorOptions) {
    const message = getMessageByErrorCode(errorCode);
    const options = typeof cause === "string" ? undefined : cause;

    super(message, options);

    const [type, surface] = errorCode.split(":");

    this.type = type as ErrorType;
    if (typeof cause === "string") {
      this.cause = cause;
    }
    this.surface = surface as Surface;
    this.statusCode = getStatusCodeByType(this.type);
  }

  toResponse() {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { message, cause, statusCode } = this;

    // Log-only surfaces hide internals from the client.
    if (visibility === "log") {
      console.error({
        cause,
        code,
        message,
      });

      return Response.json(
        { code: "", message: ui.errors.generic },
        { status: statusCode }
      );
    }

    return Response.json({ cause, code, message }, { status: statusCode });
  }
}

export function getMessageByErrorCode(errorCode: ErrorCode): string {
  if (errorCode.includes("database")) {
    return ui.errors.database;
  }

  switch (errorCode) {
    case "bad_request:api":
      return ui.errors.badRequestApi;

    case "bad_request:activate_gateway":
      return ui.errors.activateGateway;

    case "unauthorized:auth":
      return ui.errors.unauthorizedAuth;
    case "forbidden:auth":
      return ui.errors.forbiddenAuth;

    case "rate_limit:chat":
      return ui.errors.rateLimitChat;
    case "not_found:chat":
      return ui.errors.notFoundChat;
    case "forbidden:chat":
      return ui.errors.forbiddenChat;
    case "unauthorized:chat":
      return ui.errors.unauthorizedChat;
    case "offline:chat":
      return ui.errors.offlineChat;

    case "not_found:document":
      return ui.errors.notFoundDocument;
    case "forbidden:document":
      return ui.errors.forbiddenDocument;
    case "unauthorized:document":
      return ui.errors.unauthorizedDocument;
    case "bad_request:document":
      return ui.errors.badRequestDocument;

    default:
      return ui.errors.generic;
  }
}

function getStatusCodeByType(type: ErrorType) {
  switch (type) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "offline":
      return 503;
    default:
      return 500;
  }
}
