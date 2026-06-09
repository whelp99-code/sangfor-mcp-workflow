/**
 * Workflow Templates — 자주 사용하는 워크플로우 템플릿
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';
import type { WorkflowTemplate, Workflow, CustomerProfile, ProductCode } from './types.js';

const log = createLogger('workflow-templates');

// ─── 기본 템플릿 정의 ──────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tpl_iag_only',
    name: 'IAG 전용 설정',
    description: 'IAG(Internet Access Gateway)만 필요한 고객을 위한 워크플로우',
    products: ['IAG'],
    steps: [
      { toolName: 'import_excel', optional: false },
      { toolName: 'analyze_requirements', optional: false },
      { toolName: 'generate_change_plan', optional: false },
      { toolName: 'generate_setting_guide_docx', optional: false },
      { toolName: 'generate_setting_guide_pptx', optional: false },
      { toolName: 'capture_screenshots', optional: true },
      { toolName: 'generate_evidence_report', optional: false },
    ],
    tags: ['iag', 'url-filtering', 'dlp'],
  },
  {
    id: 'tpl_epp_only',
    name: 'EPP 전용 설정',
    description: 'EPP(Endpoint Secure)만 필요한 고객을 위한 워크플로우',
    products: ['ENDPOINT_SECURE'],
    steps: [
      { toolName: 'import_excel', optional: false },
      { toolName: 'analyze_requirements', optional: false },
      { toolName: 'generate_change_plan', optional: false },
      { toolName: 'generate_setting_guide_docx', optional: false },
      { toolName: 'generate_setting_guide_pptx', optional: false },
      { toolName: 'capture_screenshots', optional: true },
      { toolName: 'generate_evidence_report', optional: false },
    ],
    tags: ['epp', 'malware', 'device-control'],
  },
  {
    id: 'tpl_full_security',
    name: '풀 시큐리티 설정',
    description: 'IAG + EPP + CC 전체 보안 솔루션 설정',
    products: ['IAG', 'ENDPOINT_SECURE', 'CYBER_COMMAND'],
    steps: [
      { toolName: 'import_excel', optional: false },
      { toolName: 'analyze_requirements', optional: false },
      { toolName: 'search_manuals', optional: true },
      { toolName: 'generate_change_plan', optional: false },
      { toolName: 'generate_setting_guide_docx', optional: false },
      { toolName: 'generate_setting_guide_pptx', optional: false },
      { toolName: 'capture_screenshots', optional: true },
      { toolName: 'run_health_check', optional: true },
      { toolName: 'generate_evidence_report', optional: false },
    ],
    tags: ['full', 'enterprise', 'compliance'],
  },
  {
    id: 'tpl_quick_audit',
    name: '빠른 감사',
    description: '기존 설정 감사 및 보고서 생성 (변경 없음)',
    products: ['IAG', 'ENDPOINT_SECURE', 'CYBER_COMMAND'],
    steps: [
      { toolName: 'run_health_check', optional: false },
      { toolName: 'capture_screenshots', optional: false },
      { toolName: 'generate_evidence_report', optional: false },
    ],
    tags: ['audit', 'readonly', 'compliance'],
  },
  {
    id: 'tpl_incident_response',
    name: '사고 대응',
    description: '보안 사고 발생 시 긴급 대응 워크플로우',
    products: ['IAG', 'ENDPOINT_SECURE', 'CYBER_COMMAND'],
    steps: [
      { toolName: 'run_health_check', optional: false },
      { toolName: 'search_manuals', optional: false },
      { toolName: 'capture_screenshots', optional: false },
      { toolName: 'generate_evidence_report', optional: false },
    ],
    tags: ['incident', 'emergency', 'forensics'],
  },
];

// ─── 템플릿 관리자 ──────────────────────────────────────────────────────────

export class TemplateManager {
  private templates: Map<string, WorkflowTemplate> = new Map();

  constructor() {
    // 기본 템플릿 등록
    this.registerDefaults();
  }

  // 기본 템플릿 등록
  private registerDefaults(): void {
    for (const template of DEFAULT_TEMPLATES) {
      this.templates.set(template.id, template);
    }
    log.info(`Registered ${DEFAULT_TEMPLATES.length} default templates`);
  }

  // 템플릿 등록
  register(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
    log.info(`Registered template: ${template.name}`);
  }

  // 템플릿 조회
  get(templateId: string): WorkflowTemplate | undefined {
    return this.templates.get(templateId);
  }

  // 전체 템플릿 목록
  list(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  // 제품별 템플릿 검색
  findByProducts(products: ProductCode[]): WorkflowTemplate[] {
    return this.list().filter((t) =>
      products.some((p) => t.products.includes(p))
    );
  }

  // 태그별 템플릿 검색
  findByTag(tag: string): WorkflowTemplate[] {
    return this.list().filter((t) => t.tags.includes(tag));
  }

  // 템플릿으로 워크플로우 생성
  createWorkflowFromTemplate(
    templateId: string,
    customerProfile: CustomerProfile
  ): Workflow | null {
    const template = this.templates.get(templateId);
    if (!template) {
      log.warn(`Template not found: ${templateId}`);
      return null;
    }

    log.info(`Creating workflow from template: ${template.name}`);

    return {
      id: nowId('workflow'),
      name: `${customerProfile.customerName} - ${template.name}`,
      description: template.description,
      customerProfile,
      steps: template.steps.map((step) => ({
        id: nowId('step'),
        name: step.toolName,
        description: `${step.toolName} 실행`,
        toolName: step.toolName,
        toolArgs: {},
        dependsOn: [],
        optional: step.optional || false,
        retryPolicy: {
          maxRetries: 2,
          backoff: 'exponential',
          retryOn: ['timeout', 'error'],
        },
        status: 'pending',
      })),
      reasoning: `템플릿 "${template.name}" 기반 워크플로우`,
      estimatedDuration: '약 10분',
      estimatedCost: '약 5000 tokens',
      status: 'draft',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
  }

  // 템플릿 삭제
  unregister(templateId: string): boolean {
    const existed = this.templates.has(templateId);
    this.templates.delete(templateId);
    if (existed) {
      log.info(`Unregistered template: ${templateId}`);
    }
    return existed;
  }

  // 템플릿 검색
  search(query: string): WorkflowTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.list().filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some((tag) => tag.includes(lowerQuery))
    );
  }
}
