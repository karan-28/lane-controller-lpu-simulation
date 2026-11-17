import type { DeviceState, RouteDecision } from '../domain/types';

export const PASSAGE_CHIP_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-indigo-600',
  'bg-rose-600',
  'bg-cyan-700',
  'bg-violet-600',
  'bg-teal-700',
];

export function DeviceChip({ state }: { state: DeviceState }) {
  const cls =
    state === 'UP'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : state === 'DEGRADED'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-red-50 text-red-800 border-red-200';
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-tight whitespace-nowrap ${cls}`}>
      {state}
    </span>
  );
}

export function RouteChip({ route }: { route: RouteDecision }) {
  const isStt = route === 'STT';
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-tight whitespace-nowrap ${
        isStt
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-red-50 text-red-800 border-red-200'
      }`}
    >
      {isStt ? 'STT' : 'AUDIT'}
    </span>
  );
}

export function TagChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'amber' | 'red' | 'blue' | 'green';
}) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : tone === 'red'
        ? 'bg-red-50 text-red-800 border-red-200'
        : tone === 'blue'
          ? 'bg-blue-50 text-blue-800 border-blue-200'
          : tone === 'green'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium tracking-tight whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

export function PassFailChip({ status }: { status: 'PASS' | 'FAIL' | 'RUNNING' }) {
  const cls =
    status === 'PASS'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : status === 'FAIL'
        ? 'bg-red-50 text-red-800 border-red-200'
        : 'bg-blue-50 text-blue-800 border-blue-200';
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-tight whitespace-nowrap ${cls}`}>
      {status}
    </span>
  );
}
