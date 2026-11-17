/*
 * Case E1: Front ANPR down.
 * Front ANPR is marked DOWN; fusion continues on RFID, Rear ANPR, and LiDAR.
 * Expected outcome: straight-through flagged DEGRADED_FUSION with missing source reason.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseE1: CaseDefinition = {
  id: 'E1',
  group: 'E',
  group_name: 'Device health',
  name: 'Front ANPR down',
  summary: 'Fusion continues on RFID, Rear ANPR, and LiDAR; passage flagged degraded.',
  expected_summary: 'STT (flagged DEGRADED_FUSION)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `MH12EA${sfx}`;
    const tagId = `TAG-E1-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      { type: 'SET_DEVICE_STATE', delay_ms: 0, source: 'FANPR', state: 'DOWN', reason: 'Simulated Front ANPR failure' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`E1-${sfx}`, laneId, plate, tagId, 'VC4', 60) },
      { type: 'SET_DEVICE_STATE', delay_ms: 9800, source: 'FANPR', state: 'UP', reason: 'Restored after case E1' },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    required_flags: ['DEGRADED_FUSION'],
  },
};
