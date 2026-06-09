/**
 * 자동 위키 파이프라인 — 피드백 → 교훈 → 위키 제안 → Obsidian/GitHub Wiki 반영
 */

import { nowId, nowISO, createLogger, type Logger } from '@sangfor/workflow-shared';
import type {
  AutoWikiPipelineConfig,
  AutoWikiPipelineResult,
  WikiUpdateProposal,
} from '@sangfor/workflow-core';
import { applyWikiUpdateToObsidian } from './obsidian-sync.js';
import { applyWikiUpdateToGitHub, type GitHubWikiConfig } from './github-wiki-sync.js';

const log = createLogger('auto-wiki-pipeline');

// ─── 자동 위키 파이프라인 ────────────────────────────────────────────────────

export async function runAutoWikiPipeline(
  config: AutoWikiPipelineConfig
): Promise<AutoWikiPipelineResult> {
  const pipelineId = nowId('pipeline');
  const executedAt = nowISO();

  log.info(`Starting auto wiki pipeline: ${pipelineId}`);

  const result: AutoWikiPipelineResult = {
    pipelineId,
    executedAt,
    feedbackProcessed: 0,
    lessonsExtracted: 0,
    proposalsCreated: 0,
    proposalsApproved: 0,
    wikiUpdatesApplied: 0,
    errors: [],
  };

  try {
    // Step 1: 미처리 피드백 수집
    const feedbacks = await collectUnprocessedFeedbacks(config);
    result.feedbackProcessed = feedbacks.length;
    log.info(`Collected ${feedbacks.length} unprocessed feedbacks`);

    // Step 2: 각 피드백에 대해 처리
    for (const feedback of feedbacks) {
      try {
        // 교훈 추출
        const lesson = await extractLesson(feedback);
        result.lessonsExtracted++;
        log.info(`Extracted lesson: ${lesson.title}`);

        // 위키 제안 생성
        const proposal = await createWikiProposal(lesson);
        result.proposalsCreated++;
        log.info(`Created proposal: ${proposal.id}`);

        // 자동 승인 (설정된 경우)
        if (config.autoApprove) {
          proposal.status = 'approved';
          result.proposalsApproved++;
          log.info(`Auto-approved proposal: ${proposal.id}`);
        }

        // 위키 업데이트 적용
        if (proposal.status === 'approved') {
          const updateResult = await applyWikiUpdate(config, proposal);
          if (updateResult.success) {
            result.wikiUpdatesApplied++;
            proposal.status = 'applied';
            proposal.appliedAt = nowISO();
            log.info(`Applied wiki update: ${proposal.id}`);
          } else {
            result.errors.push({
              feedbackId: feedback.id,
              error: updateResult.error || 'Unknown error',
            });
          }
        }
      } catch (error) {
        result.errors.push({
          feedbackId: feedback.id,
          error: error instanceof Error ? error.message : String(error),
        });
        log.error(`Failed to process feedback ${feedback.id}: ${error}`);
      }
    }

    log.info(
      `Pipeline completed: ${result.wikiUpdatesApplied}/${result.proposalsCreated} updates applied`
    );
  } catch (error) {
    log.error(`Pipeline failed: ${error}`);
    throw error;
  }

  return result;
}

// ─── 피드백 수집 ────────────────────────────────────────────────────────────

interface Feedback {
  id: string;
  product: string;
  feedbackType: string;
  severity: string;
  feedbackText: string;
  sourceRole: string;
  createdAt: string;
  processed?: boolean;
}

async function collectUnprocessedFeedbacks(
  config: AutoWikiPipelineConfig
): Promise<Feedback[]> {
  // TODO: 실제 피드백 수집 로직
  // 현재는 목업 데이터 반환
  const feedbacks: Feedback[] = [
    {
      id: 'fb_001',
      product: 'EPP',
      feedbackType: 'issue',
      severity: 'high',
      feedbackText: 'USB 정책 적용 후 일부 에이전트에서 정책이 반영되지 않는 현상 발견',
      sourceRole: 'engineer',
      createdAt: nowISO(),
    },
  ];

  // 필터 적용
  return feedbacks.filter((fb) => {
    if (config.feedbackFilter?.severity) {
      if (!config.feedbackFilter.severity.includes(fb.severity)) {
        return false;
      }
    }
    if (config.feedbackFilter?.product) {
      if (!config.feedbackFilter.product.includes(fb.product)) {
        return false;
      }
    }
    return true;
  });
}

// ─── 교훈 추출 ──────────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  product: string;
  severity: string;
  background: string;
  lessonText: string;
  application: string;
  feedbackId: string;
}

async function extractLesson(feedback: Feedback): Promise<Lesson> {
  // TODO: AI 기반 교훈 추출 로직
  // 현재는 간단한 변환
  return {
    id: nowId('lesson'),
    title: `[${feedback.product}] ${feedback.feedbackText.substring(0, 50)}`,
    product: feedback.product,
    severity: feedback.severity,
    background: feedback.feedbackText,
    lessonText: `${feedback.product} 환경에서 발생한 이슈에 대한 교훈입니다.`,
    application: '유사 환경에서의 사전 점검 항목으로 추가 권장합니다.',
    feedbackId: feedback.id,
  };
}

// ─── 위키 제안 생성 ─────────────────────────────────────────────────────────

async function createWikiProposal(lesson: Lesson): Promise<WikiUpdateProposal> {
  return {
    id: nowId('proposal'),
    lessonTitle: lesson.title,
    lessonBody: `## 배경\n${lesson.background}\n\n## 교훈\n${lesson.lessonText}\n\n## 적용 방안\n${lesson.application}`,
    status: 'pending',
    createdAt: nowISO(),
  };
}

// ─── 위키 업데이트 적용 ─────────────────────────────────────────────────────

async function applyWikiUpdate(
  config: AutoWikiPipelineConfig,
  proposal: WikiUpdateProposal
): Promise<{ success: boolean; error?: string }> {
  // Obsidian에 적용
  const obsidianResult = applyWikiUpdateToObsidian(config.obsidianVaultPath, proposal);

  if (!obsidianResult.success) {
    return obsidianResult;
  }

  // GitHub Wiki에 적용 (설정된 경우)
  if (config.githubWikiRepo) {
    const githubConfig: GitHubWikiConfig = {
      repoUrl: config.githubWikiRepo,
      localPath: `${config.obsidianVaultPath}/.github-wiki`,
    };

    const githubResult = applyWikiUpdateToGitHub(githubConfig, proposal);

    if (!githubResult.success) {
      log.warn(`GitHub Wiki sync failed: ${githubResult.error}`);
      // Obsidian은 성공했으므로 partial success 반환
    }
  }

  return { success: true };
}

// ─── 파이프라인 상태 조회 ────────────────────────────────────────────────────

export interface PipelineStatus {
  lastRun: string;
  totalFeedbacks: number;
  totalLessons: number;
  totalProposals: number;
  totalUpdates: number;
}

export function getAutoWikiPipelineStatus(): PipelineStatus {
  // TODO: 실제 상태 관리
  return {
    lastRun: nowISO(),
    totalFeedbacks: 0,
    totalLessons: 0,
    totalProposals: 0,
    totalUpdates: 0,
  };
}
