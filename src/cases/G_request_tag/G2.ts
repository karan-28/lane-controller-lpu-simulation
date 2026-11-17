/*
 * Case G2: Empty Request Tag result.
 * Request Tag returns 0 records for an unknown tag or plate.
 * Expected outcome: AUDIT_REQUIRED with empty-result reason.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseG2: CaseDefinition = {
  id: 'G2',
  group: 'G',
  group_name: 'Request Tag behaviour',
  name: 'Empty result (unknown tag/plate)',
  summary: 'Request Tag returns 0 records; routed to AUDIT_REQUIRED.',
  expected_summary: 'AUDIT_REQUIRED (empty result)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `DL09GB${sfx}`;
    const tagId = `TAG-G2-UNK-${sfx}`;
    return [
      { type: 'SET_REQUEST_TAG_OVERRIDE', delay_ms: 0, override: 'empty' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`G2-${sfx}`, laneId, plate, tagId, 'VC4', 60) },
      { type: 'SET_REQUEST_TAG_OVERRIDE', delay_ms: 9800, override: 'normal' },
    ];
  },
  expected: {
    route: 'AUDIT_REQUIRED',
    exact_transactions: 1,
    reason_includes: ['empty result'],
  },
};
