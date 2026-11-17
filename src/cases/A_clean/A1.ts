/*
 * Case A1: All four sources agree (Clean flow backbone).
 * LiDAR detects a VC4 car, Front ANPR and Rear ANPR read the same plate,
 * and RFID reads a matching registered tag. Expected outcome: straight-through (STT).
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseA1: CaseDefinition = {
  id: 'A1',
  group: 'A',
  group_name: 'Clean flow',
  name: 'All four sources agree',
  summary: 'RFID, Front ANPR, Rear ANPR, and LiDAR all read and agree.',
  expected_summary: 'STT (RFID+FANPR+RANPR+LIDAR)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `MH12AA${sfx}`;
    const tagId = `TAG-A1-${sfx}`;
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
        script: makeCleanScript(`A1-${sfx}`, laneId, plate, tagId, 'VC4', 64),
      },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    decision_log_includes: ['agree'],
  },
};
