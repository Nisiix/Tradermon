// Tipi di core.js per il gioco (TypeScript): il file JavaScript resta l'unica fonte delle regole.
export const SYMBOL_RE: RegExp;
export function validKeys(keyId: unknown, secret: unknown): boolean;
export interface CoreKeys { keyId: string; secret: string }
export interface CoreConfig {
  trading: { paper: string };
  data: string;
  keysOf: (env: string) => CoreKeys | null;
  dataEnv: () => string;
  audit?: (entry: Record<string, unknown>) => unknown;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
}
export interface CoreRequest {
  method: string;
  parts: string[];
  query: URLSearchParams;
  header: (name: string) => string | null | undefined;
  body: () => Promise<unknown>;
}
export function createCore(cfg: CoreConfig): {
  // deno-lint-ignore no-explicit-any
  alpaca(env: string, method: string, url: string, body?: unknown): Promise<any>;
  latestPrice(symbol: string, isCrypto: boolean): Promise<{ price: number }>;
  // deno-lint-ignore no-explicit-any
  handle(rq: CoreRequest): Promise<{ status: number; body: any } | null>;
};
