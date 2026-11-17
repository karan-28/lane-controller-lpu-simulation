import type { ClockSpeed } from './types';

/**
 * Simulated demo clock seeded at 17 Nov 2026 09:00:00 IST (+05:30).
 * Screens and engine never read real Date.now() for operational timestamps.
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const DEMO_START_MS = Date.UTC(2026, 10, 17, 3, 30, 0, 0); // 2026-11-17 09:00:00.000 IST

export interface DemoClockState {
  nowMs: number;
  speed: ClockSpeed;
  paused: boolean;
}

export function createInitialClock(): DemoClockState {
  return {
    nowMs: DEMO_START_MS,
    speed: 1,
    paused: false,
  };
}

function toIstCalendarParts(demoMs: number) {
  const shifted = demoMs + IST_OFFSET_MS;
  const d = new Date(shifted);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    year: d.getUTCFullYear(),
    monthName: months[d.getUTCMonth()],
    day: String(d.getUTCDate()).padStart(2, '0'),
    hours: String(d.getUTCHours()).padStart(2, '0'),
    minutes: String(d.getUTCMinutes()).padStart(2, '0'),
    seconds: String(d.getUTCSeconds()).padStart(2, '0'),
    ms: String(d.getUTCMilliseconds()).padStart(3, '0'),
  };
}

/** Format: "17 Nov 2026 09:00:00 IST" */
export function formatDemoDateTime(demoMs: number): string {
  const p = toIstCalendarParts(demoMs);
  return `${p.day} ${p.monthName} ${p.year} ${p.hours}:${p.minutes}:${p.seconds} IST`;
}

/** Format: "09:00:00.125" */
export function formatDemoTimeMs(demoMs: number): string {
  const p = toIstCalendarParts(demoMs);
  return `${p.hours}:${p.minutes}:${p.seconds}.${p.ms}`;
}

/** Format: "09:00:00 IST" */
export function formatDemoTime(demoMs: number): string {
  const p = toIstCalendarParts(demoMs);
  return `${p.hours}:${p.minutes}:${p.seconds} IST`;
}

/** Format elapsed seconds/ms from a reference timestamp */
export function formatAgeSeconds(nowMs: number, pastMs: number): string {
  const diffSec = Math.max(0, (nowMs - pastMs) / 1000);
  if (diffSec < 60) {
    return `${diffSec.toFixed(1)}s`;
  }
  const mins = Math.floor(diffSec / 60);
  const secs = Math.floor(diffSec % 60);
  return `${mins}m ${secs}s`;
}
