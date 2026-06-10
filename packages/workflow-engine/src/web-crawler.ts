/**
 * Web Crawler — 벤더 사이트 크롤링
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';

const log = createLogger('web-crawler');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface CrawlTarget {
  vendor: string;
  url: string;
  type: 'product' | 'pricing' | 'review' | 'documentation';
  selectors?: {
    title?: string;
    content?: string;
    features?: string;
    pricing?: string;
    description?: string;
  };
}

export interface CrawlResult {
  id: string;
  vendor: string;
  url: string;
  type: string;
  title: string;
  content: string;
  features: string[];
  pricing: any;
  crawledAt: string;
  success: boolean;
  error?: string;
}

// ─── 벤더 크롤링 대상 정의 ──────────────────────────────────────────────────

const VENDOR_CRAWL_TARGETS: Record<string, CrawlTarget[]> = {
  'CrowdStrike': [
    {
      vendor: 'CrowdStrike',
      url: 'https://www.crowdstrike.com/products/endpoint-security/',
      type: 'product',
      selectors: {
        title: 'h1',
        content: '.product-description',
        features: '.feature-list li',
      },
    },
    {
      vendor: 'CrowdStrike',
      url: 'https://www.crowdstrike.com/pricing/',
      type: 'pricing',
      selectors: {
        pricing: '.pricing-card',
      },
    },
  ],
  'Microsoft': [
    {
      vendor: 'Microsoft',
      url: 'https://www.microsoft.com/en-us/security/business/endpoint-security/microsoft-defender-endpoint',
      type: 'product',
      selectors: {
        title: 'h1',
        content: '.product-description',
        features: '.feature-list li',
      },
    },
  ],
  'SentinelOne': [
    {
      vendor: 'SentinelOne',
      url: 'https://www.sentinelone.com/platform/',
      type: 'product',
      selectors: {
        title: 'h1',
        content: '.product-description',
        features: '.feature-list li',
      },
    },
  ],
  'Palo Alto Networks': [
    {
      vendor: 'Palo Alto Networks',
      url: 'https://www.paloaltonetworks.com/network-security',
      type: 'product',
      selectors: {
        title: 'h1',
        content: '.product-description',
        features: '.feature-list li',
      },
    },
  ],
  'Fortinet': [
    {
      vendor: 'Fortinet',
      url: 'https://www.fortinet.com/products/next-generation-firewall',
      type: 'product',
      selectors: {
        title: 'h1',
        content: '.product-description',
        features: '.feature-list li',
      },
    },
  ],
};

// ─── 웹 크롤러 ──────────────────────────────────────────────────────────────

export class WebCrawler {
  private results: Map<string, CrawlResult[]> = new Map();

  // 벤더 크롤링
  async crawlVendor(vendor: string): Promise<CrawlResult[]> {
    log.info(`Crawling vendor: ${vendor}`);

    const targets = VENDOR_CRAWL_TARGETS[vendor] || [];
    const results: CrawlResult[] = [];

    for (const target of targets) {
      try {
        const result = await this.crawlPage(target);
        results.push(result);
        log.info(`Crawled: ${target.url} - ${result.success ? 'success' : 'failed'}`);
      } catch (error) {
        results.push({
          id: nowId('crawl'),
          vendor,
          url: target.url,
          type: target.type,
          title: '',
          content: '',
          features: [],
          pricing: null,
          crawledAt: nowISO(),
          success: false,
          error: String(error),
        });
      }
    }

    this.results.set(vendor, results);
    return results;
  }

  // 페이지 크롤링
  private async crawlPage(target: CrawlTarget): Promise<CrawlResult> {
    // TODO: Playwright 기반 크롤링 구현
    // 현재는 목업 데이터 반환
    log.info(`Crawling page: ${target.url}`);

    return {
      id: nowId('crawl'),
      vendor: target.vendor,
      url: target.url,
      type: target.type,
      title: `${target.vendor} Product`,
      content: `${target.vendor} product description...`,
      features: ['Feature 1', 'Feature 2', 'Feature 3'],
      pricing: null,
      crawledAt: nowISO(),
      success: true,
    };
  }

  // 전체 벤더 크롤링
  async crawlAllVendors(): Promise<Map<string, CrawlResult[]>> {
    log.info('Crawling all vendors');

    const vendors = Object.keys(VENDOR_CRAWL_TARGETS);
    for (const vendor of vendors) {
      await this.crawlVendor(vendor);
    }

    return this.results;
  }

  // 크롤링 결과 조회
  getResults(vendor: string): CrawlResult[] {
    return this.results.get(vendor) || [];
  }

  // 전체 결과 조회
  getAllResults(): Map<string, CrawlResult[]> {
    return this.results;
  }
}
