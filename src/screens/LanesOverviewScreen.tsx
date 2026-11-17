import { Link, useNavigate } from 'react-router-dom';
import { formatDemoTime } from '../domain/clock';
import { getActivePreset } from '../domain/config';
import { healthKey } from '../domain/fusion';
import type { DeviceSource, LaneId } from '../domain/types';
import { useLpuStore } from '../store/useLpuStore';
import { RouteChip, TagChip } from '../components/StatusChips';

const SOURCE_SHORT: { source: DeviceSource; short: string; label: string }[] = [
  { source: 'RFID', short: 'RFID', label: 'RFID Reader' },
  { source: 'FANPR', short: 'FA', label: 'Front ANPR' },
  { source: 'RANPR', short: 'RA', label: 'Rear ANPR' },
  { source: 'LIDAR', short: 'LD', label: 'LiDAR' },
];

export function LanesOverviewScreen() {
  const navigate = useNavigate();
  const config = useLpuStore((s) => s.config);
  const clock = useLpuStore((s) => s.clock);
  const engine = useLpuStore((s) => s.engine);
  const activeCases = useLpuStore((s) => s.activeCases);
  const highlightedIds = useLpuStore((s) => s.highlightedIds);

  const txns = engine.transactions;
  const totalTxns = txns.length;
  const sttCount = txns.filter((t) => t.route === 'STT').length;
  const auditCount = txns.filter((t) => t.route === 'AUDIT_REQUIRED').length;
  const sttShare = totalTxns > 0 ? Math.round((sttCount / totalTxns) * 100) : null;

  const oneHourMs = 3_600_000;

  return (
    <div className="space-y-4">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-slate-900">
            Gantry Overview · {config.plazaId} / {config.gantryId}
          </h1>
          <p className="text-xs text-slate-600">
            Active preset: <span className="font-medium text-slate-800">{getActivePreset(config).name}</span>{' '}
            (provisional) · Click any lane to inspect raw device feeds, fusion timelines, and outcomes.
          </p>
        </div>
      </div>

      {/* Gantry Summary Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <div className="bg-white border border-slate-200 rounded p-2.5">
          <div className="text-[11px] text-slate-500">Vehicles today</div>
          <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">{totalTxns}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-2.5">
          <div className="text-[11px] text-slate-500">Straight-through</div>
          <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
            {sttShare !== null ? `${sttShare}%` : '—'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-2.5">
          <div className="text-[11px] text-slate-500">Audits</div>
          <div className="text-lg font-bold font-mono text-red-700 tabular-nums">{auditCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-2.5">
          <div className="text-[11px] text-slate-500">Orphans</div>
          <div className="text-lg font-bold font-mono text-amber-700 tabular-nums">
            {engine.orphans.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-2.5">
          <div className="text-[11px] text-slate-500">Late packets</div>
          <div className="text-lg font-bold font-mono text-amber-700 tabular-nums">
            {engine.latePackets.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-2.5">
          <div className="text-[11px] text-slate-500">Buffer depth</div>
          <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
            {engine.linkState.buffer_depth}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-2.5">
          <div className="text-[11px] text-slate-500">Plaza link (Sim.)</div>
          <div
            className={`text-lg font-bold font-mono ${
              engine.linkState.status === 'UP' ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {engine.linkState.status}
          </div>
        </div>
      </section>

      {/* Four Lane Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {config.lanes.map((lane) => {
          const lid: LaneId = lane.lane_id;
          const laneTxns = txns.filter((t) => t.lane_id === lid);
          const laneTxnsHour = laneTxns.filter((t) => clock.nowMs - t.passage_ts <= oneHourMs);
          const laneStt = laneTxns.filter((t) => t.route === 'STT').length;
          const laneAudit = laneTxns.filter((t) => t.route === 'AUDIT_REQUIRED').length;
          const laneSttShare =
            laneTxns.length > 0 ? `${Math.round((laneStt / laneTxns.length) * 100)}%` : '—';

          const devStates = SOURCE_SHORT.map((s) => ({
            ...s,
            health: engine.deviceHealth[healthKey(lid, s.source)],
          }));

          const anyDown = devStates.some((d) => d.health?.state === 'DOWN');
          const lidarDown = devStates.find((d) => d.source === 'LIDAR')?.health?.state === 'DOWN';
          const anyDegraded = devStates.some((d) => d.health?.state === 'DEGRADED');
          const anyDrift = devStates.some(
            (d) => Math.abs(d.health?.drift_ms ?? 0) > config.driftWarningMs
          );
          const isCaseRunning = activeCases.some((c) => c.laneId === lid);

          return (
            <div
              key={lid}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/lane/${lid}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/lane/${lid}`);
                }
              }}
              className="bg-white border border-slate-200 hover:border-blue-600 rounded p-3.5 cursor-pointer transition-colors flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                  <div>
                    <span className="text-sm font-bold text-slate-900">{lid}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {lane.direction === 'NB' ? 'Northbound' : 'Southbound'}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-blue-700">Inspect →</span>
                </div>

                {/* Four device dots */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {devStates.map((d) => {
                    const st = d.health?.state ?? 'UP';
                    const dotColor =
                      st === 'UP'
                        ? 'bg-emerald-600'
                        : st === 'DEGRADED'
                          ? 'bg-amber-500'
                          : 'bg-red-600';
                    return (
                      <div
                        key={d.source}
                        title={`${d.label} (Simulated): ${st}`}
                        className="flex items-center gap-1 border border-slate-200 rounded px-1.5 py-1 bg-slate-50"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        <span className="text-[11px] font-mono font-medium text-slate-800">
                          {d.short}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-[11px] text-slate-500">Vehicles/hr</div>
                    <div className="font-mono font-bold text-slate-900 tabular-nums">
                      {laneTxnsHour.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">STT share</div>
                    <div className="font-mono font-bold text-emerald-700 tabular-nums">
                      {laneSttShare}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Audits</div>
                    <div className="font-mono font-bold text-red-700 tabular-nums">
                      {laneAudit}
                    </div>
                  </div>
                </div>
              </div>

              {/* Active flags */}
              <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100 min-h-[26px]">
                {lidarDown && <TagChip label="Fallback anchor" tone="amber" />}
                {(anyDown || anyDegraded) && <TagChip label="Degraded fusion" tone="amber" />}
                {anyDrift && <TagChip label="Drift warning" tone="amber" />}
                {isCaseRunning && <TagChip label="Case running" tone="blue" />}
                {!lidarDown && !anyDown && !anyDegraded && !anyDrift && !isCaseRunning && (
                  <span className="text-[11px] text-slate-400">Nominal · all devices UP</span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Recent Gantry Transactions Table */}
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Latest Fused Transactions (All Lanes)
          </h2>
          <Link to="/outcomes" className="text-xs text-blue-700 hover:underline">
            View all outcomes →
          </Link>
        </div>
        {txns.length === 0 ? (
          <div className="p-4 text-xs text-slate-500">
            Waiting for first vehicle passage on the simulated demo clock…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="px-3 py-1.5 text-left font-semibold">Time (IST)</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Lane</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Txn ID</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Plate / Tag</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Class</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Match Mode</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Conf</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Route</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Flags</th>
                </tr>
              </thead>
              <tbody>
                {[...txns]
                  .reverse()
                  .slice(0, 12)
                  .map((t) => (
                    <tr
                      key={t.txn_id}
                      className={`border-b border-slate-100 hover:bg-slate-50 ${
                        highlightedIds[t.txn_id] ? 'guided-highlight' : ''
                      }`}
                    >
                      <td className="px-3 py-1.5 font-mono text-slate-700 whitespace-nowrap">
                        {formatDemoTime(t.passage_ts)}
                      </td>
                      <td className="px-3 py-1.5 font-mono font-semibold">{t.lane_id}</td>
                      <td className="px-3 py-1.5 font-mono">
                        <Link
                          to={`/lane/${t.lane_id}/txn/${t.txn_id}`}
                          className="text-blue-700 hover:underline"
                        >
                          {t.txn_id}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 font-mono">
                        {t.resolved_plate ?? t.tag_id ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 font-mono">
                        {t.tag_class ?? '—'}
                        {t.lidar_class && t.tag_class && t.lidar_class !== t.tag_class && (
                          <span className="ml-1 text-amber-700">(LD:{t.lidar_class})</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-slate-600">
                        {t.match_mode}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-right tabular-nums">
                        {t.confidence.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5">
                        <RouteChip route={t.route} />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {t.flags.map((f) => (
                            <TagChip key={f} label={f} tone="amber" />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
