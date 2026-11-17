/*
 * Case H3: Duplicate delivery (idempotent event_id).
 * The exact same event_id is delivered twice over the device transport.
 * The fusion engine ignores the duplicate idempotently and logs the duplicate delivery.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseH3: CaseDefinition = {
  id: 'H3',
  group: 'H',
  group_name: 'Link and recovery',
  name: 'Duplicate delivery (idempotent event_id)',
  summary: 'Delivering the same event_id twice changes nothing and logs the duplicate.',
  expected_summary: '1x STT + duplicate logged',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `TN01HC${sfx}`;
    const tagId = `TAG-H3-${sfx}`;
    const dupEventId = `EVT-H3-DUP-${sfx}`;
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
          script_id: `H3-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 60,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.97 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, fixed_event_id: dupEventId, rssi: -54 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 260, fixed_event_id: dupEventId, rssi: -54 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_confidence: 0.96 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    min_duplicates: 1,
  },
};
