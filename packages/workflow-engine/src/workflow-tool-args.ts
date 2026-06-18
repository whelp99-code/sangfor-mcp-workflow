/**
 * Workflow step default tool arguments
 */

import type { CustomerProfile } from './types.js';

const DEFAULT_EXCEL_PATH = './test-data/checklist.xlsx';

export function resolveExcelFilePath(profile: CustomerProfile): string {
  return profile.metadata?.excelFilePath || DEFAULT_EXCEL_PATH;
}

export function buildWorkflowToolArgs(
  toolName: string,
  profile: CustomerProfile,
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const excelPath = resolveExcelFilePath(profile);
  const primaryProduct = profile.products[0] ?? 'IAG';

  switch (toolName) {
    case 'import_excel':
      args.filePath = excelPath;
      break;
    case 'analyze_requirements':
      args.requirements = profile.requirements.map((r) => r.text);
      args.products = profile.products;
      break;
    case 'generate_change_plan':
      args.products = profile.products;
      args.customerName = profile.customerName;
      break;
    case 'capture_screenshots':
      args.product = mapProductToMcpCode(primaryProduct);
      args.products = profile.products.map(mapProductToMcpCode);
      break;
    case 'generate_evidence_report':
      args.customerName = profile.customerName;
      args.filePath = excelPath;
      break;
    case 'search_manuals':
      args.product = mapProductToMcpCode(primaryProduct);
      args.query = profile.requirements.map((r) => r.text).join(' ') || profile.customerName;
      break;
    case 'run_health_check':
      args.product = mapProductToMcpCode(primaryProduct);
      break;
    case 'generate_setting_guide_docx':
    case 'generate_setting_guide_pptx':
      args.filePath = excelPath;
      args.customerName = profile.customerName;
      break;
  }

  return args;
}

function mapProductToMcpCode(product: string): string {
  switch (product) {
    case 'ENDPOINT_SECURE':
      return 'EPP';
    case 'CYBER_COMMAND':
      return 'CC';
    case 'IAG':
      return 'IAG';
    default:
      return product;
  }
}
