/*
 * Case C3: Tag registered to a different plate.
 * RFID reads a tag whose Request Tag record belongs to a completely different plate than ANPR reads.
 * Expected outcome: AUDIT_REQUIRED with tag-plate mismatch reason.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseC3: CaseDefinition = {
  id: 'C3',
  group: 'C',
  group_name: 'RFID problems',
  name: 'Tag registered to a different plate',
  summary: 'Request Tag plate for the RFID tag disagrees with ANPR plate reads.',
  expected_summary: 'AUDIT_REQUIRED (TAG_PLATE_MISMATCH)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const anprPlate = `MH12CC${sfx}`;
    const registeredOtherPlate = `DL99XX${sfx}`;
    const tagId = `TAG-C3-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate: registeredOtherPlate,
        candidates: [
          { tag_id: tagId, plate: registeredOtherPlate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' },
        ],
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 1000,
        script: {
          script_id: `C3-${sfx}`,
          true_plate: anprPlate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 60,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_text: anprPlate, plate_confidence: 0.97 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, tag_id: tagId, rssi: -55 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_text: anprPlate, plate_confidence: 0.96 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'AUDIT_REQUIRED',
    exact_transactions: 1,
    required_flags: ['TAG_PLATE_MISMATCH'],
  },
};
