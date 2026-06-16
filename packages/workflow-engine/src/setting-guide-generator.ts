/**
 * Setting Guide Generator — 설정 가이드 자동 생성
 */

import { nowId, nowISO, createLogger } from '@sangfor/workflow-shared';

const log = createLogger('setting-guide-generator');

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface SettingGuideRequest {
  customer: string;
  product: 'EPP' | 'IAG' | 'CC';
  requirements: string[];
  currentConfig?: Record<string, any>;
  targetCompliance?: number;
}

export interface SettingGuide {
  id: string;
  customer: string;
  product: string;
  title: string;
  createdAt: string;
  sections: GuideSection[];
  summary: string;
  estimatedTime: string;
}

export interface GuideSection {
  id: string;
  title: string;
  description: string;
  menuPath: string[];
  steps: GuideStep[];
  screenshots: string[];
  notes: string[];
}

export interface GuideStep {
  id: string;
  order: number;
  action: string;
  description: string;
  expectedResult: string;
  troubleshooting?: string;
}

// ─── 설정 가이드 생성기 ────────────────────────────────────────────────────

export class SettingGuideGenerator {
  // 설정 가이드 생성
  async generateGuide(request: SettingGuideRequest): Promise<SettingGuide> {
    log.info(`Generating setting guide: ${request.customer} - ${request.product}`);

    const guide: SettingGuide = {
      id: nowId('guide'),
      customer: request.customer,
      product: request.product,
      title: `${request.customer} ${request.product} 설정 가이드`,
      createdAt: nowISO(),
      sections: [],
      summary: '',
      estimatedTime: '',
    };

    // 요구사항별 섹션 생성
    for (const requirement of request.requirements) {
      const section = await this.generateSection(request.product, requirement);
      guide.sections.push(section);
    }

    // 요약 생성
    guide.summary = this.generateSummary(guide);
    guide.estimatedTime = this.estimateTime(guide);

    log.info(`Generated guide with ${guide.sections.length} sections`);
    return guide;
  }

  // 섹션 생성
  private async generateSection(
    product: string,
    requirement: string
  ): Promise<GuideSection> {
    const section: GuideSection = {
      id: nowId('section'),
      title: requirement,
      description: `${product}에서 ${requirement} 설정 방법`,
      menuPath: this.getMenuPath(product, requirement),
      steps: [],
      screenshots: [],
      notes: [],
    };

    // 요구사항별 단계 생성
    section.steps = this.generateSteps(product, requirement);

    return section;
  }

  // 단계 생성
  private generateSteps(product: string, requirement: string): GuideStep[] {
    const steps: GuideStep[] = [];

    // 제품별 기본 단계
    steps.push({
      id: nowId('step'),
      order: 1,
      action: '로그인',
      description: `${product} 콘솔에 로그인합니다.`,
      expectedResult: '대시보드 표시',
    });

    steps.push({
      id: nowId('step'),
      order: 2,
      action: '메뉴 이동',
      description: `${this.getMenuPath(product, requirement).join(' > ')} 메뉴로 이동합니다.`,
      expectedResult: '설정 화면 표시',
    });

    steps.push({
      id: nowId('step'),
      order: 3,
      action: '설정 확인',
      description: `현재 ${requirement} 설정을 확인합니다.`,
      expectedResult: '현재 설정 값 표시',
    });

    steps.push({
      id: nowId('step'),
      order: 4,
      action: '설정 변경',
      description: `${requirement} 설정을 변경합니다.`,
      expectedResult: '설정 변경 완료',
      troubleshooting: '설정 변경이 안 되는 경우 관리자 권한 확인',
    });

    steps.push({
      id: nowId('step'),
      order: 5,
      action: '저장 및 적용',
      description: '변경된 설정을 저장하고 적용합니다.',
      expectedResult: '설정 적용 완료',
    });

    steps.push({
      id: nowId('step'),
      order: 6,
      action: '검증',
      description: `${requirement} 설정이 제대로 적용되었는지 확인합니다.`,
      expectedResult: '설정 정상 동작 확인',
    });

    return steps;
  }

  // 메뉴 경로 조회
  private getMenuPath(product: string, requirement: string): string[] {
    const menuMap: Record<string, Record<string, string[]>> = {
      EPP: {
        '안티바이러스': ['Defense', 'Malware Scan'],
        '악성코드': ['Defense', 'Malware Scan'],
        '소프트웨어 제어': ['Policies', 'App Control'],
        '장치 제어': ['Policies', 'Behavior Control'],
        'USB': ['Policies', 'Behavior Control'],
        '로그': ['System', 'Syslog'],
        '업데이트': ['System', 'Update Management'],
      },
      IAG: {
        'URL 필터링': ['Security', 'URL Filtering'],
        'DLP': ['Security', 'Data Loss Prevention'],
        '데이터 유출': ['Security', 'Data Loss Prevention'],
        '이메일': ['Security', 'Email Filtering'],
        '방화벽': ['Network', 'Firewall'],
        'VPN': ['Network', 'VPN'],
      },
      CC: {
        '위협': ['Detection', 'Threats'],
        '로그': ['Detection', 'Logs'],
        '이상': ['Detection', 'Anomalies'],
        '센서': ['System', 'Sensors'],
      },
    };

    const productMenus = menuMap[product] || {};
    for (const [keyword, path] of Object.entries(productMenus)) {
      if (requirement.includes(keyword)) {
        return path;
      }
    }

    return ['Settings'];
  }

  // 요약 생성
  private generateSummary(guide: SettingGuide): string {
    return `${guide.customer}의 ${guide.product} 설정 가이드입니다. ` +
      `총 ${guide.sections.length}개 섹션으로 구성되어 있습니다.`;
  }

  // 예상 시간 계산
  private estimateTime(guide: SettingGuide): string {
    const totalSteps = guide.sections.reduce((sum, s) => sum + s.steps.length, 0);
    const minutes = totalSteps * 5; // 단계당 5분
    return `약 ${minutes}분`;
  }

  // Markdown 생성
  generateMarkdown(guide: SettingGuide): string {
    const lines: string[] = [];

    lines.push(`# ${guide.title}`);
    lines.push('');
    lines.push(`작성일: ${new Date(guide.createdAt).toLocaleDateString('ko-KR')}`);
    lines.push(`예상 소요 시간: ${guide.estimatedTime}`);
    lines.push('');

    lines.push('## 요약');
    lines.push('');
    lines.push(guide.summary);
    lines.push('');

    for (const section of guide.sections) {
      lines.push(`## ${section.title}`);
      lines.push('');
      lines.push(section.description);
      lines.push('');
      lines.push(`**메뉴 경로**: ${section.menuPath.join(' > ')}`);
      lines.push('');

      lines.push('### 설정 단계');
      lines.push('');
      for (const step of section.steps) {
        lines.push(`${step.order}. **${step.action}**`);
        lines.push(`   ${step.description}`);
        lines.push(`   - 예상 결과: ${step.expectedResult}`);
        if (step.troubleshooting) {
          lines.push(`   - 문제 해결: ${step.troubleshooting}`);
        }
        lines.push('');
      }

      if (section.notes.length > 0) {
        lines.push('### 주의사항');
        lines.push('');
        for (const note of section.notes) {
          lines.push(`- ${note}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
