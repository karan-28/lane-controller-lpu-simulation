/*
 * Case B3: Low-confidence plate read below threshold.
 * Front ANPR reports plate confidence 0.61 (below 0.75 provisional threshold).
 * Expected outcome: flagged and routed to AUDIT_REQUIRED.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseB3: CaseDefinition = {
  id: 'B3',
  group: 'B',
  group_name: 'Plate problems',
  name: 'Low-confidence plate read',
  summary: 'ANPR confidence below 0.75 threshold flags passage for audit.',
  expected_summary: 'AUDIT_REQUIRED (LOW_CONFIDENCE_ANPR)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `KA02BC${sfx}`;
    const tagId = `TAG-B3-${sfx}`;
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
          script_id: `B3-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 61,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_text: plate, plate_confidence: 0.61 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -54 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_text: plate, plate_confidence: 0.94 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'AUDIT_REQUIRED',
    exact_transactions: 1,
    required_flags: ['LOW_CONFIDENCE_ANPR'],
  },
};
