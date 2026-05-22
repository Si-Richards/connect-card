// Centralized error reporting for SSR & server routes.
// - Generates a short request ID per request
// - Captures uncaught errors via globalThis listeners (h3 swallows in-handler throws)
// - Stores a ring-buffer of recent errors keyed by request ID so they can be
//   inspected via /api/public/errors
// - Extracts the most likely offending module from the stack trace

type StackFrame = {
  file?: string;
  line?: number;
  column?: number;
};

export type CapturedError = {
  requestId: string;
  timestamp: string;
  url?: string;
  method?: string;
  name: string;
  message: string;
  stack?: string;
  topFrame?: StackFrame;
  likelyModule?: string;
};

const MAX_BUFFER = 50;
const buffer: CapturedError[] = [];

let lastUncaught: { error: unknown; at: number } | undefined;
const UNCAUGHT_TTL_MS = 5_000;

export function generateRequestId(): string {
  // 8 hex chars, no crypto dep needed on the worker
  return Math.random().toString(16).slice(2, 10).padEnd(8, "0");
}

function parseTopFrame(stack?: string): StackFrame | undefined {
  if (!stack) return undefined;
  for (const raw of stack.split("\n")) {
    const line = raw.trim();
    // Matches `at fn (file:line:col)` or `at file:line:col`
    const m =
      line.match(/\(([^)]+):(\d+):(\d+)\)\s*$/) ?? line.match(/at\s+(.+?):(\d+):(\d+)\s*$/);
    if (m) {
      const file = m[1];
      if (file.includes("node:internal") || file.includes("[native code]")) continue;
      return { file, line: Number(m[2]), column: Number(m[3]) };
    }
  }
  return undefined;
}

function guessModule(frame?: StackFrame): string | undefined {
  if (!frame?.file) return undefined;
  // Strip URL noise and surface a project-relative-ish path
  const match = frame.file.match(/\/(?:src|app|routes|lib|integrations)\/[^?#]+/);
  if (match) return match[0];
  return frame.file.split("?")[0];
}

export function toCapturedError(
  error: unknown,
  meta: { requestId: string; url?: string; method?: string },
): CapturedError {
  const err = error instanceof Error ? error : new Error(String(error));
  const topFrame = parseTopFrame(err.stack);
  return {
    requestId: meta.requestId,
    timestamp: new Date().toISOString(),
    url: meta.url,
    method: meta.method,
    name: err.name,
    message: err.message,
    stack: err.stack,
    topFrame,
    likelyModule: guessModule(topFrame),
  };
}

export function reportError(captured: CapturedError): void {
  buffer.push(captured);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  // Surface a single-line summary (full stack remains queryable via /api/public/errors)
  console.error(
    `[err ${captured.requestId}] ${captured.method ?? "-"} ${captured.url ?? "-"} :: ` +
      `${captured.name}: ${captured.message}` +
      (captured.likelyModule ? ` @ ${captured.likelyModule}` : ""),
  );
  if (captured.stack) console.error(captured.stack);
}

export function listRecentErrors(): CapturedError[] {
  return [...buffer].reverse();
}

export function clearRecentErrors(): void {
  buffer.length = 0;
}

// ---- Uncaught error capture (for h3-swallowed throws) ----

function recordUncaught(error: unknown) {
  lastUncaught = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) =>
    recordUncaught((event as ErrorEvent).error ?? event),
  );
  globalThis.addEventListener("unhandledrejection", (event) =>
    recordUncaught((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastUncaught) return undefined;
  if (Date.now() - lastUncaught.at > UNCAUGHT_TTL_MS) {
    lastUncaught = undefined;
    return undefined;
  }
  const { error } = lastUncaught;
  lastUncaught = undefined;
  return error;
}
