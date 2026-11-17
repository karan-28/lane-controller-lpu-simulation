/*
 * Case H2: Link restored and buffer replay.
 * After a transaction buffers while link is DOWN, restoring the link triggers sequential replay
 * with is_replay=true. Raw replay events are stored without re-fusing, and buffer drains to 0.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseH2: CaseDefinition = {
  id: 'H2',
  group: 'H',
  group_name: 'Link and recovery',
  name: 'Link restored (buffer drains)',
  summary: 'Restoring link replays buffered events in sequence with is_replay=true and drains buffer.',
  expected_summary: '1x STT + buffer drained + replay events stored',
  duration_ms: 12000,
  buildActions: (laneId, sfx) => {
    const plate = `MH12HB${sfx}`;
    const tagId = `TAG-H2-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      { type: 'SET_LINK_STATUS', delay_ms: 0, status: 'DOWN', reason: 'Outage before H2 vehicle' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`H2-${sfx}`, laneId, plate, tagId, 'VC4', 60) },
      { type: 'SET_LINK_STATUS', delay_ms: 9500, status: 'UP', reason: 'Plaza link restored' },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    expect_buffer_drained: true,
    expect_replayed_events: true,
  },
};
