#!/usr/bin/env node
/**
 * ITAC-style sample checklist for tests and Operator Console compliance upload.
 * Structure matches packages/workflow-engine/src/excel-parser.ts (PR-01).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'test-data');
const outPath = join(outDir, 'checklist.xlsx');

mkdirSync(outDir, { recursive: true });

const rows = [
  ['ITAC Security Checklist', '', '', '', '', '', '', '', '', '', ''],
  ['Customer Sample', '', '', '', '', '', '', '', '', '', ''],
  ['Generated for sangfor-mcp-workflow', '', '', '', '', '', '', '', '', '', ''],
  [
    'No',
    'Category',
    'Solution',
    'Item',
    'Specific details',
    'Internet (VPN,F/W,DMZ)',
    'Office',
    'Production',
    'Server',
    'Results',
    'Reason for Inspection Results',
  ],
  [1, 'Malware', 'Anti-Virus', 'Real-time scan', 'Enable real-time protection', 'O', 'O', 'O', 'O', 1, ''],
  [2, 'Malware', 'Anti-Virus', 'Engine update', 'Keep AV engine current', 'O', 'O', 'O', 'O', 0, 'Engine outdated'],
  [3, 'Endpoint', 'Software Control', 'Unauthorized software', 'Block unauthorized apps', 'O', 'O', '', 'O', 1, ''],
  [4, 'Endpoint', 'Device Control', 'USB storage', 'Block USB storage media', 'O', 'O', 'O', '', 1, ''],
  [5, 'Network', 'Data Loss Prevention', 'DLP policy', 'Apply DLP for sensitive data', 'O', 'O', 'O', 'O', 0, 'Policy missing'],
  [6, 'Network', 'Anti-Spam', 'Email filtering', 'Block spam and phishing', 'O', '', 'O', 'O', 1, ''],
  [7, 'Access', 'Network Access Contro', 'NAC policy', 'Enforce network access control', 'O', 'O', 'O', 'O', 1, ''],
  [8, 'Monitoring', 'Log Management', 'Centralized logging', 'Forward logs to SIEM', 'O', 'O', 'O', 'O', 0, 'Syslog not configured'],
  [9, 'Monitoring', 'Security Monitoring', 'Alert rules', 'Configure security alerts', 'O', 'O', 'O', 'O', 1, ''],
  [10, 'Endpoint', 'System Management', 'Agent deployment', 'Deploy endpoint agents', 'O', 'O', 'O', 'O', 1, ''],
  // Row without Result — should be skipped by parser
  [11, 'Policy', 'Policy and Procedure', 'Security policy', 'Document security policy', 'O', 'O', 'O', 'O', '', ''],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, 'Checklist');
XLSX.writeFile(wb, outPath);

writeFileSync(join(outDir, '.gitkeep'), '');
console.log(`Wrote ${outPath} (${rows.length - 4} data rows, 10 with Results)`);
