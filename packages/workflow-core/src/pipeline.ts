/**
 * 파이프라인 엔진 — 워크플로우 실행 관리
 */

import { nowId, nowISO, createLogger, type Logger } from '@sangfor/workflow-shared';
import type {
  Pipeline,
  PipelineStep,
  PipelineStatus,
  StepStatus,
  ProjectPipelineInput,
  ProjectPipelineResult,
} from './types.js';

const log = createLogger('pipeline');

// ─── 파이프라인 관리 ────────────────────────────────────────────────────────

const pipelines = new Map<string, Pipeline>();

export function createPipeline(name: string, stepNames: string[]): Pipeline {
  const pipeline: Pipeline = {
    id: nowId('pipeline'),
    name,
    status: 'pending',
    steps: stepNames.map((name) => ({
      id: nowId('step'),
      name,
      status: 'pending',
    })),
    startedAt: nowISO(),
  };
  pipelines.set(pipeline.id, pipeline);
  return pipeline;
}

export function getPipeline(pipelineId: string): Pipeline | undefined {
  return pipelines.get(pipelineId);
}

export function listPipelines(): Pipeline[] {
  return Array.from(pipelines.values());
}

// ─── 파이프라인 실행 ────────────────────────────────────────────────────────

type StepHandler = (step: PipelineStep, context: Record<string, any>) => Promise<any>;

export async function runPipeline(
  pipelineId: string,
  handlers: Map<string, StepHandler>
): Promise<Pipeline> {
  const pipeline = pipelines.get(pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${pipelineId}`);
  }

  pipeline.status = 'running';
  log.info(`Starting pipeline: ${pipeline.name} (${pipeline.id})`);

  const context: Record<string, any> = {};

  for (const step of pipeline.steps) {
    step.status = 'running';
    step.startedAt = nowISO();
    log.info(`  Step: ${step.name}`);

    try {
      const handler = handlers.get(step.name);
      if (!handler) {
        throw new Error(`No handler for step: ${step.name}`);
      }

      const result = await handler(step, context);
      step.result = result;
      step.status = 'completed';
      context[step.name] = result;
      log.info(`  ✓ ${step.name} completed`);
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);
      pipeline.status = 'failed';
      pipeline.error = `Step "${step.name}" failed: ${step.error}`;
      log.error(`  ✗ ${step.name} failed: ${step.error}`);
      break;
    } finally {
      step.completedAt = nowISO();
    }
  }

  if (pipeline.status === 'running') {
    pipeline.status = 'completed';
  }
  pipeline.completedAt = nowISO();

  return pipeline;
}

// ─── 프로젝트 파이프라인 ────────────────────────────────────────────────────

export async function runProjectPipeline(
  input: ProjectPipelineInput
): Promise<ProjectPipelineResult> {
  const pipelineId = nowId('pipeline');
  const startedAt = nowISO();
  const steps = {} as ProjectPipelineResult['steps'];
  const outputs: ProjectPipelineResult['outputs'] = {};
  const errors: string[] = [];

  log.info(`Starting project pipeline for: ${input.customerName}`);

  // Step 1: Excel 파싱
  try {
    steps.excelParsing = { status: 'running' as any, rows: 0 };
    // TODO: sangfor-engineer-mcp의 import_excel_requirement_list 호출
    // const rows = await importExcelRequirementList({ filePath: input.excelFilePath });
    steps.excelParsing = { status: 'completed' as any, rows: 0 }; // 임시
  } catch (error) {
    steps.excelParsing = { status: 'failed' as any, rows: 0, error: String(error) };
    errors.push(`Excel parsing failed: ${error}`);
  }

  // Step 2: 요구사항 분석
  try {
    steps.requirementAnalysis = { status: 'running' as any, tasks: 0 };
    // TODO: analyze_customer_requirements 호출
    steps.requirementAnalysis = { status: 'completed' as any, tasks: 0 }; // 임시
  } catch (error) {
    steps.requirementAnalysis = { status: 'failed' as any, tasks: 0, error: String(error) };
    errors.push(`Requirement analysis failed: ${error}`);
  }

  // Step 3: 변경 계획 생성
  try {
    steps.changePlan = { status: 'running' as any, planId: '' };
    // TODO: generate_product_change_plan 호출
    steps.changePlan = { status: 'completed' as any, planId: 'temp-plan-id' }; // 임시
  } catch (error) {
    steps.changePlan = { status: 'failed' as any, planId: '', error: String(error) };
    errors.push(`Change plan generation failed: ${error}`);
  }

  // Step 4: 가이드 생성
  try {
    steps.guideGeneration = { status: 'running' as any, files: [] };
    // TODO: generate_all_guides 호출
    steps.guideGeneration = { status: 'completed' as any, files: [] }; // 임시
  } catch (error) {
    steps.guideGeneration = { status: 'failed' as any, files: [], error: String(error) };
    errors.push(`Guide generation failed: ${error}`);
  }

  // Step 5: 실장비 캡처 (선택)
  if (input.captureScreenshots) {
    try {
      steps.screenshotCapture = { status: 'running' as any, captured: 0 };
      // TODO: capture_screenshots 호출
      steps.screenshotCapture = { status: 'completed' as any, captured: 0 }; // 임시
    } catch (error) {
      steps.screenshotCapture = { status: 'failed' as any, captured: 0, error: String(error) };
      errors.push(`Screenshot capture failed: ${error}`);
    }
  }

  // Step 6: 보고서 생성
  try {
    steps.evidenceReport = { status: 'running' as any, reportPath: '' };
    // TODO: generate_evidence_report 호출
    steps.evidenceReport = { status: 'completed' as any, reportPath: '' }; // 임시
  } catch (error) {
    steps.evidenceReport = { status: 'failed' as any, reportPath: '', error: String(error) };
    errors.push(`Evidence report generation failed: ${error}`);
  }

  return {
    pipelineId,
    customerName: input.customerName,
    startedAt,
    completedAt: nowISO(),
    steps,
    outputs,
    errors,
  };
}
