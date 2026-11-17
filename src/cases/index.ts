import type { CaseDefinition } from '../domain/types';
import { caseA1 } from './A_clean/A1';
import { caseA2 } from './A_clean/A2';
import { caseA3 } from './A_clean/A3';
import { caseA4 } from './A_clean/A4';
import { caseA5 } from './A_clean/A5';
import { caseB1 } from './B_plate/B1';
import { caseB2 } from './B_plate/B2';
import { caseB3 } from './B_plate/B3';
import { caseB4 } from './B_plate/B4';
import { caseB5 } from './B_plate/B5';
import { caseB6 } from './B_plate/B6';
import { caseB7 } from './B_plate/B7';
import { caseC1 } from './C_rfid/C1';
import { caseC2 } from './C_rfid/C2';
import { caseC3 } from './C_rfid/C3';
import { caseC4 } from './C_rfid/C4';
import { caseD1 } from './D_traffic/D1';
import { caseD2 } from './D_traffic/D2';
import { caseD3 } from './D_traffic/D3';
import { caseD4 } from './D_traffic/D4';
import { caseD5 } from './D_traffic/D5';
import { caseE1 } from './E_health/E1';
import { caseE2 } from './E_health/E2';
import { caseE3 } from './E_health/E3';
import { caseE4 } from './E_health/E4';
import { caseE5 } from './E_health/E5';
import { caseE6 } from './E_health/E6';
import { caseF1 } from './F_timing/F1';
import { caseF2 } from './F_timing/F2';
import { caseF3 } from './F_timing/F3';
import { caseF4 } from './F_timing/F4';
import { caseG1 } from './G_request_tag/G1';
import { caseG2 } from './G_request_tag/G2';
import { caseG3 } from './G_request_tag/G3';
import { caseG4 } from './G_request_tag/G4';
import { caseH1 } from './H_link/H1';
import { caseH2 } from './H_link/H2';
import { caseH3 } from './H_link/H3';

export const ALL_CASES: CaseDefinition[] = [
  caseA1,
  caseA2,
  caseA3,
  caseA4,
  caseA5,
  caseB1,
  caseB2,
  caseB3,
  caseB4,
  caseB5,
  caseB6,
  caseB7,
  caseC1,
  caseC2,
  caseC3,
  caseC4,
  caseD1,
  caseD2,
  caseD3,
  caseD4,
  caseD5,
  caseE1,
  caseE2,
  caseE3,
  caseE4,
  caseE5,
  caseE6,
  caseF1,
  caseF2,
  caseF3,
  caseF4,
  caseG1,
  caseG2,
  caseG3,
  caseG4,
  caseH1,
  caseH2,
  caseH3,
];

export interface CaseGroupMeta {
  group: CaseDefinition['group'];
  title: string;
  cases: CaseDefinition[];
}

export const CASE_GROUPS: CaseGroupMeta[] = [
  { group: 'A', title: 'A. Clean flow (volume backbone)', cases: ALL_CASES.filter((c) => c.group === 'A') },
  { group: 'B', title: 'B. Plate problems', cases: ALL_CASES.filter((c) => c.group === 'B') },
  { group: 'C', title: 'C. RFID problems', cases: ALL_CASES.filter((c) => c.group === 'C') },
  { group: 'D', title: 'D. Traffic and behaviour', cases: ALL_CASES.filter((c) => c.group === 'D') },
  { group: 'E', title: 'E. Device health', cases: ALL_CASES.filter((c) => c.group === 'E') },
  { group: 'F', title: 'F. Timing and ordering', cases: ALL_CASES.filter((c) => c.group === 'F') },
  { group: 'G', title: 'G. Request Tag behaviour', cases: ALL_CASES.filter((c) => c.group === 'G') },
  { group: 'H', title: 'H. Link and recovery', cases: ALL_CASES.filter((c) => c.group === 'H') },
];

export function getCaseById(id: string): CaseDefinition | undefined {
  return ALL_CASES.find((c) => c.id === id);
}
