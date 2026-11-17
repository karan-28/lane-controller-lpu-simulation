/*
 * Case F3: Out-of-order delivery.
 * Transport delivers Rear ANPR (lpu_offset +100 ms) BEFORE Front ANPR (lpu_offset +500 ms),
 * even though Front ANPR's device_ts (-300 ms) precedes Rear ANPR (+850 ms).
 * The engine matches by device_ts and fuses cleanly straight-through.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseF3: CaseDefinition = {
  id: 'F3',
  group: 'F',
  group_name: 'Timing and ordering',
  name: 'Out-of-order transport delivery',
  summary: 'Rear ANPR arrives before Front ANPR; engine fuses by device timestamp.',
  expected_summary: 'STT (RFID+FANPR+RANPR+LIDAR)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `KA02FC${sfx}`;
    const tagId = `TAG-F3-${sfx}`;
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
        script: {
          script_id: `F3-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 62,
          lane_id: laneId,
          events: [
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 20 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 100, plate_confidence: 0.96 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 220, rssi: -54 },
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: 500, plate_confidence: 0.97 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    decision_log_includes: ['All three sources'],
  },
};
