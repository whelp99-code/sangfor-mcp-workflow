/**
 * 스케줄러 — 정기 작업 관리
 */

import { nowId, nowISO, createLogger, type Logger } from '@sangfor/workflow-shared';
import type { HealthCheckConfig, HealthCheckResult } from './types.js';

const log = createLogger('scheduler');

// ─── 스케줄 타입 ────────────────────────────────────────────────────────────

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ScheduledTask {
  id: string;
  name: string;
  frequency: ScheduleFrequency;
  cronExpression?: string; // custom frequency일 때
  config: any;
  lastRun?: string;
  nextRun?: string;
  enabled: boolean;
  handler: (config: any) => Promise<any>;
}

// ─── 스케줄러 관리 ──────────────────────────────────────────────────────────

const scheduledTasks = new Map<string, ScheduledTask>();
const taskHistory = new Map<string, any[]>();

export function registerScheduledTask(
  name: string,
  frequency: ScheduleFrequency,
  config: any,
  handler: (config: any) => Promise<any>,
  cronExpression?: string
): ScheduledTask {
  const task: ScheduledTask = {
    id: nowId('task'),
    name,
    frequency,
    cronExpression,
    config,
    enabled: true,
    handler,
  };
  scheduledTasks.set(task.id, task);
  log.info(`Registered scheduled task: ${name} (${frequency})`);
  return task;
}

export function getScheduledTask(taskId: string): ScheduledTask | undefined {
  return scheduledTasks.get(taskId);
}

export function listScheduledTasks(): ScheduledTask[] {
  return Array.from(scheduledTasks.values());
}

export function enableScheduledTask(taskId: string): boolean {
  const task = scheduledTasks.get(taskId);
  if (task) {
    task.enabled = true;
    return true;
  }
  return false;
}

export function disableScheduledTask(taskId: string): boolean {
  const task = scheduledTasks.get(taskId);
  if (task) {
    task.enabled = false;
    return true;
  }
  return false;
}

// ─── 스케줄 실행 ────────────────────────────────────────────────────────────

export async function runScheduledTask(taskId: string): Promise<any> {
  const task = scheduledTasks.get(taskId);
  if (!task) {
    throw new Error(`Scheduled task not found: ${taskId}`);
  }

  if (!task.enabled) {
    log.warn(`Task is disabled: ${task.name}`);
    return null;
  }

  log.info(`Running scheduled task: ${task.name}`);
  task.lastRun = nowISO();

  try {
    const result = await task.handler(task.config);

    // 히스토리 저장
    const history = taskHistory.get(taskId) || [];
    history.push({
      executedAt: nowISO(),
      result,
    });
    // 최근 100개만 보관
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    taskHistory.set(taskId, history);

    log.info(`Task completed: ${task.name}`);
    return result;
  } catch (error) {
    log.error(`Task failed: ${task.name} - ${error}`);
    throw error;
  }
}

export function getTaskHistory(taskId: string): any[] {
  return taskHistory.get(taskId) || [];
}

// ─── 실장비 점검 스케줄러 ──────────────────────────────────────────────────

export interface HealthCheckScheduler {
  configs: HealthCheckConfig[];
  history: Map<string, HealthCheckResult[]>;
}

export function createHealthCheckScheduler(
  configs: HealthCheckConfig[]
): HealthCheckScheduler {
  return {
    configs,
    history: new Map(),
  };
}

export async function runScheduledHealthChecks(
  scheduler: HealthCheckScheduler
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  for (const config of scheduler.configs) {
    try {
      log.info(`Running health check for: ${config.product}`);
      // TODO: health-checker 패키지의 runHealthCheck 호출
      // const result = await runHealthCheck(config);

      // 히스토리 저장
      const history = scheduler.history.get(config.product) || [];
      // history.push(result);
      // 최근 30일만 보관 (매일 1회 기준)
      if (history.length > 30) {
        history.splice(0, history.length - 30);
      }
      scheduler.history.set(config.product, history);
    } catch (error) {
      log.error(`Health check failed for ${config.product}: ${error}`);
    }
  }

  return results;
}

export function getHealthCheckHistory(
  scheduler: HealthCheckScheduler,
  product: string,
  days?: number
): HealthCheckResult[] {
  const history = scheduler.history.get(product) || [];
  if (days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return history.filter((h) => new Date(h.checkedAt) >= cutoff);
  }
  return history;
}
