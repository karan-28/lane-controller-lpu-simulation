/*
 * Case B2: Front and rear disagree by more than one character.
 * Front ANPR and Rear ANPR read plates with edit distance > 1.
 * Expected outcome: AUDIT_REQUIRED (possible tailgating or misread).
 */
import type { CaseDefinition } from '../../domain/types';

export const caseB2: CaseDefinition = {
  id: 'B2',
  group: 'B',
  group_name: 'Plate problems',
  name: 'Front and rear disagree (>1 char)',
  summary: 'Front and rear plates differ beyond edit distance 1.',
  expected_summary: 'AUDIT_REQUIRED (plate mismatch)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const frontPlate = `MH12BB${sfx}`;
    const rearPlate = `DL99ZZ${sfx}`;
    const tagId = `TAG-B2-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate: frontPlate,
        candidates: [{ tag_id: tagId, plate: frontPlate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 1000,
        script: {
          script_id: `B2-${sfx}`,
          true_plate: frontPlate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 60,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_text: frontPlate, plate_confidence: 0.96 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -55 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_text: rearPlate, plate_confidence: 0.95 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'AUDIT_REQUIRED',
    exact_transactions: 1,
    reason_includes: ['disagree beyond edit distance 1'],
  },
};
