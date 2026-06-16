/**
 * Vendor Learner — 인터넷 벤더 자료 수집 및 RAG 학습
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';

const log = createLogger('vendor-learner');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface VendorSource {
  id: string;
  vendor: string;
  url: string;
  type: 'official' | 'review' | 'comparison' | 'pricing';
  content: string;
  extractedAt: string;
  metadata: Record<string, any>;
}

export interface LearningResult {
  id: string;
  sourcesCollected: number;
  productsUpdated: number;
  newFeatures: string[];
  pricingChanges: Array<{ vendor: string; oldPrice: string; newPrice: string }>;
  errors: string[];
  completedAt: string;
}

export interface VendorCrawlConfig {
  vendor: string;
  urls: string[];
  selectors?: {
    features?: string;
    pricing?: string;
    description?: string;
  };
  schedule?: 'daily' | 'weekly' | 'monthly';
}

// ─── 벤더 학습기 ────────────────────────────────────────────────────────────

export class VendorLearner {
  private sources: Map<string, VendorSource[]> = new Map();
  private vendorDB: any;

  constructor(vendorDB: any) {
    this.vendorDB = vendorDB;
  }

  // 벤더 자료 수집
  async collectVendorData(vendor: string): Promise<VendorSource[]> {
    log.info(`Collecting data for vendor: ${vendor}`);

    const sources: VendorSource[] = [];

    // 1. 공식 문서 수집
    const officialSources = await this.collectOfficialDocs(vendor);
    sources.push(...officialSources);

    // 2. 리뷰 수집
    const reviewSources = await this.collectReviews(vendor);
    sources.push(...reviewSources);

    // 3. 가격 정보 수집
    const pricingSources = await this.collectPricing(vendor);
    sources.push(...pricingSources);

    // 저장
    this.sources.set(vendor, sources);
    log.info(`Collected ${sources.length} sources for ${vendor}`);

    return sources;
  }

  // 공식 문서 수집
  private async collectOfficialDocs(vendor: string): Promise<VendorSource[]> {
    // TODO: 웹 크롤링 구현
    log.info(`Collecting official docs for ${vendor}`);
    return [];
  }

  // 리뷰 수집
  private async collectReviews(vendor: string): Promise<VendorSource[]> {
    // TODO: G2, Gartner 리뷰 수집
    log.info(`Collecting reviews for ${vendor}`);
    return [];
  }

  // 가격 정보 수집
  private async collectPricing(vendor: string): Promise<VendorSource[]> {
    // TODO: 가격 정보 수집
    log.info(`Collecting pricing for ${vendor}`);
    return [];
  }

  // RAG 학습
  async ingestToRAG(sources: VendorSource[]): Promise<number> {
    log.info(`Ingesting ${sources.length} sources to RAG`);

    let chunkCount = 0;

    for (const source of sources) {
      // 청크 분할
      const chunks = this.splitIntoChunks(source.content);

      // RAG 인덱스에 추가
      for (const chunk of chunks) {
        await this.addToRAGIndex({
          id: nowId('rag'),
          vendor: source.vendor,
          url: source.url,
          content: chunk,
          extractedAt: source.extractedAt,
        });
        chunkCount++;
      }
    }

    log.info(`Ingested ${chunkCount} chunks to RAG`);
    return chunkCount;
  }

  // 벤더 DB 업데이트
  async updateVendorDB(vendor: string, sources: VendorSource[]): Promise<void> {
    log.info(`Updating vendor DB for ${vendor}`);

    // 기존 벤더 데이터 조회
    const existingVendor = this.findVendorInDB(vendor);
    if (!existingVendor) {
      log.warn(`Vendor not found in DB: ${vendor}`);
      return;
    }

    // 새 데이터로 업데이트
    const newFeatures = this.extractFeatures(sources);
    const newPricing = this.extractPricing(sources);

    if (newFeatures.length > 0) {
      existingVendor.features = [...new Set([...existingVendor.features, ...newFeatures])];
      log.info(`Added ${newFeatures.length} new features`);
    }

    if (newPricing) {
      existingVendor.pricing = newPricing;
      log.info(`Updated pricing`);
    }

    existingVendor.lastUpdated = nowISO();
  }

  // 전체 학습 파이프라인
  async runLearningPipeline(): Promise<LearningResult> {
    log.info('Starting learning pipeline');

    const result: LearningResult = {
      id: nowId('learning'),
      sourcesCollected: 0,
      productsUpdated: 0,
      newFeatures: [],
      pricingChanges: [],
      errors: [],
      completedAt: '',
    };

    // 모든 벤더에 대해 학습
    for (const category of this.vendorDB.categories) {
      for (const vendor of category.vendors) {
        try {
          const sources = await this.collectVendorData(vendor.vendor);
          result.sourcesCollected += sources.length;

          await this.ingestToRAG(sources);
          await this.updateVendorDB(vendor.vendor, sources);
          result.productsUpdated++;
        } catch (error) {
          result.errors.push(`${vendor.vendor}: ${error}`);
        }
      }
    }

    result.completedAt = nowISO();
    log.info(`Learning pipeline completed: ${result.sourcesCollected} sources, ${result.productsUpdated} products updated`);

    return result;
  }

  // ─── 유틸리티 ──────────────────────────────────────────────────────────────

  private splitIntoChunks(content: string, chunkSize: number = 1000): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/[.!?]+/);

    let currentChunk = '';
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence + '. ';
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    return chunks;
  }

  private async addToRAGIndex(chunk: any): Promise<void> {
    // TODO: RAG 인덱스에 추가
  }

  private findVendorInDB(vendor: string): any {
    for (const category of this.vendorDB.categories) {
      const found = category.vendors.find((v: any) => v.vendor === vendor);
      if (found) return found;
    }
    return null;
  }

  private extractFeatures(sources: VendorSource[]): string[] {
    const features: string[] = [];
    for (const source of sources) {
      // TODO: AI 기반 기능 추출
    }
    return features;
  }

  private extractPricing(sources: VendorSource[]): any {
    for (const source of sources) {
      if (source.type === 'pricing') {
        // TODO: 가격 정보 파싱
        return null;
      }
    }
    return null;
  }
}
