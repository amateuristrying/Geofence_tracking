export const SCORING_THRESHOLDS = {
    SPEED: {
        HARD_LIMIT_KMH: 85,
        PENALTY_PER_KMH: 2,
        MAX_PENALTY: 30,
    },
    NIGHT_DRIVING: {
        MIN_TRIP_DISTANCE_KM: 50,
        RISK_RATIO: 0.4,
        PENALTY_POINTS: 15,
    },
    FATIGUE: {
        MAX_DURATION_HOURS: 4.5,
        SCORE_THRESHOLD: 50,
        BASE_PENALTY: 20,
        FACTOR: 0.2, // multiplier for fatigue score
    },
    VOLATILITY: {
        FACTOR_LIMIT: 2.0,
        SPEED_RATIO_LIMIT: 2.0,
        PENALTY_POINTS: 10,
    },
    EFFICIENCY: {
        PROPOSED_RATIO_LIMIT: 1.15, // Ratio of Actual vs Proposed (Mapbox)
        PENALTY_POINTS: 10,
    },
    SHORT_TRIP: {
        MAX_DISTANCE_KM: 2,
        MIN_DISTANCE_KM: 0.1,
    },
    ROUTE_DEVIATION: {
        TOLERANCE_METERS: 10, // Extreme sensitivity for detecting even roadside shoulder stops
        MIN_DEVIATION_LENGTH_METERS: 50,
        DISCOVERY_THRESHOLD: 1.15, // Flag trips > 15% longer than proposed route
        STATIONARY_THRESHOLD_MINUTES: 5, // Dwell time off-route to trigger theft alert
        STATIONARY_MAX_SPEED_KMH: 5, // Speed below which vehicle is considered stationary
    }
};
