import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatAgeSeconds, formatDemoTimeMs } from '../domain/clock';
import { getActivePreset } from '../domain/config';
import { healthKey } from '../domain/fusion';
import type { DeviceSource, LaneId, Passage, RawEvent } from '../domain/types';
import { describeRawEventSummary } from '../sim/devices';
import { useLpuStore } from '../store/useLpuStore';
import { DeviceChip, PASSAGE_CHIP_COLORS, RouteChip, TagChip } from '../components/StatusChips';

const SOURCES: { source: DeviceSource; title: string }[] = [
  { source: 'RFID', title: 'RFID Reader (Simulated)' },
  { source: 'FANPR', title: 'Front ANPR (Simulated)' },
  { source: 'RANPR', title: 'Rear ANPR (Simulated)' },
  { source: 'LIDAR', title: 'LiDAR (Simulated)' },
];

export function LaneDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const laneId: LaneId = (id === 'L01' || id === 'L02' || id === 'L03' || id === 'L04' ? id : 'L01');

  const [loading, setLoading] = useState(true);
  const [followLive, setFollowLive] = useState(true);
  const [frozenRawEvents, setFrozenRawEvents] = useState<RawEvent[] | null>(null);

  const config = useLpuStore((s) => s.config);
  const clock = useLpuStore((s) => s.clock);
  const engine = useLpuStore((s) => s.engine);
  const highlightedIds = useLpuStore((s) => s.highlightedIds);
  const sendSingleCleanVehicle = useLpuStore((s) => s.sendSingleCleanVehicle);

  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), 320);
    return () => window.clearTimeout(t);
  }, [laneId]);

  const laneMeta = config.lanes.find((l) => l.lane_id === laneId) ?? config.lanes[0];
  const laneRawEvents = useMemo(
    () => engine.rawEvents.filter((e) => e.lane_id === laneId),
    [engine.rawEvents, laneId]
  );

  const displayedRawEvents = followLive ? laneRawEvents : (frozenRawEvents ?? laneRawEvents);

  const handleToggleFollow = () => {
    if (followLive) {
      setFrozenRawEvents(laneRawEvents);
      setFollowLive(false);
    } else {
      setFrozenRawEvents(null);
      setFollowLive(true);
    }
  };

  // Map event_id -> passage colour index & passage_id
  const eventPassageMap = useMemo(() => {
    const map = new Map<string, { passageId: string; colorIdx: number }>();
    for (const p of engine.passages) {
      if (p.lane_id !== laneId) continue;
      const allIds = [
        ...p.attached_event_ids.RFID,
        ...p.attached_event_ids.FANPR,
        ...p.attached_event_ids.RANPR,
        ...p.attached_event_ids.LIDAR,
      ];
      for (const eid of allIds) {
        map.set(eid, { passageId: p.passage_id, colorIdx: p.colour_index });
      }
    }
    return map;
  }, [engine.passages, laneId]);

  const lanePassages = useMemo(
    () => engine.passages.filter((p) => p.lane_id === laneId).slice(-6).reverse(),
    [engine.passages, laneId]
  );

  const laneTxns = useMemo(
    () => engine.transactions.filter((t) => t.lane_id === laneId),
    [engine.transactions, laneId]
  );

  const laneOrphans = useMemo(
    () => engine.orphans.filter((o) => o.event.lane_id === laneId),
    [engine.orphans, laneId]
  );

  const laneLate = useMemo(
    () => engine.latePackets.filter((l) => l.event.lane_id === laneId),
    [engine.latePackets, laneId]
  );

  const laneBufferCount = engine.linkState.buffered_items.filter(
    (b) => b.lane_id === laneId
  ).length;

  const rawById = useMemo(() => {
    const m = new Map<string, RawEvent>();
    for (const e of engine.rawEvents) m.set(e.event_id, e);
    return m;
  }, [engine.rawEvents]);

  const txnByPassageId = useMemo(() => {
    const m = new Map<string, (typeof laneTxns)[number]>();
    for (const t of laneTxns) m.set(t.passage_id, t);
    return m;
  }, [laneTxns]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-14 bg-white border border-slate-200 rounded animate-pulse" />
        <div className="h-56 bg-white border border-slate-200 rounded animate-pulse" />
        <div className="h-44 bg-white border border-slate-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Lane Header */}
      <section className="bg-white border border-slate-200 rounded p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/lanes" className="text-xs text-blue-700 hover:underline">
            ← All Lanes
          </Link>
          <div className="h-4 w-px bg-slate-300" />
          <div>
            <h1 className="text-sm font-bold text-slate-900">
              {laneId} · {laneMeta.direction === 'NB' ? 'Northbound' : 'Southbound'}
            </h1>
          </div>
          <select
            aria-label="Switch lane"
            value={laneId}
            onChange={(e) => navigate(`/lane/${e.target.value}`)}
            className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
          >
            {config.lanes.map((l) => (
              <option key={l.lane_id} value={l.lane_id}>
                {l.lane_id} ({l.direction})
              </option>
            ))}
          </select>
        </div>

        {/* 4 Device Health Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {SOURCES.map(({ source }) => {
            const h = engine.deviceHealth[healthKey(laneId, source)];
            if (!h) return null;
            return (
              <div
                key={source}
                className="flex items-center gap-1.5 border border-slate-200 rounded px-2 py-1 bg-slate-50 text-xs"
              >
                <span className="font-mono font-semibold text-slate-800">{source}</span>
                <DeviceChip state={h.state} />
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  hb {formatAgeSeconds(clock.nowMs, h.last_heartbeat_ts)}
                </span>
                {Math.abs(h.drift_ms) > 0 && (
                  <span className="font-mono text-[11px] text-amber-700">
                    drift {h.drift_ms}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span>
            Link (Sim.):{' '}
            <strong className={engine.linkState.status === 'UP' ? 'text-emerald-700' : 'text-red-700'}>
              {engine.linkState.status}
            </strong>
          </span>
          <span className="font-mono">
            Lane buffer: <strong>{laneBufferCount}</strong>
          </span>
          <button
            type="button"
            onClick={() => sendSingleCleanVehicle(laneId)}
            className="px-2.5 py-1 bg-blue-700 text-white font-semibold rounded hover:bg-blue-800 cursor-pointer"
          >
            Send Test Vehicle
          </button>
        </div>
      </section>

      {/* ZONE 1: RAW EVENT FEEDS */}
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              1. Raw Event Feeds ({laneId})
            </h2>
            <p className="text-[11px] text-slate-500">
              Newest at top. Events that fused into the same passage share a colour chip across columns.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleFollow}
            className={`px-2.5 py-1 rounded border text-xs font-medium cursor-pointer ${
              followLive
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            {followLive ? 'Follow live: ON (Pause)' : 'Follow live: PAUSED (Resume)'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {SOURCES.map(({ source, title }) => {
            const colEvents = displayedRawEvents
              .filter((e) => e.source === source)
              .slice(-18)
              .reverse();
            return (
              <div key={source} className="flex flex-col">
                <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>{title}</span>
                  <span className="font-mono text-slate-500">{colEvents.length}</span>
                </div>
                <div className="h-52 overflow-y-auto divide-y divide-slate-100">
                  {colEvents.length === 0 ? (
                    <div className="p-3 text-[11px] text-slate-400">No events on {source} yet.</div>
                  ) : (
                    colEvents.map((ev) => {
                      const pInfo = eventPassageMap.get(ev.event_id);
                      return (
                        <div
                          key={ev.event_id}
                          className="px-2.5 py-1.5 text-[11px] hover:bg-slate-50 flex items-start gap-2"
                        >
                          <span
                            title={pInfo ? `Passage ${pInfo.passageId}` : 'Unmatched'}
                            className={`mt-1 w-2 h-2 rounded-sm shrink-0 ${
                              pInfo ? PASSAGE_CHIP_COLORS[pInfo.colorIdx] : 'bg-slate-300'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 font-mono text-slate-600">
                              <span>{formatDemoTimeMs(ev.device_ts)}</span>
                              <div className="flex items-center gap-1">
                                {ev.is_replay && <TagChip label="REPLAY" tone="blue" />}
                                <span className="text-[10px] text-slate-400">#{ev.seq_no}</span>
                              </div>
                            </div>
                            <div className="font-mono text-slate-900 truncate">
                              {describeRawEventSummary(ev)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ZONE 2: FUSION PANEL */}
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              2. Fusion Panel (Open &amp; Just-Closed Passages)
            </h2>
            <p className="text-[11px] text-slate-500">
              Horizontal timelines on the demo clock · Matching windows from active preset:{' '}
              <strong>{getActivePreset(config).name}</strong> (provisional).
            </p>
          </div>
        </div>

        {lanePassages.length === 0 ? (
          <div className="p-4 text-xs text-slate-500">
            No passages on {laneId} yet. Vehicles will open a passage when LiDAR (or fallback) detects them.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {lanePassages.map((p) => (
              <PassageTimelineRow
                key={p.passage_id}
                passage={p}
                rawById={rawById}
                txn={txnByPassageId.get(p.passage_id)}
                nowMs={clock.nowMs}
              />
            ))}
          </div>
        )}
      </section>

      {/* ZONE 3: OUTCOME STRIP */}
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            3. Outcome Strip ({laneId} · Transactions, Orphans &amp; Late Packets)
          </h2>
          <span className="text-[11px] text-slate-500">Click any transaction card for decision breakdown</span>
        </div>

        <div className="p-3">
          {laneTxns.length === 0 && laneOrphans.length === 0 && laneLate.length === 0 ? (
            <div className="text-xs text-slate-500">No closed outcomes on {laneId} yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {[...laneTxns]
                .reverse()
                .slice(0, 9)
                .map((t) => (
                  <Link
                    key={t.txn_id}
                    to={`/lane/${laneId}/txn/${t.txn_id}`}
                    className={`block border border-slate-200 hover:border-blue-600 rounded p-2.5 bg-white ${
                      highlightedIds[t.txn_id] ? 'guided-highlight' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {t.resolved_plate ?? t.tag_id ?? t.txn_id}
                      </span>
                      <RouteChip route={t.route} />
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>{t.txn_id}</span>
                      <span>·</span>
                      <span>
                        Class: {t.tag_class ?? '—'}
                        {t.lidar_class && t.tag_class && t.lidar_class !== t.tag_class
                          ? ` (LiDAR: ${t.lidar_class})`
                          : ''}
                      </span>
                      <span>·</span>
                      <span>{t.match_mode}</span>
                    </div>
                    {t.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.flags.map((f) => (
                          <TagChip key={f} label={f} tone="amber" />
                        ))}
                      </div>
                    )}
                  </Link>
                ))}

              {[...laneOrphans]
                .reverse()
                .slice(0, 4)
                .map((o) => (
                  <div
                    key={o.id}
                    className={`border border-red-200 bg-red-50/40 rounded p-2.5 ${
                      highlightedIds[o.id] ? 'guided-highlight' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-semibold text-xs text-slate-900">
                        {o.event.source} · {o.event.rfid?.tag_id ?? o.event.anpr?.plate_text ?? o.id}
                      </span>
                      <TagChip label="ORPHAN" tone="red" />
                    </div>
                    <p className="text-[11px] text-slate-700">{o.reason}</p>
                  </div>
                ))}

              {[...laneLate]
                .reverse()
                .slice(0, 4)
                .map((l) => (
                  <div
                    key={l.id}
                    className={`border border-amber-200 bg-amber-50/40 rounded p-2.5 ${
                      highlightedIds[l.id] ? 'guided-highlight' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-semibold text-xs text-slate-900">
                        {l.event.source} · {l.missed_passage_id ?? l.id}
                      </span>
                      <TagChip label="LATE" tone="amber" />
                    </div>
                    <p className="text-[11px] text-slate-700">{l.reason}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PassageTimelineRow({
  passage,
  rawById,
  txn,
  nowMs,
}: {
  passage: Passage;
  rawById: Map<string, RawEvent>;
  txn?: ReturnType<typeof useLpuStore.getState>['engine']['transactions'][number];
  nowMs: number;
}) {
  const minWindow = Math.min(
    passage.windows.FANPR.start_ms,
    passage.windows.RFID.start_ms,
    passage.windows.RANPR.start_ms,
    passage.anchor_ts - 500
  );
  const maxEnd = Math.max(passage.closes_at, passage.windows.RANPR.end_ms + 500);
  const span = Math.max(1000, maxEnd - minWindow);
  const pct = (ts: number) => Math.max(0, Math.min(100, ((ts - minWindow) / span) * 100));

  const bands: { source: DeviceSource; label: string }[] = [
    { source: 'FANPR', label: 'FANPR' },
    { source: 'RFID', label: 'RFID' },
    { source: 'RANPR', label: 'RANPR' },
    { source: 'LIDAR', label: 'LIDAR' },
  ];

  const anchorPct = pct(passage.anchor_ts);
  const playheadPct = pct(nowMs);

  return (
    <div className="p-3 text-xs space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-sm ${PASSAGE_CHIP_COLORS[passage.colour_index]}`} />
          <span className="font-mono font-bold text-slate-900">{passage.passage_id}</span>
          <span className="font-mono text-[11px] text-slate-500">
            Anchor: {passage.anchor_source} @ {formatDemoTimeMs(passage.anchor_ts)}
          </span>
          {passage.is_fallback_anchor && <TagChip label="FALLBACK ANCHOR" tone="amber" />}
          {passage.status === 'OPEN' ? (
            <TagChip label="OPEN" tone="blue" />
          ) : (
            <TagChip label="CLOSED" tone="neutral" />
          )}
        </div>

        {txn ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-700">{txn.match_mode}</span>
            <span className="font-mono text-[11px] text-slate-700">
              conf {txn.confidence.toFixed(2)}
            </span>
            <RouteChip route={txn.route} />
            <Link
              to={`/lane/${passage.lane_id}/txn/${txn.txn_id}`}
              className="text-[11px] text-blue-700 hover:underline font-medium"
            >
              Decision →
            </Link>
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 font-mono">
            Closes at {formatDemoTimeMs(passage.closes_at)}
            {passage.request_tag_lookup?.status === 'IN_FLIGHT' ? ' · Waiting on Request Tag' : ''}
          </span>
        )}
      </div>

      {/* Horizontal source bands */}
      <div className="space-y-1">
        {bands.map((b) => {
          const bounds = passage.windows[b.source];
          const left = pct(bounds.start_ms);
          const right = pct(bounds.end_ms);
          const width = Math.max(1.5, right - left);
          const evIds = passage.attached_event_ids[b.source];
          return (
            <div key={b.source} className="flex items-center gap-2">
              <span className="w-12 font-mono text-[11px] text-slate-600 shrink-0">{b.label}</span>
              <div className="relative flex-1 h-4 bg-slate-100 border border-slate-200 rounded-sm overflow-hidden">
                {/* Matching window band */}
                <div
                  className="absolute top-0 bottom-0 bg-blue-100 border-x border-blue-300"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${b.source} window`}
                />
                {/* Anchor line */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-slate-500"
                  style={{ left: `${anchorPct}%` }}
                />
                {/* Live playhead if OPEN */}
                {passage.status === 'OPEN' && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-blue-700"
                    style={{ left: `${playheadPct}%` }}
                  />
                )}
                {/* Attached event ticks */}
                {evIds.map((eid) => {
                  const ev = rawById.get(eid);
                  if (!ev) return null;
                  const evLeft = pct(ev.device_ts);
                  return (
                    <div
                      key={eid}
                      className="absolute top-0.5 bottom-0.5 w-1.5 -ml-0.75 rounded-sm bg-slate-900"
                      style={{ left: `${evLeft}%` }}
                      title={`${ev.source} @ ${formatDemoTimeMs(ev.device_ts)}`}
                    />
                  );
                })}
              </div>
              <span className="w-16 text-right font-mono text-[10px] text-slate-500 shrink-0">
                {evIds.length > 0 ? `${evIds.length} read` : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* In-place decision sentence when closed */}
      {txn && txn.decision_log.length > 0 && (
        <div className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
          {txn.decision_log[txn.decision_log.length - 1]}
        </div>
      )}
    </div>
  );
}
