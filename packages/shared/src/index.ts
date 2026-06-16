/**
 * @sangfor/workflow-shared — 공통 타입 및 유틸리티
 */

// ─── ID 생성 ────────────────────────────────────────────────────────────────

export function nowId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

// ─── 제품 코드 ──────────────────────────────────────────────────────────────

export type ProductCode = 'HCI_SCP' | 'IAG' | 'ENDPOINT_SECURE' | 'CYBER_COMMAND' | 'NDR';

export const PRODUCTS: ProductCode[] = ['HCI_SCP', 'IAG', 'ENDPOINT_SECURE', 'CYBER_COMMAND', 'NDR'];

export function normalizeProduct(input: string): ProductCode {
  const upper = input.toUpperCase().replace(/[-\s]/g, '_');
  if (upper.includes('HCI') || upper.includes('SCP')) return 'HCI_SCP';
  if (upper.includes('IAG')) return 'IAG';
  if (upper.includes('ENDPOINT') || upper.includes('EPP') || upper.includes('ES')) return 'ENDPOINT_SECURE';
  if (upper.includes('CYBER') || upper.includes('CC') || upper.includes('NDR')) return 'CYBER_COMMAND';
  if (upper.includes('NDR')) return 'NDR';
  throw new Error(`Unknown product: ${input}`);
}

// ─── 위험 수준 ──────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ─── 시간 유틸리티 ──────────────────────────────────────────────────────────

export function nowISO(): string {
  return new Date().toISOString();
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

// ─── 파일 경로 유틸리티 ─────────────────────────────────────────────────────

export function ensureDir(path: string): void {
  const { mkdirSync } = require('node:fs');
  mkdirSync(path, { recursive: true });
}

export function fileExists(path: string): boolean {
  const { existsSync } = require('node:fs');
  return existsSync(path);
}

// ─── 로깅 ───────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export function createLogger(prefix: string, level: LogLevel = 'info'): Logger {
  const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = levels[level];

  return {
    debug: currentLevel <= 0 ? (msg, ...args) => console.debug(`[${prefix}] ${msg}`, ...args) : () => {},
    info: currentLevel <= 1 ? (msg, ...args) => console.info(`[${prefix}] ${msg}`, ...args) : () => {},
    warn: currentLevel <= 2 ? (msg, ...args) => console.warn(`[${prefix}] ${msg}`, ...args) : () => {},
    error: currentLevel <= 3 ? (msg, ...args) => console.error(`[${prefix}] ${msg}`, ...args) : () => {},
  };
}
