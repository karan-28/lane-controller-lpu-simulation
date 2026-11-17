/*
 * Case A4: Tag not read, front and rear plates agree.
 * RFID misses the windshield tag, while Front and Rear ANPR read the same plate.
 * Request Tag confirms the tag by plate lookup. Expected outcome: straight-through.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseA4: CaseDefinition = {
  id: 'A4',
  group: 'A',
  group_name: 'Clean flow',
  name: 'Tag not read, front and rear agree',
  summary: 'RFID missed; Front and Rear ANPR agree and Request Tag finds tag.',
  expected_summary: 'STT (tag via Request Tag)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `KA03AD${sfx}`;
    const tagId = `TAG-A4-${sfx}`;
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
        script: makeCleanScript(`A4-${sfx}`, laneId, plate, null, 'VC4', 65),
      },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    decision_log_includes: ['Request Tag'],
  },
};
