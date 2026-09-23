import { useTurboStore } from "./turboStore";
import type { TurboLogLevel, TurboRequest } from "./turboTypes";

let isIntercepting = false;
let isInitialized = false;

function safeFormatArg(arg: unknown): string {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg === "string") return arg;
  if (
    typeof arg === "number" ||
    typeof arg === "boolean" ||
    typeof arg === "symbol"
  ) {
    return String(arg);
  }
  if (typeof arg === "bigint") return `${arg}n`;
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}\n${arg.stack || ""}`;
  }
  if (typeof arg === "function") {
    return `[Function: ${arg.name || "anonymous"}]`;
  }
  if (typeof arg === "object") {
    try {
      const seen = new WeakSet();
      return JSON.stringify(
        arg,
        (_key, val) => {
          if (typeof val === "object" && val !== null) {
            if (seen.has(val)) return "[Circular]";
            seen.add(val);
          }
          return val;
        },
        2,
      );
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function truncateString(str: string, maxLen = 4000): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `... [truncated ${str.length - maxLen} chars]`;
}

export function setupTurboInterceptors(): void {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  // 1. Console interceptors
  const levels: TurboLogLevel[] = ["log", "info", "warn", "error", "debug"];
  levels.forEach((level) => {
    const original = console[level];
    if (typeof original !== "function") return;

    console[level] = function (...args: unknown[]) {
      // Call original first so developer still gets native DevTools experience
      try {
        original.apply(console, args);
      } catch {
        // Ignore native logging errors
      }

      if (isIntercepting) return;
      isIntercepting = true;

      try {
        const formatted = args.map(safeFormatArg).join(" ");
        useTurboStore.getState().addLog(level, args, truncateString(formatted));
      } catch {
        // Prevent interceptor from breaking app code
      } finally {
        isIntercepting = false;
      }
    };
  });

  // 2. Window runtime error interceptor
  window.addEventListener("error", (event: ErrorEvent) => {
    if (isIntercepting) return;
    isIntercepting = true;
    try {
      if (event.error) {
        const err =
          event.error instanceof Error
            ? event.error
            : new Error(String(event.message));
        useTurboStore.getState().addError({
          type: "runtime",
          message: err.message || event.message || "Runtime Error",
          stack: err.stack,
          source: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      } else if (event.message) {
        useTurboStore.getState().addError({
          type: "runtime",
          message: event.message,
          source: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      }
    } catch {
      // Ignore
    } finally {
      isIntercepting = false;
    }
  });

  // 3. Resource load errors (images, scripts, styles)
  window.addEventListener(
    "error",
    (event: Event) => {
      if (isIntercepting) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target !== (window as unknown as HTMLElement) &&
        target.tagName
      ) {
        const src =
          (target as HTMLImageElement | HTMLScriptElement).src ||
          (target as HTMLLinkElement).href;
        isIntercepting = true;
        try {
          useTurboStore.getState().addError({
            type: "resource",
            message: `Failed to load resource: <${target.tagName.toLowerCase()}> ${src || ""}`,
            source: src,
          });
        } catch {
          // Ignore
        } finally {
          isIntercepting = false;
        }
      }
    },
    true,
  );

  // 4. Unhandled Promise Rejections
  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      if (isIntercepting) return;
      isIntercepting = true;
      try {
        const reason = event.reason;
        let message = "Unhandled Promise Rejection";
        let stack: string | undefined;

        if (reason instanceof Error) {
          message = reason.message || "Error with no message";
          stack = reason.stack;
        } else if (typeof reason === "string") {
          message = reason;
        } else if (reason && typeof reason === "object") {
          try {
            message = JSON.stringify(reason);
          } catch {
            message = String(reason);
          }
        }

        useTurboStore.getState().addError({
          type: "unhandled-rejection",
          message,
          stack,
        });
      } catch {
        // Ignore
      } finally {
        isIntercepting = false;
      }
    },
  );

  // 5. Security & CSP Violations
  window.addEventListener(
    "securitypolicyviolation",
    (event: SecurityPolicyViolationEvent) => {
      if (isIntercepting) return;
      isIntercepting = true;
      try {
        useTurboStore.getState().addError({
          type: "resource",
          message: `Security/CSP Policy: blocked ${event.blockedURI || "resource"} (directive: ${event.effectiveDirective || "unknown"})`,
          source: event.blockedURI,
        });
      } catch {
        // Ignore
      } finally {
        isIntercepting = false;
      }
    },
  );

  // 6. Fetch API Interceptor
  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch;
    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const startTime = performance.now();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      let url = "";
      let method = "GET";
      let requestBody: string | undefined;

      try {
        if (typeof input === "string") {
          url = input;
        } else if (input instanceof URL) {
          url = input.toString();
        } else if (input instanceof Request) {
          url = input.url;
          method = input.method || "GET";
        }

        if (init?.method) {
          method = init.method.toUpperCase();
        }

        if (init?.body) {
          if (typeof init.body === "string") {
            requestBody = truncateString(init.body);
          } else if (init.body instanceof FormData) {
            requestBody = "[FormData Payload]";
          } else if (init.body instanceof Blob) {
            requestBody = `[Blob: ${init.body.size} bytes]`;
          } else {
            requestBody = safeFormatArg(init.body);
          }
        }
      } catch {
        // Fallback for reading input metadata
      }

      const newRequest: TurboRequest = {
        id: requestId,
        method: method.toUpperCase(),
        url: url || "unknown",
        timestamp: Date.now(),
        networkStatus: "pending",
        requestBody,
      };

      try {
        useTurboStore.getState().addRequest(newRequest);
      } catch {
        // Ignore
      }

      try {
        const response = await originalFetch.apply(window, [input, init]);
        const durationMs = Math.round(performance.now() - startTime);

        // Safely clone response to inspect body without consuming the actual stream
        let responseBody: string | undefined;
        let responseSize: number | undefined;

        try {
          const clone = response.clone();
          const text = await clone.text();
          responseSize = new Blob([text]).size;
          responseBody = truncateString(text);
        } catch {
          responseBody = "[Binary or Unreadable Stream]";
        }

        useTurboStore.getState().updateRequest(requestId, {
          status: response.status,
          statusText: response.statusText,
          durationMs,
          responseBody,
          responseSize,
          networkStatus: response.ok ? "success" : "error",
        });

        return response;
      } catch (err: unknown) {
        const durationMs = Math.round(performance.now() - startTime);
        const errMsg = err instanceof Error ? err.message : String(err);

        useTurboStore.getState().updateRequest(requestId, {
          durationMs,
          networkStatus: "error",
          error: errMsg,
        });

        throw err;
      }
    };
  }

  // 6. XMLHttpRequest Interceptor
  if (typeof window.XMLHttpRequest === "function") {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    interface ExtendedXHR extends XMLHttpRequest {
      _turboId?: string;
      _turboMethod?: string;
      _turboUrl?: string;
      _turboStartTime?: number;
      _turboRequestBody?: string;
    }

    XMLHttpRequest.prototype.open = function (
      this: ExtendedXHR,
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      this._turboId = `xhr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      this._turboMethod = String(method).toUpperCase();
      this._turboUrl = typeof url === "string" ? url : url.toString();

      return originalOpen.call(
        this,
        method,
        url,
        async !== false,
        username,
        password,
      );
    };

    XMLHttpRequest.prototype.send = function (
      this: ExtendedXHR,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const id = this._turboId;

      if (id) {
        this._turboStartTime = performance.now();
        let formattedBody: string | undefined;

        if (typeof body === "string") {
          formattedBody = truncateString(body);
        } else if (body) {
          formattedBody = safeFormatArg(body);
        }

        this._turboRequestBody = formattedBody;

        useTurboStore.getState().addRequest({
          id,
          method: this._turboMethod || "GET",
          url: this._turboUrl || "unknown",
          timestamp: Date.now(),
          networkStatus: "pending",
          requestBody: formattedBody,
        });

        const onFinished = (statusType: "success" | "error" | "aborted") => {
          const duration = this._turboStartTime
            ? Math.round(performance.now() - this._turboStartTime)
            : 0;
          let respText: string | undefined;
          try {
            respText = truncateString(this.responseText || "");
          } catch {
            respText = "[Binary Data]";
          }

          useTurboStore.getState().updateRequest(id, {
            status: this.status,
            statusText: this.statusText,
            durationMs: duration,
            responseBody: respText,
            networkStatus: statusType,
          });
        };

        this.addEventListener("load", () => {
          onFinished(
            this.status >= 200 && this.status < 400 ? "success" : "error",
          );
        });
        this.addEventListener("error", () => onFinished("error"));
        this.addEventListener("abort", () => onFinished("aborted"));
      }

      return originalSend.call(this, body);
    };
  }
}
