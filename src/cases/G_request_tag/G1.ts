/*
 * Case G1: Request Tag lookup timeout.
 * Request Tag override is set to timeout. RFID misses while Front and Rear ANPR agree.
 * The passage waits through 1 retry after timeout, then decides with what it has -> AUDIT_REQUIRED.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseG1: CaseDefinition = {
  id: 'G1',
  group: 'G',
  group_name: 'Request Tag behaviour',
  name: 'Lookup timeout (1 retry)',
  summary: 'Passage waits for timeout + 1 retry, then decides AUDIT_REQUIRED.',
  expected_summary: 'AUDIT_REQUIRED (timed out after 1 retry)',
  duration_ms: 10800,
  buildActions: (laneId, sfx) => {
    const plate = `MH12GA${sfx}`;
    return [
      { type: 'SET_REQUEST_TAG_OVERRIDE', delay_ms: 0, override: 'timeout' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`G1-${sfx}`, laneId, plate, null, 'VC4', 60) },
      { type: 'SET_REQUEST_TAG_OVERRIDE', delay_ms: 10200, override: 'normal' },
    ];
  },
  expected: {
    route: 'AUDIT_REQUIRED',
    exact_transactions: 1,
    reason_includes: ['timed out after 1 retry'],
  },
};
