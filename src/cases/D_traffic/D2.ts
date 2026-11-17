/*
 * Case D2: Straddling two lanes.
 * One vehicle straddles the lane divider, producing partial events on the target lane and adjacent lane.
 * Each lane fuses what it sees; cross-lane deduplication is explicitly back-office scope.
 */
import type { CaseDefinition } from '../../domain/types';
import { adjacentLane } from '../helpers';

export const caseD2: CaseDefinition = {
  id: 'D2',
  group: 'D',
  group_name: 'Traffic and behaviour',
  name: 'Straddling two lanes',
  summary: 'Partial reads across two lanes; each lane fuses independently (cross-lane dedup is back-office).',
  expected_summary: '2 partial lane fusions (STT)',
  duration_ms: 11000,
  buildActions: (laneId, sfx) => {
    const plate = `GJ01DC${sfx}`;
    const tagId = `TAG-D2-${sfx}`;
    const adj = adjacentLane(laneId);
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC5', status: 'VALID', issue_date: '2025-05-01' }],
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 1000,
        script: {
          script_id: `D2-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC5',
          speed_kmph: 58,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.96 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -58 },
            { source: 'LIDAR', lane_override: adj, device_offset_ms: 40, lpu_offset_ms: 65 },
            { source: 'RANPR', lane_override: adj, device_offset_ms: 850, lpu_offset_ms: 910, plate_confidence: 0.95 },
          ],
        },
      },
    ];
  },
  expected: {
    exact_transactions: 2,
    expected_routes: ['STT', 'STT'],
  },
};
