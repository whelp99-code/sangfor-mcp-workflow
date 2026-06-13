/**
 * 워크플로우 파이프라인 타입 정의
 */

import { ProductCode, RiskLevel } from '@sangfor/workflow-shared';

// ─── 파이프라인 기본 타입 ────────────────────────────────────────────────────

export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineStep {
  id: string;
  name: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: any;
}

export interface Pipeline {
  id: string;
  name: string;
  status: PipelineStatus;
  steps: PipelineStep[];
  startedAt: string;
  completedAt?: string;
  error?: string;
  metadata?: Record<string, any>;
}

// ─── 프로젝트 파이프라인 타입 ────────────────────────────────────────────────

export interface ProjectPipelineInput {
  customerName: string;
  excelFilePath: string;
  products?: ProductCode[];
  outputDir?: string;
  captureScreenshots?: boolean;
  screenshotProducts?: string[];
  targetUrls?: Record<string, string>;
  credentials?: Record<string, { username: string; password: string }>;
  dryRun?: boolean;
}

export interface ProjectPipelineResult {
  pipelineId: string;
  customerName: string;
  startedAt: string;
  completedAt: string;
  steps: {
    excelParsing: { status: StepStatus; rows: number; error?: string };
    requirementAnalysis: { status: StepStatus; tasks: number; error?: string };
    changePlan: { status: StepStatus; planId: string; error?: string };
    guideGeneration: { status: StepStatus; files: string[]; error?: string };
    screenshotCapture?: { status: StepStatus; captured: number; error?: string };
    evidenceReport: { status: StepStatus; reportPath: string; error?: string };
  };
  outputs: {
    settingGuideDocx?: string;
    settingGuidePptx?: string;
    operationsGuideDocx?: string;
    operationsGuidePptx?: string;
    comprehensiveSettingDocx?: string;
    comprehensiveOperationsDocx?: string;
    screenshots?: Record<string, string[]>;
    evidenceReport?: string;
  };
  errors: string[];
}

// ─── 실장비 점검 타입 ────────────────────────────────────────────────────────

export type CheckItemCollectType = 'screenshot' | 'table' | 'form' | 'api';

export type AlertOperator = 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertCondition {
  field: string;
  operator: AlertOperator;
  value: string | number | boolean;
  severity: AlertSeverity;
}

export interface HealthCheckItem {
  id: string;
  name: string;
  menuPath: string[];
  collectType: CheckItemCollectType;
  expectedFields?: string[];
  alertConditions?: AlertCondition[];
}

export interface HealthCheckConfig {
  product: 'EPP' | 'IAG' | 'CC';
  targetUrl: string;
  credentials: { username: string; password: string };
  checkItems: HealthCheckItem[];
  outputDir: string;
  cdpPort?: number;
}

export interface HealthCheckItemResult {
  itemId: string;
  name: string;
  status: 'pass' | 'warning' | 'critical' | 'error';
  collectedData?: any;
  screenshotPath?: string;
  error?: string;
}

export interface HealthAlert {
  itemId: string;
  itemName: string;
  condition: AlertCondition;
  actualValue: any;
  severity: AlertSeverity;
  message: string;
}

export interface HealthCheckResult {
  checkId: string;
  product: string;
  targetUrl: string;
  checkedAt: string;
  items: HealthCheckItemResult[];
  alerts: HealthAlert[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    critical: number;
  };
}

// ─── 스냅샷 비교 타입 ────────────────────────────────────────────────────────

export type ChangeType = 'added' | 'removed' | 'modified';

export interface Change {
  path: string;
  previousValue: any;
  currentValue: any;
  changeType: ChangeType;
  severity: AlertSeverity;
}

export interface SnapshotDiff {
  comparedAt: string;
  previousCheckId: string;
  currentCheckId: string;
  changes: Change[];
  anomalies: any[];
  summary: {
    totalChanges: number;
    criticalChanges: number;
    newAlerts: number;
  };
}

// ─── Obsidian 연동 타입 ──────────────────────────────────────────────────────

export interface WikiUpdateProposal {
  id: string;
  lessonTitle: string;
  lessonBody: string;
  targetPage?: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
  appliedAt?: string;
}

export interface ObsidianNote {
  title: string;
  frontmatter: Record<string, any>;
  body: string;
  tags: string[];
  links: string[];
  filePath: string;
}

export interface AutoWikiPipelineConfig {
  obsidianVaultPath: string;
  githubWikiRepo?: string;
  autoApprove: boolean;
  notifyOnProposal: boolean;
  batchSize: number;
  feedbackFilter?: {
    severity?: string[];
    product?: string[];
    dateRange?: { from: string; to: string };
  };
}

export interface AutoWikiPipelineResult {
  pipelineId: string;
  executedAt: string;
  feedbackProcessed: number;
  lessonsExtracted: number;
  proposalsCreated: number;
  proposalsApproved: number;
  wikiUpdatesApplied: number;
  errors: Array<{ feedbackId: string; error: string }>;
}
