export type LaneId = 'L01' | 'L02' | 'L03' | 'L04';
export type Direction = 'NB' | 'SB';
export type DeviceSource = 'RFID' | 'FANPR' | 'RANPR' | 'LIDAR';
export type DeviceState = 'UP' | 'DEGRADED' | 'DOWN';
export type VehicleClass = 'VC4' | 'VC5' | 'VC7' | 'VC10' | 'VC12';
export type RouteDecision = 'STT' | 'AUDIT_REQUIRED';
export type WindowPresetId = 'demo_pacing' | 'design_doc';
export type RequestTagOverride = 'normal' | 'timeout' | 'transient_timeout' | 'empty' | 'multi_tag';
export type ClockSpeed = 1 | 5 | 20;

export interface WindowRule {
  startMs: number;
  endMs: number;
}

export interface WindowPreset {
  id: WindowPresetId;
  name: string;
  provisionalLabel: string;
  description: string;
  windows: Record<DeviceSource, WindowRule>;
  closeGraceMs: number;
  speedScaleRear: boolean;
  nominalSpeedKmph: number;
}

export interface LaneMetadata {
  lane_id: LaneId;
  direction: Direction;
  label: string;
}

export interface FusionConfig {
  plazaId: string;
  gantryId: string;
  lanes: LaneMetadata[];
  activePresetId: WindowPresetId;
  presets: Record<WindowPresetId, WindowPreset>;
  plateNormalisation: {
    map: Record<string, string>;
    maxEditDistance: number;
    editDistancePenalty: number;
    provisionalNote: string;
  };
  straightThroughConfidenceThreshold: number;
  lowPlateConfidenceThreshold: number;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  driftWarningMs: number;
  driftConfidencePenalty: number;
  degradedConfidencePenalty: number;
  duplicatePlateWindowMs: number;
  requestTag: {
    cacheTtlMs: number;
    timeoutMs: number;
    retryDelayMs: number;
    normalLatencyRangeMs: [number, number];
    multiTagPolicy: 'VALID_FIRST_ELSE_LATEST_ISSUE';
    multiTagRuleNote: string;
  };
  rfidMultiTagPickPolicy: 'STRONGEST_RSSI';
  trafficMix: {
    cleanOrSimpleShare: number;
    lowConfidenceShare: number;
    lateRearShare: number;
    crossLaneShare: number;
    intervalNormalMs: [number, number];
    intervalRushHourMs: [number, number];
    classWeights: { vehicleClass: VehicleClass; weight: number }[];
  };
  vendorClassCrosswalk: Record<string, VehicleClass>;
  lidarAnchorNote: string;
  presetDisagreementNote: string;
}

export interface RfidPayload {
  tag_id: string;
  tid: string;
  rssi: number;
  antenna_no: number;
  read_count: number;
}

export interface AnprPayload {
  plate_text: string;
  plate_confidence: number;
  vehicle_colour: string;
  plate_crop_placeholder: string;
  vehicle_image_placeholder: string;
}

export interface LidarDimensions {
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
}

/**
 * Agnibaan interface decoded VehicleEventV1 schema 1.0 (not point cloud processing).
 * Vendor IDs and string vehicle IDs are preserved alongside internal lane controller IDs.
 */
export interface LidarPayload {
  vendor_event_id: string;
  vehicle_id: string;
  vendor_class_id: string;
  mapped_class: VehicleClass;
  class_confidence: number;
  speed_kmph: number | null;
  axle_count: number | null;
  dimensions: LidarDimensions | null;
  direction: 'FORWARD' | 'REVERSE';
}

export interface RawEvent {
  event_id: string;
  source: DeviceSource;
  plaza_id: string;
  gantry_id: string;
  lane_id: LaneId;
  direction: Direction;
  device_id: string;
  device_ts: number;
  lpu_ts: number;
  seq_no: number;
  schema_ver: string;
  is_replay: boolean;
  rfid?: RfidPayload;
  anpr?: AnprPayload;
  lidar?: LidarPayload;
}

export interface SourceWindowBounds {
  start_ms: number;
  end_ms: number;
}

export interface RequestTagCandidate {
  tag_id: string;
  plate: string;
  tag_class: VehicleClass;
  status: 'VALID' | 'SUSPENDED' | 'EXPIRED';
  issue_date: string;
}

export interface RequestTagLookupRecord {
  lookup_id: string;
  query_type: 'TAG_TO_PLATE' | 'PLATE_TO_TAG';
  query_value: string;
  requested_at: number;
  resolved_at: number | null;
  latency_ms: number | null;
  cache_hit: boolean;
  retry_count: number;
  status: 'IN_FLIGHT' | 'FOUND' | 'EMPTY' | 'TIMEOUT' | 'MULTI_TAG';
  selected: RequestTagCandidate | null;
  rejected_candidates: RequestTagCandidate[];
  rule_note: string;
}

export interface Passage {
  passage_id: string;
  lane_id: LaneId;
  status: 'OPEN' | 'CLOSED';
  anchor_event_id: string;
  anchor_source: DeviceSource;
  anchor_ts: number;
  is_fallback_anchor: boolean;
  opened_at: number;
  closes_at: number;
  closed_at: number | null;
  windows: Record<DeviceSource, SourceWindowBounds>;
  attached_event_ids: Record<DeviceSource, string[]>;
  rejected_event_ids: string[];
  request_tag_lookup: RequestTagLookupRecord | null;
  degraded_sources: DeviceSource[];
  drift_warnings: string[];
  colour_index: number;
}

export interface MissingSourceNote {
  source: DeviceSource;
  reason: string;
}

export interface FusedTransaction {
  txn_id: string;
  passage_id: string;
  lane_id: LaneId;
  passage_ts: number;
  anchor_ts: number;
  match_mode: string;
  confidence: number;
  route: RouteDecision;
  audit_reason: string | null;
  flags: string[];
  tag_id: string | null;
  tag_source: 'READER' | 'REQUEST_TAG' | null;
  front_plate: string | null;
  rear_plate: string | null;
  resolved_plate: string | null;
  tag_class: VehicleClass | null;
  lidar_class: VehicleClass | null;
  speed_kmph: number | null;
  raw_event_ids: string[];
  rejected_event_ids: string[];
  evidence_placeholders: {
    front_plate_crop: string;
    front_vehicle: string;
    rear_plate_crop: string;
    rear_vehicle: string;
  };
  request_tag_lookup: RequestTagLookupRecord | null;
  decision_log: string[];
  missing_sources: MissingSourceNote[];
  is_fallback_anchor: boolean;
  windows: Record<DeviceSource, SourceWindowBounds>;
  colour_index: number;
  created_at: number;
}

export interface LatePacket {
  id: string;
  event: RawEvent;
  reason: string;
  missed_passage_id: string | null;
  detected_at: number;
}

export interface OrphanEvent {
  id: string;
  event: RawEvent;
  reason: string;
  detected_at: number;
}

export interface DuplicateDeliveryRecord {
  id: string;
  event_id: string;
  source: DeviceSource;
  lane_id: LaneId;
  received_at: number;
  reason: string;
}

export interface DeviceStateChange {
  ts: number;
  from: DeviceState;
  to: DeviceState;
  reason: string;
}

export interface DeviceHealth {
  device_id: string;
  lane_id: LaneId;
  source: DeviceSource;
  state: DeviceState;
  last_heartbeat_ts: number;
  drift_ms: number;
  firmware: string;
  state_log: DeviceStateChange[];
}

export interface BufferedItem {
  seq: number;
  txn_id: string;
  lane_id: LaneId;
  buffered_at: number;
  raw_events: RawEvent[];
}

export interface LinkState {
  status: 'UP' | 'DOWN';
  buffer_depth: number;
  buffered_items: BufferedItem[];
  replay_in_progress: boolean;
  replay_total: number;
  replay_completed: number;
  history: { ts: number; status: 'UP' | 'DOWN'; reason: string }[];
  buffer_history: { ts: number; depth: number }[];
}

export interface ScriptEventSpec {
  source: DeviceSource;
  lane_override?: LaneId;
  /** Offset in ms relative to script t0 for device_ts */
  device_offset_ms: number;
  /** Offset in ms relative to script t0 for lpu_ts (arrival at lane controller). Defaults to device_offset_ms + 30 */
  lpu_offset_ms?: number;
  is_replay?: boolean;
  /** Duplicate an earlier event_id in the same script (or fixed id) */
  fixed_event_id?: string;
  /** RFID fields */
  tag_id?: string;
  tid?: string;
  rssi?: number;
  antenna_no?: number;
  read_count?: number;
  /** ANPR fields */
  plate_text?: string;
  plate_confidence?: number;
  vehicle_colour?: string;
  /** LiDAR fields */
  vendor_class_id?: string;
  mapped_class?: VehicleClass;
  class_confidence?: number;
  speed_kmph?: number | null;
  axle_count?: number | null;
  lidar_direction?: 'FORWARD' | 'REVERSE';
  dimensions?: LidarDimensions | null;
}

export interface VehicleScript {
  script_id: string;
  true_plate: string;
  true_tag_id: string | null;
  true_class: VehicleClass;
  speed_kmph: number;
  lane_id: LaneId;
  events: ScriptEventSpec[];
}

export type CaseAction =
  | { type: 'SET_DEVICE_STATE'; delay_ms: number; lane_id?: LaneId; source: DeviceSource; state: DeviceState; reason: string }
  | { type: 'SET_DEVICE_DRIFT'; delay_ms: number; lane_id?: LaneId; source: DeviceSource; drift_ms: number }
  | { type: 'SET_REQUEST_TAG_OVERRIDE'; delay_ms: number; override: RequestTagOverride }
  | { type: 'REGISTER_TAG'; delay_ms: number; plate: string; candidates: RequestTagCandidate[] }
  | { type: 'SET_LINK_STATUS'; delay_ms: number; status: 'UP' | 'DOWN'; reason: string }
  | { type: 'VEHICLE_SCRIPT'; delay_ms: number; script: VehicleScript }
  | { type: 'REPLAY_BUFFERED_NOW'; delay_ms: number };

export interface CaseExpectedOutcome {
  route?: RouteDecision;
  min_transactions?: number;
  exact_transactions?: number;
  expected_routes?: RouteDecision[];
  required_flags?: string[];
  reason_includes?: string[];
  decision_log_includes?: string[];
  min_orphans?: number;
  min_late_packets?: number;
  min_duplicates?: number;
  expect_cache_hit_on_last?: boolean;
  expect_buffer_depth_min?: number;
  expect_buffer_drained?: boolean;
  expect_replayed_events?: boolean;
  expect_health_log_contains?: DeviceState[];
}

export interface CaseDefinition {
  id: string;
  group: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  group_name: string;
  name: string;
  summary: string;
  expected_summary: string;
  duration_ms: number;
  buildActions: (laneId: LaneId, baseTagSuffix: string) => CaseAction[];
  expected: CaseExpectedOutcome;
}

export interface CaseRunResult {
  case_id: string;
  lane_id: LaneId;
  status: 'PASS' | 'FAIL';
  expected_summary: string;
  actual_summary: string;
  details: string[];
  primary_txn_id: string | null;
  txn_ids: string[];
  orphan_ids: string[];
  late_ids: string[];
  ran_at: number;
}
