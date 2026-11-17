/*
 * Case D4: Same plate twice inside 10 minutes.
 * The same vehicle passes through the lane twice within the 10-minute duplicate window.
 * Both passages are emitted (never silently dropped); the second is flagged POSSIBLE_DUPLICATE.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseD4: CaseDefinition = {
  id: 'D4',
  group: 'D',
  group_name: 'Traffic and behaviour',
  name: 'Same plate twice inside 10 minutes',
  summary: 'Second pass within 10m is flagged POSSIBLE_DUPLICATE and retained.',
  expected_summary: '2x STT (2nd flagged POSSIBLE_DUPLICATE)',
  duration_ms: 20000,
  buildActions: (laneId, sfx) => {
    const plate = `MH12DE${sfx}`;
    const tagId = `TAG-D4-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 1000,
        script: makeCleanScript(`D4-1-${sfx}`, laneId, plate, tagId, 'VC4', 60),
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 10500,
        script: makeCleanScript(`D4-2-${sfx}`, laneId, plate, tagId, 'VC4', 60),
      },
    ];
  },
  expected: {
    exact_transactions: 2,
    expected_routes: ['STT', 'STT'],
    required_flags: ['POSSIBLE_DUPLICATE'],
  },
};
