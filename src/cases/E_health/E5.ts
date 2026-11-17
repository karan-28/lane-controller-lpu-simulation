/*
 * Case E5: Flapping device.
 * Front ANPR transitions DOWN -> UP -> DOWN across three passing vehicles.
 * The device health log and per-passage degradation flags track every state change.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseE5: CaseDefinition = {
  id: 'E5',
  group: 'E',
  group_name: 'Device health',
  name: 'Flapping device (DOWN/UP/DOWN)',
  summary: 'Front ANPR flaps across three vehicles; health log and flags follow each transition.',
  expected_summary: '3x STT (1st & 3rd degraded, 2nd clean)',
  duration_ms: 28000,
  buildActions: (laneId, sfx) => {
    const p1 = `MH12E5A${sfx.slice(-2)}`;
    const p2 = `MH12E5B${sfx.slice(-2)}`;
    const p3 = `MH12E5C${sfx.slice(-2)}`;
    const t1 = `TAG-E5A-${sfx}`;
    const t2 = `TAG-E5B-${sfx}`;
    const t3 = `TAG-E5C-${sfx}`;
    return [
      { type: 'REGISTER_TAG', delay_ms: 0, plate: p1, candidates: [{ tag_id: t1, plate: p1, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }] },
      { type: 'REGISTER_TAG', delay_ms: 0, plate: p2, candidates: [{ tag_id: t2, plate: p2, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }] },
      { type: 'REGISTER_TAG', delay_ms: 0, plate: p3, candidates: [{ tag_id: t3, plate: p3, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }] },
      { type: 'SET_DEVICE_STATE', delay_ms: 0, source: 'FANPR', state: 'DOWN', reason: 'Flap cycle 1: DOWN' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 500, script: makeCleanScript(`E5-1-${sfx}`, laneId, p1, t1, 'VC4', 60) },
      { type: 'SET_DEVICE_STATE', delay_ms: 9200, source: 'FANPR', state: 'UP', reason: 'Flap cycle 2: RECOVERED' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 9600, script: makeCleanScript(`E5-2-${sfx}`, laneId, p2, t2, 'VC4', 60) },
      { type: 'SET_DEVICE_STATE', delay_ms: 18400, source: 'FANPR', state: 'DOWN', reason: 'Flap cycle 3: DOWN' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 18800, script: makeCleanScript(`E5-3-${sfx}`, laneId, p3, t3, 'VC4', 60) },
      { type: 'SET_DEVICE_STATE', delay_ms: 27400, source: 'FANPR', state: 'UP', reason: 'Restored after flap test' },
    ];
  },
  expected: {
    exact_transactions: 3,
    expected_routes: ['STT', 'STT', 'STT'],
    required_flags: ['DEGRADED_FUSION'],
    expect_health_log_contains: ['DOWN', 'UP', 'DOWN'],
  },
};
