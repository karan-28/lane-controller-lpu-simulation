/*
 * Case F4: Replayed events after a link outage.
 * A vehicle passes and fuses into 1 transaction. Afterwards, replayed copies of its raw events
 * arrive with is_replay=true. They are stored and shown in raw feeds, but never re-fused.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseF4: CaseDefinition = {
  id: 'F4',
  group: 'F',
  group_name: 'Timing and ordering',
  name: 'Replayed events (is_replay=true)',
  summary: 'Replayed raw events are stored and visible, never re-fused into duplicate transactions.',
  expected_summary: '1x STT + replayed raw events stored',
  duration_ms: 11500,
  buildActions: (laneId, sfx) => {
    const plate = `TN07FD${sfx}`;
    const tagId = `TAG-F4-${sfx}`;
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
        script: makeCleanScript(`F4-ORIG-${sfx}`, laneId, plate, tagId, 'VC4', 60),
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 9500,
        script: {
          script_id: `F4-RPL-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 60,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -320, lpu_offset_ms: 10, is_replay: true, plate_confidence: 0.97 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 20, is_replay: true },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 30, is_replay: true, rssi: -52 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 40, is_replay: true, plate_confidence: 0.96 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    expect_replayed_events: true,
  },
};
