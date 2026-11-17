/*
 * Case G4: Request Tag cache hit.
 * A vehicle passes once (cache miss with simulated latency) and passes again inside 10 minutes.
 * The second pass resolves immediately from the 10-minute Request Tag cache (cache_hit=true, 0 ms).
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseG4: CaseDefinition = {
  id: 'G4',
  group: 'G',
  group_name: 'Request Tag behaviour',
  name: '10-minute cache hit',
  summary: 'Second pass within 10 minutes hits Request Tag cache without re-calling.',
  expected_summary: '2x STT (2nd lookup cache_hit=true)',
  duration_ms: 20000,
  buildActions: (laneId, sfx) => {
    const plate = `GJ03GD${sfx}`;
    const tagId = `TAG-G4-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`G4-1-${sfx}`, laneId, plate, tagId, 'VC4', 60) },
      { type: 'VEHICLE_SCRIPT', delay_ms: 10500, script: makeCleanScript(`G4-2-${sfx}`, laneId, plate, tagId, 'VC4', 60) },
    ];
  },
  expected: {
    exact_transactions: 2,
    expected_routes: ['STT', 'STT'],
    expect_cache_hit_on_last: true,
  },
};
