import { DEFAULT_FUSION_CONFIG, normalisePlate } from '../domain/config';
import type {
  FusionConfig,
  RequestTagCandidate,
  RequestTagLookupRecord,
  RequestTagOverride,
} from '../domain/types';

export interface RequestTagCacheEntry {
  cachedAt: number;
  status: 'FOUND' | 'MULTI_TAG';
  selected: RequestTagCandidate;
  rejected_candidates: RequestTagCandidate[];
  rule_note: string;
}

export interface RequestTagServiceState {
  override: RequestTagOverride;
  registryByPlate: Record<string, RequestTagCandidate[]>;
  registryByTag: Record<string, RequestTagCandidate>;
  cache: Record<string, RequestTagCacheEntry>;
  seq: number;
}

export function createInitialRequestTagState(): RequestTagServiceState {
  const initialPairs: RequestTagCandidate[] = [
    { tag_id: 'TAG-34161FA820328EE40001', plate: 'MH12AB1234', tag_class: 'VC4', status: 'VALID', issue_date: '2025-04-12' },
    { tag_id: 'TAG-34161FA820328EE40002', plate: 'DL04CA7788', tag_class: 'VC5', status: 'VALID', issue_date: '2025-06-18' },
    { tag_id: 'TAG-34161FA820328EE40003', plate: 'KA01MG4521', tag_class: 'VC7', status: 'VALID', issue_date: '2025-02-09' },
    { tag_id: 'TAG-34161FA820328EE40004', plate: 'GJ05JR9090', tag_class: 'VC10', status: 'VALID', issue_date: '2024-11-21' },
    { tag_id: 'TAG-34161FA820328EE40005', plate: 'TN09BZ3311', tag_class: 'VC12', status: 'VALID', issue_date: '2025-01-30' },
  ];

  const state: RequestTagServiceState = {
    override: 'normal',
    registryByPlate: {},
    registryByTag: {},
    cache: {},
    seq: 0,
  };

  for (const c of initialPairs) {
    registerTagCandidateInState(state, c.plate, [c]);
  }
  return state;
}

export function cloneRequestTagState(rt: RequestTagServiceState): RequestTagServiceState {
  return {
    override: rt.override,
    registryByPlate: { ...rt.registryByPlate },
    registryByTag: { ...rt.registryByTag },
    cache: { ...rt.cache },
    seq: rt.seq,
  };
}

export function registerTagCandidateInState(
  rt: RequestTagServiceState,
  plate: string,
  candidates: RequestTagCandidate[]
): void {
  const norm = normalisePlate(plate);
  rt.registryByPlate[norm] = candidates;
  for (const c of candidates) {
    rt.registryByTag[c.tag_id] = c;
  }
}

export function selectTagCandidate(
  candidates: RequestTagCandidate[],
  config: FusionConfig = DEFAULT_FUSION_CONFIG
): {
  selected: RequestTagCandidate | null;
  rejected: RequestTagCandidate[];
  ruleNote: string;
} {
  if (candidates.length === 0) {
    return {
      selected: null,
      rejected: [],
      ruleNote: 'No matching tag records in Request Tag.',
    };
  }
  if (candidates.length === 1) {
    return {
      selected: candidates[0],
      rejected: [],
      ruleNote: 'Single matching tag record returned.',
    };
  }

  // Provisional rule: valid tag first, else latest issue_date
  const sorted = [...candidates].sort((a, b) => {
    const aValid = a.status === 'VALID' ? 1 : 0;
    const bValid = b.status === 'VALID' ? 1 : 0;
    if (aValid !== bValid) return bValid - aValid;
    return b.issue_date.localeCompare(a.issue_date);
  });

  return {
    selected: sorted[0],
    rejected: sorted.slice(1),
    ruleNote: `Selected ${sorted[0].tag_id} (${sorted[0].status}, issued ${sorted[0].issue_date}) over ${sorted.length - 1} other tag(s). ${config.requestTag.multiTagRuleNote}`,
  };
}

export interface PendingRequestTagMeta {
  willTimeoutFirst: boolean;
  willTimeoutRetry: boolean;
  willEmpty: boolean;
  willMultiTag: boolean;
  normalLatencyMs: number;
}

export function startRequestTagLookup(
  rt: RequestTagServiceState,
  queryType: 'TAG_TO_PLATE' | 'PLATE_TO_TAG',
  rawQueryValue: string,
  demoNowMs: number,
  config: FusionConfig
): { lookup: RequestTagLookupRecord; nextSeq: number } {
  const nextSeq = rt.seq + 1;
  const lookupId = `RT-${String(nextSeq).padStart(5, '0')}`;
  const cacheKey =
    queryType === 'TAG_TO_PLATE'
      ? `TAG:${rawQueryValue}`
      : `PLATE:${normalisePlate(rawQueryValue, config.plateNormalisation.map)}`;

  const cached = rt.cache[cacheKey];
  if (
    rt.override === 'normal' &&
    cached &&
    demoNowMs - cached.cachedAt <= config.requestTag.cacheTtlMs
  ) {
    return {
      nextSeq,
      lookup: {
        lookup_id: lookupId,
        query_type: queryType,
        query_value: rawQueryValue,
        requested_at: demoNowMs,
        resolved_at: demoNowMs,
        latency_ms: 0,
        cache_hit: true,
        retry_count: 0,
        status: cached.status,
        selected: cached.selected,
        rejected_candidates: cached.rejected_candidates,
        rule_note: `Cache hit (within 10m TTL): ${cached.rule_note}`,
      },
    };
  }

  return {
    nextSeq,
    lookup: {
      lookup_id: lookupId,
      query_type: queryType,
      query_value: rawQueryValue,
      requested_at: demoNowMs,
      resolved_at: null,
      latency_ms: null,
      cache_hit: false,
      retry_count: 0,
      status: 'IN_FLIGHT',
      selected: null,
      rejected_candidates: [],
      rule_note: 'Simulated Request Tag lookup in flight...',
    },
  };
}

export function resolveRequestTagLookupStep(
  rt: RequestTagServiceState,
  lookup: RequestTagLookupRecord,
  demoNowMs: number,
  config: FusionConfig
): { lookup: RequestTagLookupRecord; updatedCacheEntry?: { key: string; entry: RequestTagCacheEntry } } {
  if (lookup.status !== 'IN_FLIGHT') {
    return { lookup };
  }

  const elapsed = demoNowMs - lookup.requested_at;
  const [minLat, maxLat] = config.requestTag.normalLatencyRangeMs;
  // Deterministic simulated latency from seq/id
  const hash = lookup.lookup_id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const simLatency = minLat + (hash % Math.max(1, maxLat - minLat + 1));

  if (rt.override === 'timeout') {
    const firstTimeoutAt = config.requestTag.timeoutMs;
    const retryStartAt = firstTimeoutAt + config.requestTag.retryDelayMs;
    const finalTimeoutAt = retryStartAt + config.requestTag.timeoutMs;

    if (elapsed < firstTimeoutAt) {
      return { lookup };
    }
    if (elapsed < finalTimeoutAt) {
      if (lookup.retry_count === 0 && elapsed >= retryStartAt) {
        return {
          lookup: {
            ...lookup,
            retry_count: 1,
            rule_note: `Initial lookup timed out at ${firstTimeoutAt} ms; 1 retry in flight.`,
          },
        };
      }
      return { lookup };
    }

    return {
      lookup: {
        ...lookup,
        retry_count: 1,
        resolved_at: demoNowMs,
        latency_ms: elapsed,
        status: 'TIMEOUT',
        rule_note: `Timed out after 1 retry (${finalTimeoutAt} ms limit).`,
      },
    };
  }

  if (rt.override === 'transient_timeout') {
    const firstTimeoutAt = config.requestTag.timeoutMs;
    const retryCompleteAt = firstTimeoutAt + config.requestTag.retryDelayMs + simLatency;
    if (elapsed < firstTimeoutAt) {
      return { lookup };
    }
    if (elapsed < retryCompleteAt) {
      if (lookup.retry_count === 0) {
        return {
          lookup: {
            ...lookup,
            retry_count: 1,
            rule_note: `Initial attempt timed out at ${firstTimeoutAt} ms; retrying once.`,
          },
        };
      }
      return { lookup };
    }
  } else if (elapsed < simLatency) {
    return { lookup };
  }

  if (rt.override === 'empty') {
    return {
      lookup: {
        ...lookup,
        resolved_at: demoNowMs,
        latency_ms: elapsed,
        status: 'EMPTY',
        selected: null,
        rejected_candidates: [],
        rule_note: 'Simulated Request Tag returned 0 records (empty result).',
      },
    };
  }

  // Lookup in registry
  let candidates: RequestTagCandidate[] = [];
  if (lookup.query_type === 'TAG_TO_PLATE') {
    const found = rt.registryByTag[lookup.query_value];
    if (found) candidates = [found];
  } else {
    const norm = normalisePlate(lookup.query_value, config.plateNormalisation.map);
    candidates = rt.registryByPlate[norm] ?? [];
  }

  if (rt.override === 'multi_tag' && candidates.length <= 1) {
    const base = candidates[0] ?? {
      tag_id: `TAG-MULTI-${lookup.query_value.replace(/[^A-Z0-9]/gi, '').slice(-4)}A`,
      plate: lookup.query_type === 'PLATE_TO_TAG' ? normalisePlate(lookup.query_value) : 'MH12ZZ9999',
      tag_class: 'VC4' as const,
      status: 'VALID' as const,
      issue_date: '2026-03-15',
    };
    candidates = [
      { ...base, status: 'SUSPENDED', issue_date: '2024-05-01', tag_id: `${base.tag_id}-OLD` },
      { ...base, status: 'VALID', issue_date: '2026-03-15' },
    ];
  }

  if (candidates.length === 0) {
    return {
      lookup: {
        ...lookup,
        resolved_at: demoNowMs,
        latency_ms: elapsed,
        status: 'EMPTY',
        selected: null,
        rejected_candidates: [],
        rule_note: 'No tag or plate record found in Simulated Request Tag registry.',
      },
    };
  }

  const picked = selectTagCandidate(candidates, config);
  const status = picked.rejected.length > 0 ? 'MULTI_TAG' : 'FOUND';
  const cacheKey =
    lookup.query_type === 'TAG_TO_PLATE'
      ? `TAG:${lookup.query_value}`
      : `PLATE:${normalisePlate(lookup.query_value, config.plateNormalisation.map)}`;

  const resolvedLookup: RequestTagLookupRecord = {
    ...lookup,
    retry_count: rt.override === 'transient_timeout' ? 1 : lookup.retry_count,
    resolved_at: demoNowMs,
    latency_ms: elapsed,
    status,
    selected: picked.selected,
    rejected_candidates: picked.rejected,
    rule_note: picked.ruleNote,
  };

  if (!picked.selected) {
    return { lookup: resolvedLookup };
  }

  return {
    lookup: resolvedLookup,
    updatedCacheEntry: {
      key: cacheKey,
      entry: {
        cachedAt: demoNowMs,
        status,
        selected: picked.selected,
        rejected_candidates: picked.rejected,
        rule_note: picked.ruleNote,
      },
    },
  };
}
