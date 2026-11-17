import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDemoTime } from '../domain/clock';
import type { LaneId } from '../domain/types';
import { useLpuStore } from '../store/useLpuStore';
import { RouteChip, TagChip } from '../components/StatusChips';

export function OutcomesScreen() {
  const [loading, setLoading] = useState(true);
  const [laneFilter, setLaneFilter] = useState<'ALL' | LaneId>('ALL');
  const [search, setSearch] = useState('');

  const engine = useLpuStore((s) => s.engine);
  const highlightedIds = useLpuStore((s) => s.highlightedIds);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 320);
    return () => window.clearTimeout(t);
  }, []);

  const q = search.trim().toUpperCase();

  const txns = engine.transactions.filter((t) => {
    if (laneFilter !== 'ALL' && t.lane_id !== laneFilter) return false;
    if (!q) return true;
    return (
      t.txn_id.toUpperCase().includes(q) ||
      (t.resolved_plate ?? '').toUpperCase().includes(q) ||
      (t.tag_id ?? '').toUpperCase().includes(q)
    );
  });

  const sttList = [...txns].filter((t) => t.route === 'STT').reverse();
  const auditTxns = [...txns].filter((t) => t.route === 'AUDIT_REQUIRED').reverse();

  const orphans = [...engine.orphans]
    .filter((o) => laneFilter === 'ALL' || o.event.lane_id === laneFilter)
    .filter(
      (o) =>
        !q ||
        o.id.toUpperCase().includes(q) ||
        (o.event.rfid?.tag_id ?? '').toUpperCase().includes(q) ||
        (o.event.anpr?.plate_text ?? '').toUpperCase().includes(q)
    )
    .reverse();

  const latePackets = [...engine.latePackets]
    .filter((l) => laneFilter === 'ALL' || l.event.lane_id === laneFilter)
    .filter(
      (l) =>
        !q ||
        l.id.toUpperCase().includes(q) ||
        (l.missed_passage_id ?? '').toUpperCase().includes(q)
    )
    .reverse();

  const totalTxns = engine.transactions.length;
  const totalStt = engine.transactions.filter((t) => t.route === 'STT').length;
  const totalAudits = engine.transactions.filter((t) => t.route === 'AUDIT_REQUIRED').length;
  const sttShare = totalTxns > 0 ? `${Math.round((totalStt / totalTxns) * 100)}%` : '—';

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 bg-white border border-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-72 bg-white border border-slate-200 rounded animate-pulse" />
          <div className="h-72 bg-white border border-slate-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-bold text-slate-900">Outcomes &amp; Routing Queues</h1>
        <div className="flex items-center gap-2 text-xs">
          <select
            aria-label="Filter by lane"
            value={laneFilter}
            onChange={(e) => setLaneFilter(e.target.value as 'ALL' | LaneId)}
            className="border border-slate-300 rounded px-2 py-1 bg-white"
          >
            <option value="ALL">All Lanes</option>
            <option value="L01">L01</option>
            <option value="L02">L02</option>
            <option value="L03">L03</option>
            <option value="L04">L04</option>
          </select>
          <input
            type="text"
            placeholder="Filter plate, tag, or txn ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1 bg-white w-52"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="px-2 py-1 border border-slate-300 rounded bg-white hover:bg-slate-50 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Derived Counters */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white border border-slate-200 rounded p-2.5">
          <div className="text-[11px] text-slate-500">Straight-through share</div>
          <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">{sttShare}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-2.5">
          <div className="text-[11px] text-slate-500">Audit-required</div>
          <div className="text-lg font-bold font-mono text-red-700 tabular-nums">{totalAudits}</div>
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
      </section>

      {/* Side-by-side queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Straight-through Log */}
        <section className="bg-white border border-slate-200 rounded flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Straight-Through Log ({sttList.length})
            </h2>
            <span className="text-[11px] text-slate-500">Newest first</span>
          </div>
          {sttList.length === 0 ? (
            <div className="p-4 text-xs text-slate-500">No straight-through transactions match the filter.</div>
          ) : (
            <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-2.5 py-1.5 text-left font-semibold">Time</th>
                    <th className="px-2.5 py-1.5 text-left font-semibold">Lane</th>
                    <th className="px-2.5 py-1.5 text-left font-semibold">Plate / Class</th>
                    <th className="px-2.5 py-1.5 text-left font-semibold">Mode &amp; Flags</th>
                    <th className="px-2.5 py-1.5 text-right font-semibold">View</th>
                  </tr>
                </thead>
                <tbody>
                  {sttList.map((t) => (
                    <tr
                      key={t.txn_id}
                      className={`border-b border-slate-100 hover:bg-slate-50 ${
                        highlightedIds[t.txn_id] ? 'guided-highlight' : ''
                      }`}
                    >
                      <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {formatDemoTime(t.passage_ts)}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono font-semibold">{t.lane_id}</td>
                      <td className="px-2.5 py-1.5 font-mono">
                        <div className="font-semibold text-slate-900">
                          {t.resolved_plate ?? t.tag_id}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {t.tag_class ?? '—'} · conf {t.confidence.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <RouteChip route={t.route} />
                          {t.flags.map((f) => (
                            <TagChip key={f} label={f} tone="amber" />
                          ))}
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                        <Link
                          to={`/lane/${t.lane_id}/txn/${t.txn_id}`}
                          className="text-blue-700 hover:underline font-medium"
                        >
                          Decision →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Audit-Required Queue */}
        <section className="bg-white border border-slate-200 rounded flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Audit-Required, Orphans &amp; Late ({auditTxns.length + orphans.length + latePackets.length})
            </h2>
          </div>

          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-700">
            In the full system the back office resolves these. This demo ends at the lane controller&apos;s routing decision.
          </div>

          {auditTxns.length === 0 && orphans.length === 0 && latePackets.length === 0 ? (
            <div className="p-4 text-xs text-slate-500">No audit items, orphans, or late packets recorded.</div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto divide-y divide-slate-100 text-xs">
              {auditTxns.map((t) => (
                <div
                  key={t.txn_id}
                  className={`p-2.5 hover:bg-slate-50 flex items-start justify-between gap-2 ${
                    highlightedIds[t.txn_id] ? 'guided-highlight' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <RouteChip route={t.route} />
                      <span className="font-mono font-bold text-slate-900">
                        {t.lane_id} · {t.resolved_plate ?? t.tag_id ?? t.txn_id}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatDemoTime(t.passage_ts)}
                      </span>
                      {t.flags.map((f) => (
                        <TagChip key={f} label={f} tone="red" />
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-700">{t.audit_reason}</p>
                  </div>
                  <Link
                    to={`/lane/${t.lane_id}/txn/${t.txn_id}`}
                    className="text-blue-700 hover:underline font-medium shrink-0"
                  >
                    Decision →
                  </Link>
                </div>
              ))}

              {orphans.map((o) => (
                <div
                  key={o.id}
                  className={`p-2.5 hover:bg-slate-50 flex items-start justify-between gap-2 ${
                    highlightedIds[o.id] ? 'guided-highlight' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <TagChip label="ORPHAN" tone="red" />
                      <span className="font-mono font-semibold text-slate-900">
                        {o.event.lane_id} · {o.event.source} ·{' '}
                        {o.event.rfid?.tag_id ?? o.event.anpr?.plate_text ?? o.id}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatDemoTime(o.detected_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700">{o.reason}</p>
                  </div>
                </div>
              ))}

              {latePackets.map((l) => (
                <div
                  key={l.id}
                  className={`p-2.5 hover:bg-slate-50 flex items-start justify-between gap-2 ${
                    highlightedIds[l.id] ? 'guided-highlight' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <TagChip label="LATE" tone="amber" />
                      <span className="font-mono font-semibold text-slate-900">
                        {l.event.lane_id} · {l.event.source} · {l.missed_passage_id ?? l.id}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatDemoTime(l.detected_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700">{l.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
