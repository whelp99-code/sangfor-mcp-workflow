/**
 * RAG Indexer — RAG 인덱스 관리
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const log = createLogger('rag-indexer');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface RAGDocument {
  id: string;
  vendor: string;
  product: string;
  url: string;
  title: string;
  content: string;
  chunks: RAGChunk[];
  indexedAt: string;
  metadata: Record<string, any>;
}

export interface RAGChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
}

export interface RAGSearchResult {
  chunk: RAGChunk;
  score: number;
  document: RAGDocument;
}

// ─── RAG 인덱서 ─────────────────────────────────────────────────────────────

export class RAGIndexer {
  private documents: Map<string, RAGDocument> = new Map();
  private chunks: Map<string, RAGChunk> = new Map();
  private indexPath: string;

  constructor(indexPath: string = 'data/rag/index.json') {
    this.indexPath = indexPath;
    this.loadIndex();
  }

  // 문서 인덱싱
  async indexDocument(doc: Omit<RAGDocument, 'id' | 'indexedAt' | 'chunks'>): Promise<RAGDocument> {
    log.info(`Indexing document: ${doc.title}`);

    const document: RAGDocument = {
      id: nowId('doc'),
      ...doc,
      chunks: [],
      indexedAt: nowISO(),
    };

    // 청크 분할
    const chunks = this.splitIntoChunks(document);
    document.chunks = chunks;

    // 청크 저장
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }

    // 문서 저장
    this.documents.set(document.id, document);
    this.saveIndex();

    log.info(`Indexed ${chunks.length} chunks for: ${doc.title}`);
    return document;
  }

  // 벤더 데이터 인덱싱
  async indexVendorData(vendor: string, data: any[]): Promise<number> {
    log.info(`Indexing vendor data: ${vendor}`);

    let totalChunks = 0;

    for (const item of data) {
      const doc = await this.indexDocument({
        vendor,
        product: item.product || vendor,
        url: item.url || '',
        title: item.title || `${vendor} Document`,
        content: item.content || '',
        metadata: item.metadata || {},
      });
      totalChunks += doc.chunks.length;
    }

    log.info(`Indexed ${totalChunks} chunks for vendor: ${vendor}`);
    return totalChunks;
  }

  // RAG 검색
  async search(query: string, options?: {
    vendor?: string;
    product?: string;
    limit?: number;
  }): Promise<RAGSearchResult[]> {
    log.info(`Searching: ${query}`);

    const limit = options?.limit || 10;
    const results: RAGSearchResult[] = [];

    // 간단한 키워드 기반 검색 (TODO: 벡터 검색으로 업그레이드)
    for (const [id, chunk] of this.chunks) {
      const doc = this.documents.get(chunk.documentId);
      if (!doc) continue;

      // 벤더 필터
      if (options?.vendor && doc.vendor !== options.vendor) continue;
      if (options?.product && doc.product !== options.product) continue;

      // 관련성 점수 계산
      const score = this.calculateRelevance(query, chunk.content);
      if (score > 0.1) {
        results.push({ chunk, score, document: doc });
      }
    }

    // 점수 기준 정렬
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  // 청크 분할
  private splitIntoChunks(doc: RAGDocument, chunkSize: number = 1000): RAGChunk[] {
    const chunks: RAGChunk[] = [];
    const content = doc.content;

    // 문장 기반 분할
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());

    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk) {
        chunks.push({
          id: nowId('chunk'),
          documentId: doc.id,
          content: currentChunk.trim(),
          metadata: { index: chunkIndex++ },
        });
        currentChunk = sentence;
      } else {
        currentChunk += sentence + '. ';
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: nowId('chunk'),
        documentId: doc.id,
        content: currentChunk.trim(),
        metadata: { index: chunkIndex },
      });
    }

    return chunks;
  }

  // 관련성 점수 계산
  private calculateRelevance(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    let matches = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        matches++;
      }
    }

    return matches / queryWords.length;
  }

  // 인덱스 저장
  private saveIndex(): void {
    try {
      const dir = this.indexPath.substring(0, this.indexPath.lastIndexOf('/'));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data = {
        documents: Array.from(this.documents.entries()),
        chunks: Array.from(this.chunks.entries()),
        savedAt: nowISO(),
      };

      writeFileSync(this.indexPath, JSON.stringify(data, null, 2));
      log.info(`Saved index: ${this.documents.size} documents, ${this.chunks.size} chunks`);
    } catch (error) {
      log.error(`Failed to save index: ${error}`);
    }
  }

  // 인덱스 로드
  private loadIndex(): void {
    try {
      if (existsSync(this.indexPath)) {
        const data = JSON.parse(readFileSync(this.indexPath, 'utf-8'));
        this.documents = new Map(data.documents);
        this.chunks = new Map(data.chunks);
        log.info(`Loaded index: ${this.documents.size} documents, ${this.chunks.size} chunks`);
      }
    } catch (error) {
      log.warn(`Failed to load index: ${error}`);
    }
  }

  // 인덱스 통계
  getStats(): {
    documents: number;
    chunks: number;
    vendors: string[];
  } {
    const vendors = new Set<string>();
    for (const doc of this.documents.values()) {
      vendors.add(doc.vendor);
    }

    return {
      documents: this.documents.size,
      chunks: this.chunks.size,
      vendors: Array.from(vendors),
    };
  }

  // 인덱스 초기화
  clearIndex(): void {
    this.documents.clear();
    this.chunks.clear();
    this.saveIndex();
    log.info('Index cleared');
  }
}
