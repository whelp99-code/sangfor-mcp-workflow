/**
 * Dependency Analyzer — tool 간 의존성 분석
 */

import { createLogger } from '@sangfor/workflow-shared';
import type { ToolDefinition, ToolDependency } from './types.js';

const log = createLogger('dependency-analyzer');

export class DependencyAnalyzer {
  // 기본 의존성 규칙 (sangfor-engineer-mcp 기반)
  private defaultDependencies: ToolDependency[] = [
    {
      sourceTool: 'analyze_requirements',
      targetTool: 'import_excel',
      required: true,
      fieldMapping: { rows: 'excelData' },
    },
    {
      sourceTool: 'generate_change_plan',
      targetTool: 'analyze_requirements',
      required: true,
      fieldMapping: { tasks: 'requirements' },
    },
    {
      sourceTool: 'generate_setting_guide_docx',
      targetTool: 'generate_change_plan',
      required: true,
      fieldMapping: { planId: 'changePlan' },
    },
    {
      sourceTool: 'generate_setting_guide_pptx',
      targetTool: 'generate_change_plan',
      required: true,
      fieldMapping: { planId: 'changePlan' },
    },
    {
      sourceTool: 'capture_screenshots',
      targetTool: 'generate_setting_guide_pptx',
      required: false,
      fieldMapping: {},
    },
    {
      sourceTool: 'generate_evidence_report',
      targetTool: 'generate_setting_guide_docx',
      required: true,
      fieldMapping: { files: 'guideFiles' },
    },
    {
      sourceTool: 'generate_evidence_report',
      targetTool: 'capture_screenshots',
      required: false,
      fieldMapping: { screenshots: 'screenshots' },
    },
  ];

  // 의존성 분석
  analyzeDependencies(tools: ToolDefinition[]): ToolDependency[] {
    const toolNames = new Set(tools.map((t) => t.name));
    const dependencies: ToolDependency[] = [];

    // 기본 의존성 필터링
    for (const dep of this.defaultDependencies) {
      if (toolNames.has(dep.sourceTool) && toolNames.has(dep.targetTool)) {
        dependencies.push(dep);
      }
    }

    // 추가 의존성 감지 (입력/출력 스키마 기반)
    const inferredDeps = this.inferDependenciesFromSchemas(tools);
    for (const dep of inferredDeps) {
      // 중복 확인
      const exists = dependencies.some(
        (d) => d.sourceTool === dep.sourceTool && d.targetTool === dep.targetTool
      );
      if (!exists) {
        dependencies.push(dep);
      }
    }

    log.info(`Analyzed dependencies: ${dependencies.length} found`);
    return dependencies;
  }

  // 스키마 기반 의존성 추론
  private inferDependenciesFromSchemas(tools: ToolDefinition[]): ToolDependency[] {
    const dependencies: ToolDependency[] = [];

    for (const sourceTool of tools) {
      if (!sourceTool.inputSchema?.properties) continue;

      const inputFields = Object.keys(sourceTool.inputSchema.properties);

      for (const targetTool of tools) {
        if (sourceTool.name === targetTool.name) continue;
        if (!targetTool.outputSchema?.properties) continue;

        const outputFields = Object.keys(targetTool.outputSchema.properties);

        // 입력 필드와 출력 필드 매칭
        const matchingFields = inputFields.filter((f) => outputFields.includes(f));
        if (matchingFields.length > 0) {
          const fieldMapping: Record<string, string> = {};
          for (const field of matchingFields) {
            fieldMapping[field] = field;
          }

          dependencies.push({
            sourceTool: sourceTool.name,
            targetTool: targetTool.name,
            required: true,
            fieldMapping,
          });
        }
      }
    }

    return dependencies;
  }

  // 의존성 그래프 생성
  buildDependencyGraph(
    tools: ToolDefinition[],
    dependencies: ToolDependency[]
  ): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    // 모든 tool 초기화
    for (const tool of tools) {
      graph.set(tool.name, new Set());
    }

    // 의존성 추가
    for (const dep of dependencies) {
      graph.get(dep.targetTool)?.add(dep.sourceTool);
    }

    return graph;
  }

  // 순환 의존성 검사
  detectCycles(dependencies: ToolDependency[]): string[][] {
    const graph = new Map<string, Set<string>>();
    const cycles: string[][] = [];

    // 그래프 구축
    for (const dep of dependencies) {
      if (!graph.has(dep.sourceTool)) graph.set(dep.sourceTool, new Set());
      if (!graph.has(dep.targetTool)) graph.set(dep.targetTool, new Set());
      graph.get(dep.sourceTool)!.add(dep.targetTool);
    }

    // DFS로 순환 감지
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      for (const neighbor of graph.get(node) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          // 순환 발견
          const cycleStart = path.indexOf(neighbor);
          cycles.push(path.slice(cycleStart));
        }
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    if (cycles.length > 0) {
      log.warn(`Detected ${cycles.length} circular dependencies`);
    }

    return cycles;
  }

  // 의존성 검증
  validateDependencies(
    tools: ToolDefinition[],
    dependencies: ToolDependency[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. 존재하지 않는 tool 참조 확인
    const toolNames = new Set(tools.map((t) => t.name));
    for (const dep of dependencies) {
      if (!toolNames.has(dep.sourceTool)) {
        errors.push(`Dependency references non-existent tool: ${dep.sourceTool}`);
      }
      if (!toolNames.has(dep.targetTool)) {
        errors.push(`Dependency references non-existent tool: ${dep.targetTool}`);
      }
    }

    // 2. 순환 의존성 확인
    const cycles = this.detectCycles(dependencies);
    if (cycles.length > 0) {
      errors.push(`Circular dependencies detected: ${cycles.map((c) => c.join(' → ')).join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }
}
