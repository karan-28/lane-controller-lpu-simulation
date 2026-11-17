/*
 * Case E2: Rear ANPR down.
 * Rear ANPR is marked DOWN; fusion continues on RFID, Front ANPR, and LiDAR.
 * Expected outcome: straight-through flagged DEGRADED_FUSION.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseE2: CaseDefinition = {
  id: 'E2',
  group: 'E',
  group_name: 'Device health',
  name: 'Rear ANPR down',
  summary: 'Fusion continues on RFID, Front ANPR, and LiDAR; passage flagged degraded.',
  expected_summary: 'STT (flagged DEGRADED_FUSION)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `MH12EB${sfx}`;
    const tagId = `TAG-E2-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      { type: 'SET_DEVICE_STATE', delay_ms: 0, source: 'RANPR', state: 'DOWN', reason: 'Simulated Rear ANPR failure' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`E2-${sfx}`, laneId, plate, tagId, 'VC4', 60) },
      { type: 'SET_DEVICE_STATE', delay_ms: 9800, source: 'RANPR', state: 'UP', reason: 'Restored after case E2' },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    required_flags: ['DEGRADED_FUSION'],
  },
};
