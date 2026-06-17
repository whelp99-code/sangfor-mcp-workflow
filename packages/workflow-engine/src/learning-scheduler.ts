/**
 * Learning Scheduler — 자가 학습 스케줄링
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import { WebCrawler } from './web-crawler.js';
import { RAGIndexer } from './rag-indexer.js';
import { AIFeatureExtractor } from './ai-feature-extractor.js';

const log = createLogger('learning-scheduler');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface LearningSchedule {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  vendors: string[];
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface LearningJob {
  id: string;
  scheduleId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

// ─── 학습 스케줄러 ──────────────────────────────────────────────────────────

export class LearningScheduler {
  private schedules: Map<string, LearningSchedule> = new Map();
  private jobs: Map<string, LearningJob> = new Map();
  private crawler: WebCrawler;
  private indexer: RAGIndexer;
  private extractor: AIFeatureExtractor;

  constructor() {
    this.crawler = new WebCrawler();
    this.indexer = new RAGIndexer();
    this.extractor = new AIFeatureExtractor();
  }

  // 스케줄 등록
  registerSchedule(schedule: Omit<LearningSchedule, 'id'>): LearningSchedule {
    const newSchedule: LearningSchedule = {
      id: nowId('schedule'),
      ...schedule,
    };

    this.schedules.set(newSchedule.id, newSchedule);
    log.info(`Registered schedule: ${newSchedule.name}`);

    return newSchedule;
  }

  // 스케줄 실행
  async runSchedule(scheduleId: string): Promise<LearningJob> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    log.info(`Running schedule: ${schedule.name}`);

    const job: LearningJob = {
      id: nowId('job'),
      scheduleId,
      startedAt: nowISO(),
      status: 'running',
    };

    this.jobs.set(job.id, job);

    try {
      // 1. 벤더 데이터 크롤링
      const crawlResults = new Map<string, any[]>();
      for (const vendor of schedule.vendors) {
        const results = await this.crawler.crawlVendor(vendor);
        crawlResults.set(vendor, results);
      }

      // 2. RAG 인덱싱
      let totalChunks = 0;
      for (const [vendor, results] of crawlResults) {
        const chunks = await this.indexer.indexVendorData(vendor, results);
        totalChunks += chunks;
      }

      // 3. 기능 추출
      const features = new Map<string, any[]>();
      for (const [vendor, results] of crawlResults) {
        for (const result of results) {
          const extracted = await this.extractor.extractFeatures(result.content, vendor);
          features.set(vendor, extracted);
        }
      }

      // 완료
      job.status = 'completed';
      job.completedAt = nowISO();
      job.result = {
        vendors: schedule.vendors,
        totalChunks,
        features: Object.fromEntries(features),
      };

      schedule.lastRun = nowISO();
      schedule.nextRun = this.calculateNextRun(schedule.frequency);

      log.info(`Schedule completed: ${schedule.name}`);
    } catch (error) {
      job.status = 'failed';
      job.completedAt = nowISO();
      job.error = String(error);
      log.error(`Schedule failed: ${schedule.name} - ${error}`);
    }

    return job;
  }

  // 전체 스케줄 실행
  async runAllSchedules(): Promise<LearningJob[]> {
    log.info('Running all schedules');

    const jobs: LearningJob[] = [];

    for (const [id, schedule] of this.schedules) {
      if (schedule.enabled) {
        const job = await this.runSchedule(id);
        jobs.push(job);
      }
    }

    return jobs;
  }

  // 스케줄 목록 조회
  getSchedules(): LearningSchedule[] {
    return Array.from(this.schedules.values());
  }

  // 작업 목록 조회
  getJobs(scheduleId?: string): LearningJob[] {
    const jobs = Array.from(this.jobs.values());
    if (scheduleId) {
      return jobs.filter(j => j.scheduleId === scheduleId);
    }
    return jobs;
  }

  // 스케줄 활성화/비활성화
  toggleSchedule(scheduleId: string, enabled: boolean): void {
    const schedule = this.schedules.get(scheduleId);
    if (schedule) {
      schedule.enabled = enabled;
      log.info(`Schedule ${enabled ? 'enabled' : 'disabled'}: ${schedule.name}`);
    }
  }

  // 다음 실행 시간 계산
  private calculateNextRun(frequency: 'daily' | 'weekly' | 'monthly'): string {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
    }
    return now.toISOString();
  }

  // ─── PR-30: Failure → Learning 메서드 ────────────────────────────────────

  private learningCandidates: Map<string, LearningCandidate> = new Map();
  private lessonDocuments: Map<string, LessonDocument> = new Map();

  /**
   * 실패를 playbook과 연결하여 학습 후보 생성
   * 주의: 자동으로 playbook을 수정하지 않음 — 사람 검토 필요
   */
  linkFailureToPlaybook(
    failure: FailureRecord,
    playbookId: string,
  ): LearningCandidate {
    const candidateId = nowId('candidate');
    log.info(`Linking failure ${failure.id} to playbook ${playbookId}`);

    const candidate: LearningCandidate = {
      id: candidateId,
      failureId: failure.id,
      playbookId,
      linkedAt: nowISO(),
      status: 'pending_review',
      // 원본 playbook이 수정되지 않도록 보호
      originalPlaybookSnapshot: failure.playbookSnapshot ?? '{}',
    };

    this.learningCandidates.set(candidateId, candidate);
    return candidate;
  }

  /**
   * 실패에서 교훈 문서 생성
   */
  generateLessonFromFailure(failure: FailureRecord): LessonDocument {
    const lessonId = nowId('lesson');
    log.info(`Generating lesson from failure: ${failure.id}`);

    const lesson: LessonDocument = {
      id: lessonId,
      title: `[교훈] ${failure.product} — ${failure.error.substring(0, 80)}`,
      product: failure.product,
      severity: failure.severity,
      background: `실행 ID: ${failure.executionId}\n에러: ${failure.error}\n발생 시각: ${failure.occurredAt}`,
      lessonText: `${failure.product} 환경에서 "${failure.error}" 오류가 발생했습니다. ` +
        `동일한 환경에서 재발 방지를 위해 playbook 점검 항목 추가를 권장합니다.`,
      application: '유사 환경의 precheck/postcheck에 해당 조건을 추가하세요.',
      sourceFailureId: failure.id,
      createdAt: nowISO(),
      status: 'draft',
    };

    this.lessonDocuments.set(lessonId, lesson);
    return lesson;
  }

  /**
   * 교훈에서 playbook 개선 후보 생성
   * 주의: 원본 playbook은 수정하지 않음 — 개선 제안만 생성
   */
  createPlaybookImprovementCandidate(lesson: LessonDocument): ImprovementCandidate {
    const candidateId = nowId('improvement');
    log.info(`Creating improvement candidate from lesson: ${lesson.id}`);

    const candidate: ImprovementCandidate = {
      id: candidateId,
      lessonId: lesson.id,
      title: `[개선 제안] ${lesson.title}`,
      description: lesson.lessonText,
      proposedChanges: `교훈 "${lesson.id}" 기반 개선 제안 — ${lesson.application}`,
      status: 'pending_review',
      // 원본 playbook 보호: 검토 전까지 수정 불가
      safetyGuard: '사람 검토 전 playbook 원본이 수정되지 않도록 보호됨',
      createdAt: nowISO(),
    };

    return candidate;
  }

  // 학습 후보 조회
  getLearningCandidates(): LearningCandidate[] {
    return Array.from(this.learningCandidates.values());
  }

  // 교훈 문서 조회
  getLessonDocuments(): LessonDocument[] {
    return Array.from(this.lessonDocuments.values());
  }
}

// ─── PR-30: Failure / Learning 타입 ────────────────────────────────────────

export interface FailureRecord {
  id: string;
  executionId: string;
  product: string;
  error: string;
  severity: 'info' | 'warning' | 'critical';
  occurredAt: string;
  playbookSnapshot?: string;
}

export interface LearningCandidate {
  id: string;
  failureId: string;
  playbookId: string;
  linkedAt: string;
  status: 'pending_review' | 'approved' | 'rejected';
  originalPlaybookSnapshot: string;
}

export interface LessonDocument {
  id: string;
  title: string;
  product: string;
  severity: string;
  background: string;
  lessonText: string;
  application: string;
  sourceFailureId: string;
  createdAt: string;
  status: 'draft' | 'reviewed' | 'published';
}

export interface ImprovementCandidate {
  id: string;
  lessonId: string;
  title: string;
  description: string;
  proposedChanges: string;
  status: 'pending_review' | 'approved' | 'rejected';
  safetyGuard: string;
  createdAt: string;
}
