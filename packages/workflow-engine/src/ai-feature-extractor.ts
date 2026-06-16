/**
 * AI Feature Extractor — AI 기반 기능 추출
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';

const log = createLogger('ai-feature-extractor');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface ExtractedFeature {
  id: string;
  vendor: string;
  name: string;
  category: string;
  description: string;
  confidence: number;
  source: 'keyword' | 'llm' | 'manual';
}

export interface PricingInfo {
  model: 'per-user' | 'per-device' | 'tiered' | 'custom';
  basePrice: number;
  currency: string;
  notes: string;
}

export interface ExtractionResult {
  vendor: string;
  product: string;
  features: ExtractedFeature[];
  pricing: PricingInfo | null;
  extractedAt: string;
}

// ─── AI 기능 추출기 ─────────────────────────────────────────────────────────

export class AIFeatureExtractor {
  private llmClient: any;

  constructor(llmClient?: any) {
    this.llmClient = llmClient;
  }

  // 텍스트에서 기능 추출
  async extractFeatures(content: string, vendor: string): Promise<ExtractedFeature[]> {
    log.info(`Extracting features for ${vendor}`);

    // 키워드 기반 추출 (LLM 없이도 동작)
    const features = this.extractByKeywords(content, vendor);

    // LLM이 있으면 고급 추출
    if (this.llmClient) {
      const llmFeatures = await this.extractByLLM(content, vendor);
      features.push(...llmFeatures);
    }

    // 중복 제거
    const uniqueFeatures = this.deduplicateFeatures(features);

    log.info(`Extracted ${uniqueFeatures.length} features`);
    return uniqueFeatures;
  }

  // 가격 정보 추출
  async extractPricing(content: string, vendor: string): Promise<PricingInfo | null> {
    log.info(`Extracting pricing for ${vendor}`);

    // 키워드 기반 가격 추출
    const pricing = this.extractPricingByKeywords(content);

    if (pricing) {
      return pricing;
    }

    // LLM이 있으면 고급 추출
    if (this.llmClient) {
      return await this.extractPricingByLLM(content, vendor);
    }

    return null;
  }

  // 키워드 기반 기능 추출
  private extractByKeywords(content: string, vendor: string): ExtractedFeature[] {
    const features: ExtractedFeature[] = [];
    const contentLower = content.toLowerCase();

    // 보안 솔루션 키워드
    const securityKeywords = [
      { keyword: 'antivirus', category: 'Endpoint Protection', name: 'Anti-Virus' },
      { keyword: 'edr', category: 'Endpoint Protection', name: 'EDR' },
      { keyword: 'xdr', category: 'Endpoint Protection', name: 'XDR' },
      { keyword: 'firewall', category: 'Network Security', name: 'Firewall' },
      { keyword: 'ngfw', category: 'Network Security', name: 'NGFW' },
      { keyword: 'siem', category: 'Security Operations', name: 'SIEM' },
      { keyword: 'dlp', category: 'Data Protection', name: 'DLP' },
      { keyword: 'vpn', category: 'Network Security', name: 'VPN' },
      { keyword: 'ids', category: 'Network Security', name: 'IDS' },
      { keyword: 'ips', category: 'Network Security', name: 'IPS' },
      { keyword: 'waf', category: 'Network Security', name: 'WAF' },
      { keyword: 'casb', category: 'Cloud Security', name: 'CASB' },
      { keyword: 'ztna', category: 'Zero Trust', name: 'ZTNA' },
      { keyword: 'sandbox', category: 'Threat Analysis', name: 'Sandbox' },
      { keyword: 'threat intelligence', category: 'Threat Intelligence', name: 'Threat Intelligence' },
      { keyword: 'vulnerability', category: 'Vulnerability Management', name: 'Vulnerability Management' },
      { keyword: 'patch', category: 'Patch Management', name: 'Patch Management' },
      { keyword: 'encryption', category: 'Data Protection', name: 'Encryption' },
      { keyword: 'authentication', category: 'Identity', name: 'Authentication' },
      { keyword: 'mfa', category: 'Identity', name: 'MFA' },
      { keyword: 'sso', category: 'Identity', name: 'SSO' },
    ];

    for (const kw of securityKeywords) {
      if (contentLower.includes(kw.keyword)) {
        features.push({
          id: nowId('feature'),
          vendor,
          name: kw.name,
          category: kw.category,
          description: `${kw.name} support`,
          confidence: 0.8,
          source: 'keyword',
        });
      }
    }

    return features;
  }

  // LLM 기반 기능 추출
  private async extractByLLM(content: string, vendor: string): Promise<ExtractedFeature[]> {
    // TODO: LLM API 호출
    log.info(`LLM extraction for ${vendor}`);
    return [];
  }

  // 키워드 기반 가격 추출
  private extractPricingByKeywords(content: string): PricingInfo | null {
    const contentLower = content.toLowerCase();

    // 가격 패턴
    const pricePatterns = [
      /\$[\d,]+/g,
      /€[\d,]+/g,
      /£[\d,]+/g,
      /¥[\d,]+/g,
      /per\s+(user|device|endpoint|license)/gi,
    ];

    for (const pattern of pricePatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        return {
          model: 'per-device',
          basePrice: 0,
          currency: 'USD',
          notes: matches.join(', '),
        };
      }
    }

    return null;
  }

  // LLM 기반 가격 추출
  private async extractPricingByLLM(content: string, vendor: string): Promise<PricingInfo | null> {
    // TODO: LLM API 호출
    log.info(`LLM pricing extraction for ${vendor}`);
    return null;
  }

  // 중복 제거
  private deduplicateFeatures(features: ExtractedFeature[]): ExtractedFeature[] {
    const seen = new Set<string>();
    return features.filter(f => {
      const key = `${f.vendor}-${f.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
