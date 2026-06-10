/**
 * Compliance Change Detector — Compliance 변화 감지
 */

import { createLogger } from '@sangfor/workflow-shared';
import type { ComplianceRecord, ComplianceAnalysis, ComplianceChange } from './compliance-tracker.js';

const log = createLogger('compliance-change-detector');

export class ComplianceChangeDetector {
  detectChanges(previous: ComplianceRecord, current: ComplianceAnalysis): ComplianceChange[] {
    const changes: ComplianceChange[] = [];

    for (const currentItem of current.items) {
      const previousItem = previous.items.find(i => i.id === currentItem.id);
      if (previousItem) {
        const change = currentItem.result - previousItem.result;
        if (Math.abs(change) > 0.01) {
          changes.push({
            itemId: currentItem.id,
            category: currentItem.category,
            item: currentItem.item,
            previousResult: previousItem.result,
            currentResult: currentItem.result,
            change,
            reason: this.determineReason(change),
          });
        }
      }
    }

    log.info(`Detected ${changes.length} changes`);
    return changes;
  }

  private determineReason(change: number): string {
    if (change > 0.5) return '크게 개선';
    if (change > 0.1) return '개선';
    if (change < -0.5) return '크게 악화';
    if (change < -0.1) return '악화';
    return '미미한 변화';
  }
}
