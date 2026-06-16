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
}
