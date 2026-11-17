/*
 * Case B1: Rear misread by one character.
 * Front ANPR reads the true plate while Rear ANPR misreads one character after O/0, I/1, B/8 normalisation.
 * Under provisional rules, normalised edit distance 1 fuses straight-through with a confidence penalty and flag.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseB1: CaseDefinition = {
  id: 'B1',
  group: 'B',
  group_name: 'Plate problems',
  name: 'Rear misread by one character',
  summary: 'Normalised edit distance 1 between front and rear; fuses with lowered confidence.',
  expected_summary: 'STT (flagged EDIT_DISTANCE_1)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `MH12BA${sfx}`;
    const rearMisread = `MH12BA${sfx.slice(0, -1)}9`.slice(0, plate.length);
    const fixedRear = rearMisread === plate ? `MH12BA${sfx.slice(0, -1)}7` : rearMisread;
    const tagId = `TAG-B1-${sfx}`;
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
          script_id: `B1-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 60,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_text: plate, plate_confidence: 0.97 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -55 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_text: fixedRear, plate_confidence: 0.93 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    required_flags: ['EDIT_DISTANCE_1'],
  },
};
