/*
 * Case E4: LiDAR down (fallback anchor).
 * LiDAR is DOWN; the first RFID or ANPR event opens the passage as a fallback anchor.
 * No LiDAR class is available, and the passage is flagged FALLBACK_ANCHOR and DEGRADED_FUSION.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseE4: CaseDefinition = {
  id: 'E4',
  group: 'E',
  group_name: 'Device health',
  name: 'LiDAR down (fallback anchor)',
  summary: 'First RFID/ANPR event opens passage; flagged FALLBACK_ANCHOR and DEGRADED_FUSION.',
  expected_summary: 'STT (FALLBACK_ANCHOR + DEGRADED_FUSION)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `KA01ED${sfx}`;
    const tagId = `TAG-E4-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      { type: 'SET_DEVICE_STATE', delay_ms: 0, source: 'LIDAR', state: 'DOWN', reason: 'Simulated LiDAR outage' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`E4-${sfx}`, laneId, plate, tagId, 'VC4', 60) },
      { type: 'SET_DEVICE_STATE', delay_ms: 9800, source: 'LIDAR', state: 'UP', reason: 'Restored after case E4' },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    required_flags: ['FALLBACK_ANCHOR', 'DEGRADED_FUSION'],
  },
};
