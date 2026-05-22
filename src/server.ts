import "./lib/error-capture";

import {
  consumeLastCapturedError,
  generateRequestId,
  reportError,
  toCapturedError,
} from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(requestId: string): Response {
  return new Response(renderErrorPage(requestId), {
    status: 500,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

async function normalizeCatastrophicSsrResponse(
  response: Response,
  requestId: string,
  request: Request,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  const raw = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  const captured = toCapturedError(raw, {
    requestId,
    url: request.url,
    method: request.method,
  });
  reportError(captured);
  return brandedErrorResponse(requestId);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const requestId = generateRequestId();
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response, requestId, request);
      // Echo request ID on every response so it's recoverable from the client.
      if (!normalized.headers.has("x-request-id")) {
        normalized.headers.set("x-request-id", requestId);
      }
      return normalized;
    } catch (error) {
      const captured = toCapturedError(error, {
        requestId,
        url: request.url,
        method: request.method,
      });
      reportError(captured);
      return brandedErrorResponse(requestId);
    }
  },
};
