import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDemoTimeMs } from '../domain/clock';
import type { DeviceSource, FusedTransaction, RawEvent } from '../domain/types';
import { describeRawEventSummary } from '../sim/devices';
import { useLpuStore } from '../store/useLpuStore';
import { RouteChip, TagChip } from '../components/StatusChips';

const SOURCES: { source: DeviceSource; label: string }[] = [
  { source: 'FANPR', label: 'Front ANPR (Sim.)' },
  { source: 'RFID', label: 'RFID Reader (Sim.)' },
  { source: 'RANPR', label: 'Rear ANPR (Sim.)' },
  { source: 'LIDAR', label: 'LiDAR (Sim.)' },
];

export function DecisionViewScreen() {
  const { id, txnId } = useParams<{ id: string; txnId: string }>();
  const [showRawJson, setShowRawJson] = useState(false);

  const engine = useLpuStore((s) => s.engine);
  const archivedCaseTxns = useLpuStore((s) => s.archivedCaseTxns);

  let txn: FusedTransaction | undefined = engine.transactions.find((t) => t.txn_id === txnId && t.lane_id === id);
  let rawEvents: RawEvent[] = [];

  if (txn) {
    const allIds = new Set([...txn.raw_event_ids, ...txn.rejected_event_ids]);
    rawEvents = engine.rawEvents.filter((e) => allIds.has(e.event_id));
  } else {
    const archivedMatch = Object.values(archivedCaseTxns).find(
      (entry) => entry.txn.txn_id === txnId
    );
    if (archivedMatch) {
      txn = archivedMatch.txn;
      rawEvents = archivedMatch.events;
    }
  }

  if (!txn) {
    return (
      <div className="bg-white border border-slate-200 rounded p-6 text-xs space-y-2">
        <div className="font-bold text-slate-900 text-sm">Transaction not found</div>
        <p className="text-slate-600">
          No transaction with ID <span className="font-mono">{txnId}</span> exists in memory (state resets on refresh).
        </p>
        <Link to={id ? `/lane/${id}` : '/lanes'} className="text-blue-700 hover:underline">
          ← Return to Lane {id ?? 'Overview'}
        </Link>
      </div>
    );
  }

  const minWindow = Math.min(
    txn.windows.FANPR.start_ms,
    txn.windows.RFID.start_ms,
    txn.windows.RANPR.start_ms,
    txn.anchor_ts - 500
  );
  const maxWindow = Math.max(
    txn.windows.FANPR.end_ms,
    txn.windows.RFID.end_ms,
    txn.windows.RANPR.end_ms,
    txn.anchor_ts + 2000
  );
  const span = Math.max(1000, maxWindow - minWindow);
  const pct = (ts: number) => Math.max(0, Math.min(100, ((ts - minWindow) / span) * 100));
  const anchorPct = pct(txn.anchor_ts);

  const rt = txn.request_tag_lookup;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/lane/${txn.lane_id}`} className="text-xs text-blue-700 hover:underline">
            ← Lane {txn.lane_id}
          </Link>
          <div className="h-4 w-px bg-slate-300" />
          <div>
            <h1 className="text-sm font-bold text-slate-900">
              How this transaction was decided · <span className="font-mono">{txn.txn_id}</span>
            </h1>
            <p className="text-[11px] text-slate-600 font-mono">
              Passage {txn.passage_id} · Anchor {formatDemoTimeMs(txn.anchor_ts)} · Match Mode{' '}
              {txn.match_mode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RouteChip route={txn.route} />
          <span className="font-mono text-xs font-bold text-slate-800">
            Conf {txn.confidence.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => setShowRawJson(!showRawJson)}
            className="px-2.5 py-1 border border-slate-300 rounded bg-white hover:bg-slate-50 text-xs font-medium cursor-pointer"
          >
            {showRawJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
          </button>
        </div>
      </div>

      {/* Passage Timeline */}
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Passage Timeline &amp; Matching Windows
          </h2>
          {txn.is_fallback_anchor && <TagChip label="FALLBACK ANCHOR (LiDAR unavailable)" tone="amber" />}
        </div>

        <div className="p-3 space-y-2.5 text-xs">
          {SOURCES.map(({ source, label }) => {
            const sourceEvents = rawEvents.filter((e) => e.source === source);
            const missingNote = txn.missing_sources.find((m) => m.source === source);
            const bounds = txn.windows[source];
            const left = pct(bounds.start_ms);
            const width = Math.max(1.5, pct(bounds.end_ms) - left);

            return (
              <div key={source} className="grid grid-cols-12 items-center gap-3">
                <div className="col-span-3 font-mono text-slate-800 font-medium">{label}</div>
                <div className="col-span-6">
                  {sourceEvents.length === 0 ? (
                    <div className="h-6 bg-slate-50 border border-dashed border-slate-300 rounded-sm flex items-center px-2 text-[11px] text-slate-500">
                      {missingNote?.reason ?? `No ${source} read`}
                    </div>
                  ) : (
                    <div className="relative h-6 bg-slate-100 border border-slate-200 rounded-sm overflow-hidden">
                      <div
                        className="absolute top-0 bottom-0 bg-blue-100 border-x border-blue-300"
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-px bg-slate-500"
                        style={{ left: `${anchorPct}%` }}
                      />
                      {sourceEvents.map((ev) => {
                        const isRejected = txn.rejected_event_ids.includes(ev.event_id);
                        return (
                          <div
                            key={ev.event_id}
                            className={`absolute top-1 bottom-1 w-2 -ml-1 rounded-sm ${
                              isRejected ? 'bg-amber-600' : 'bg-slate-900'
                            }`}
                            style={{ left: `${pct(ev.device_ts)}%` }}
                            title={`${ev.event_id} @ ${formatDemoTimeMs(ev.device_ts)}${
                              isRejected ? ' (rejected)' : ''
                            }`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="col-span-3 font-mono text-[11px] text-slate-600 truncate">
                  {sourceEvents.length > 0
                    ? sourceEvents.map((ev) => describeRawEventSummary(ev)).join(' | ')
                    : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Two-Column: Decision & Request Tag */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Decision Breakdown */}
        <section className="bg-white border border-slate-200 rounded flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Routing Decision &amp; Rules Fired
            </h2>
            <RouteChip route={txn.route} />
          </div>
          <div className="p-3 space-y-3 text-xs flex-1">
            <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded p-2.5 bg-slate-50">
              <div>
                <span className="text-[11px] text-slate-500 block">Resolved Plate</span>
                <span className="font-mono font-bold text-slate-900">
                  {txn.resolved_plate ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Tag ID ({txn.tag_source ?? 'none'})</span>
                <span className="font-mono font-semibold text-slate-900">
                  {txn.tag_id ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Tag Class / LiDAR Class</span>
                <span className="font-mono text-slate-900">
                  {txn.tag_class ?? '—'} / {txn.lidar_class ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Front / Rear ANPR</span>
                <span className="font-mono text-slate-900">
                  {txn.front_plate ?? '—'} / {txn.rear_plate ?? '—'}
                </span>
              </div>
            </div>

            {txn.flags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {txn.flags.map((f) => (
                  <TagChip key={f} label={f} tone="amber" />
                ))}
              </div>
            )}

            {txn.audit_reason && (
              <div className="border border-red-200 bg-red-50 rounded p-2 text-red-900">
                <strong>Audit Reason:</strong> {txn.audit_reason}
              </div>
            )}

            <div>
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Decision Log
              </div>
              <ul className="space-y-1 list-disc pl-4 text-slate-700">
                {txn.decision_log.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-2">
              Lane controller scope ends at STT / AUDIT_REQUIRED routing. Back-office workflows resolve audit items.
            </div>
          </div>
        </section>

        {/* Simulated Request Tag Box */}
        <section className="bg-white border border-slate-200 rounded flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Simulated Request Tag Lookup
            </h2>
            <TagChip label="SIMULATED" tone="amber" />
          </div>
          <div className="p-3 text-xs space-y-2.5">
            {!rt ? (
              <div className="text-slate-500">
                No Request Tag lookup was issued for this passage (no RFID or ANPR read attached).
              </div>
            ) : (
              <>
                <table className="w-full border-collapse border border-slate-200 text-xs">
                  <tbody>
                    <tr>
                      <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium w-36">
                        Query
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                        {rt.query_type} · {rt.query_value}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                        Requested at
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                        {formatDemoTimeMs(rt.requested_at)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                        Latency / Cache
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                        {rt.latency_ms !== null ? `${rt.latency_ms} ms` : 'pending'} ·{' '}
                        {rt.cache_hit ? (
                          <span className="text-emerald-700 font-semibold">CACHE HIT</span>
                        ) : (
                          <span>CACHE MISS</span>
                        )}
                        {rt.retry_count > 0 && ` · ${rt.retry_count} retry`}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                        Response status
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1.5 font-mono font-semibold">
                        {rt.status}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                        Selected record
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                        {rt.selected
                          ? `${rt.selected.tag_id} → ${rt.selected.plate} (${rt.selected.tag_class}, ${rt.selected.status})`
                          : 'None'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {rt.rejected_candidates.length > 0 && (
                  <div className="border border-amber-200 bg-amber-50 rounded p-2">
                    <div className="font-semibold text-amber-900 mb-1">
                      Rejected Tag Candidates (Retained):
                    </div>
                    <ul className="font-mono text-[11px] space-y-0.5 text-amber-900">
                      {rt.rejected_candidates.map((c) => (
                        <li key={c.tag_id}>
                          {c.tag_id} · {c.status} · issued {c.issue_date}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] text-slate-600">{rt.rule_note}</p>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Evidence Placeholders */}
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Camera Evidence Tiles (Placeholders Only)
          </h2>
          <span className="text-[11px] text-slate-500">
            No real camera images exist in this frontend simulation
          </span>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            { title: 'Front Plate Crop', caption: txn.evidence_placeholders.front_plate_crop },
            { title: 'Front Vehicle Image', caption: txn.evidence_placeholders.front_vehicle },
            { title: 'Rear Plate Crop', caption: txn.evidence_placeholders.rear_plate_crop },
            { title: 'Rear Vehicle Image', caption: txn.evidence_placeholders.rear_vehicle },
          ].map((tile) => (
            <div key={tile.title} className="border border-slate-200 rounded overflow-hidden">
              <div className="h-24 evidence-placeholder-stripes border-b border-slate-200 flex items-center justify-center px-2 text-center">
                <span className="bg-white/90 border border-slate-300 rounded px-2 py-1 font-mono text-[10px] text-slate-700">
                  PLACEHOLDER IMAGE
                </span>
              </div>
              <div className="p-2 bg-white">
                <div className="font-semibold text-slate-800">{tile.title}</div>
                <div className="font-mono text-[10px] text-slate-500 mt-0.5 break-all">
                  {tile.caption}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Placeholder only — no real images in this demo.
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Raw JSON Toggle */}
      {showRawJson && (
        <section className="bg-white border border-slate-200 rounded">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-800">
            Underlying Transaction &amp; Raw Events JSON
          </div>
          <pre className="p-3 text-[11px] font-mono overflow-x-auto bg-slate-50 text-slate-800 max-h-96">
            {JSON.stringify({ transaction: txn, raw_events: rawEvents }, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
