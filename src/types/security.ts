// ============================================================
// Route Security Analysis Types
// ============================================================

export type SeverityLevel = 'CRITICAL' | 'WARNING' | 'MINOR';

export interface StopEvent {
    lat: number;
    lng: number;
    duration_mins: number;
}

/**
 * Expanded analysis result from RouteAnomaliesMap.
 * Includes geometry data for persistence alongside the summary metrics.
 */
export interface RouteAnalysisResult {
    proposedKm: number;
    actualKm: number;
    deviationKm: number;
    unauthorizedStops: number;
    routeBreaches: number;
    deviationSegments: GeoJSON.FeatureCollection | null;
    stopEvents: StopEvent[];
}

/**
 * Payload sent from client to POST /api/security/analysis.
 */
export interface SecurityAnalysisPayload {
    trip_id: string;
    tracker_id: number;
    tracker_name: string;
    proposed_km: number;
    actual_km: number;
    deviation_km: number;
    deviation_severity_ratio: number;
    severity_level: SeverityLevel;
    route_breaches: number;
    unauthorized_stops: number;
    deviation_segments: GeoJSON.FeatureCollection | null;
    stop_events: StopEvent[];
}

/**
 * A row from the route_security_events table.
 */
export interface SecurityEventRecord extends SecurityAnalysisPayload {
    id: number;
    analyzed_at: string;
    created_at: string;
    updated_at: string;
}

/**
 * A point returned by the get_security_hotspots RPC.
 */
export interface SecurityHotspot {
    trip_id: string;
    tracker_id: number;
    tracker_name: string;
    severity_level: SeverityLevel;
    point_type: 'deviation_centroid' | 'unauthorized_stop';
    lat: number;
    lng: number;
    deviation_km: number;
    duration_mins: number | null;
    analyzed_at: string;
}
