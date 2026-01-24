export type ErrorLogSource = "gh" | "ai-claude" | "ai-codex" | "system";

export interface ErrorLog {
  id: string;
  timestamp: string;
  source: ErrorLogSource;
  command: string;
  args?: string[];
  error: string;
  stderr?: string;
  context?: Record<string, unknown>;
}

export interface ErrorLogState {
  logs: ErrorLog[];
  maxLogs: number;
  addLog: (log: Omit<ErrorLog, "id" | "timestamp">) => void;
  clearLogs: () => void;
  clearLogsForSource: (source: ErrorLogSource) => void;
  getLogs: (source?: ErrorLogSource) => ErrorLog[];
}
