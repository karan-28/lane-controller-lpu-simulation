/*
 * Case E3: RFID reader down.
 * RFID reader is marked DOWN; Front and Rear ANPR plates agree and Request Tag confirms the tag.
 * Expected outcome: straight-through flagged DEGRADED_FUSION.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseE3: CaseDefinition = {
  id: 'E3',
  group: 'E',
  group_name: 'Device health',
  name: 'RFID reader down',
  summary: 'Plate-based fusion via Request Tag while RFID reader is DOWN.',
  expected_summary: 'STT (flagged DEGRADED_FUSION)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `DL04EC${sfx}`;
    const tagId = `TAG-E3-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      { type: 'SET_DEVICE_STATE', delay_ms: 0, source: 'RFID', state: 'DOWN', reason: 'Simulated RFID reader failure' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`E3-${sfx}`, laneId, plate, tagId, 'VC4', 62) },
      { type: 'SET_DEVICE_STATE', delay_ms: 9800, source: 'RFID', state: 'UP', reason: 'Restored after case E3' },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    required_flags: ['DEGRADED_FUSION'],
  },
};
