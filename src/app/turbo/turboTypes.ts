export type TurboErrorType =
  "react" | "runtime" | "unhandled-rejection" | "resource";

export interface TurboError {
  id: string;
  type: TurboErrorType;
  message: string;
  stack?: string;
  componentStack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
}

export type TurboLogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface TurboLog {
  id: string;
  level: TurboLogLevel;
  args: unknown[];
  formattedMessage: string;
  timestamp: number;
  count: number;
}

export type TurboRequestStatus = "pending" | "success" | "error" | "aborted";

export interface TurboRequest {
  id: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  requestBody?: string;
  responseBody?: string;
  responseSize?: number;
  timestamp: number;
  networkStatus: TurboRequestStatus;
  error?: string;
}

export type TurboTab =
  "overview" | "errors" | "console" | "network" | "preview";
