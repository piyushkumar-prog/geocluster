/**
 * Core type definitions for GeoCluster
 */
/**
 * A generic point that can be clustered
 */
interface ClusterPoint {
    [key: string]: any;
}
/**
 * Distance function type - calculates distance between two points
 */
type DistanceFunction<T = ClusterPoint> = (point1: T, point2: T) => number;
/**
 * Matrix distance function type - uses precomputed distance matrix
 */
type MatrixDistanceFunction = (index1: number, index2: number) => number;
/**
 * Weight function - extracts weight from a point (default: 1)
 */
type WeightFunction<T = ClusterPoint> = (point: T) => number;
/**
 * Eligibility function for points - returns tags/capabilities
 */
type PointEligibilityFunction<T = ClusterPoint> = (point: T) => string[] | Set<string>;
/**
 * Eligibility function for clusters - returns required tags/capabilities
 */
type ClusterEligibilityFunction = (clusterIndex: number) => string[] | Set<string>;
/**
 * Capacity constraints for clusters
 */
interface CapacityConstraint {
    /** Minimum capacity per cluster (sum of weights) */
    min?: number;
    /** Maximum capacity per cluster (sum of weights) */
    max?: number;
    /** Per-cluster specific capacities (overrides min/max if provided) */
    perCluster?: number[];
}
/**
 * Eligibility constraints for assignment
 */
interface EligibilityConstraint<T = ClusterPoint> {
    /** Function to get point tags/capabilities */
    points: PointEligibilityFunction<T>;
    /** Function to get cluster required tags/capabilities */
    clusters: ClusterEligibilityFunction;
}
/**
 * Previous assignment for sticky/incremental clustering
 */
interface PreviousAssignment {
    /** Point index to cluster index mapping */
    assignments: number[];
}
/**
 * Solver modes
 */
type SolverMode = 'fast' | 'exact';
/**
 * Configuration options for balanced clustering
 */
interface ClusterOptions<T = ClusterPoint> {
    /** Number of clusters to create */
    k: number;
    /** Distance function (default: euclidean for numeric arrays) */
    distance?: DistanceFunction<T> | MatrixDistanceFunction;
    /** Weight function to determine point weight (default: constant 1) */
    weight?: WeightFunction<T>;
    /** Capacity constraints for clusters */
    capacity?: CapacityConstraint;
    /** Eligibility constraints (optional) */
    eligibility?: EligibilityConstraint<T>;
    /** Previous assignment for incremental updates (optional) */
    previous?: PreviousAssignment;
    /** Solver mode: 'fast' (greedy) or 'exact' (min-cost-flow) */
    solver?: SolverMode;
    /** Random seed for deterministic results */
    seed?: number;
    /** Maximum iterations for k-means convergence (default: 30) */
    maxIterations?: number;
    /** Whether to use distance matrix mode */
    useMatrix?: boolean;
}
/**
 * Statistics about the clustering result
 */
interface ClusterStats {
    /** Total distance sum across all assignments */
    totalDistance: number;
    /** Maximum distance in any assignment */
    maxDistance: number;
    /** Imbalance ratio: (max_size - min_size) / average_size */
    imbalanceRatio: number;
    /** Number of points that couldn't be assigned */
    unassignedCount: number;
    /** Per-cluster statistics */
    clusters: Array<{
        index: number;
        size: number;
        totalWeight: number;
        averageDistance: number;
        centroid: number[];
    }>;
}
/**
 * Single cluster result
 */
interface Cluster<T = ClusterPoint> {
    /** Cluster index */
    index: number;
    /** Points assigned to this cluster */
    points: T[];
    /** Centroid coordinates */
    centroid: number[];
    /** Total weight of all points in cluster */
    totalWeight: number;
}
/**
 * Clustering result
 */
interface ClusterResult<T = ClusterPoint> {
    /** Array of clusters */
    clusters: Cluster<T>[];
    /** Statistics about the clustering */
    stats: ClusterStats;
    /** Points that couldn't be assigned due to constraints */
    unassigned: T[];
}
/**
 * Coordinate extractor for geo-specific clustering
 */
interface CoordinateExtractor<T = ClusterPoint> {
    latitude: (point: T) => number | null | undefined;
    longitude: (point: T) => number | null | undefined;
}
/**
 * Options for geo-specific clustering (convenience wrapper)
 */
interface GeoClusterOptions<T = ClusterPoint> extends Omit<ClusterOptions<T>, 'distance'> {
    /** How to extract latitude from points */
    latitude?: string | ((point: T) => number | null | undefined);
    /** How to extract longitude from points */
    longitude?: string | ((point: T) => number | null | undefined);
    /** Use Haversine distance instead of Euclidean */
    useHaversine?: boolean;
}

/**
 * Distance calculation functions for clustering
 */

/**
 * Fast Euclidean distance squared (avoids expensive sqrt)
 * Works with 2D coordinates (lat/lng or x/y)
 */
declare function distanceSquared(lat1: number, lng1: number, lat2: number, lng2: number): number;
/**
 * Euclidean distance for 2D points
 */
declare function euclidean2D(lat1: number, lng1: number, lat2: number, lng2: number): number;
/**
 * Haversine distance in kilometers
 * More accurate for geographic coordinates on Earth's surface
 */
declare function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number;
/**
 * N-dimensional Euclidean distance
 * Works with any dimensional vector
 */
declare function euclideanND(vector1: number[], vector2: number[]): number;
/**
 * Manhattan (L1) distance for N-dimensional vectors
 */
declare function manhattanND(vector1: number[], vector2: number[]): number;
/**
 * Create a distance function from a precomputed cost matrix
 * This allows using OSRM, Valhalla, or any other routing engine
 *
 * @param matrix - Square matrix where matrix[i][j] is the distance from point i to point j
 * @returns MatrixDistanceFunction that looks up precomputed distances
 */
declare function matrixDistance(matrix: number[][]): MatrixDistanceFunction;
/**
 * Create a distance function from a flat array (for memory efficiency)
 * Array should be in row-major order: [0,0], [0,1], ..., [0,n], [1,0], [1,1], ...
 *
 * @param flatMatrix - Flattened distance matrix
 * @param size - Number of points (matrix is size x size)
 */
declare function flatMatrixDistance(flatMatrix: Float64Array | number[], size: number): MatrixDistanceFunction;
/**
 * Pre-defined distance functions that can be used directly
 */
declare const distances: {
    /** Fast squared Euclidean (avoids sqrt) - best for performance */
    euclideanSquared: typeof distanceSquared;
    /** Standard Euclidean distance for 2D */
    euclidean: typeof euclidean2D;
    /** Haversine distance for geographic coordinates (in km) */
    haversine: typeof haversine;
    /** N-dimensional Euclidean distance */
    euclideanND: typeof euclideanND;
    /** Manhattan (L1) distance */
    manhattan: typeof manhattanND;
    /** Create distance function from precomputed matrix */
    fromMatrix: typeof matrixDistance;
    /** Create distance function from flat array */
    fromFlatMatrix: typeof flatMatrixDistance;
};

/**
 * GeoJSON export utilities for map visualization
 */

/**
 * GeoJSON Feature
 */
interface GeoJSONFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: Record<string, any>;
}
/**
 * GeoJSON FeatureCollection
 */
interface GeoJSONFeatureCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}
/**
 * Convert cluster result to GeoJSON FeatureCollection
 *
 * @param result - Clustering result
 * @param coordinateExtractor - How to extract lat/lng from points
 * @returns GeoJSON FeatureCollection ready for Mapbox/Leaflet
 */
declare function toGeoJSON<T extends ClusterPoint>(result: ClusterResult<T>, coordinateExtractor?: CoordinateExtractor<T>): GeoJSONFeatureCollection;
/**
 * Create GeoJSON with cluster centroids
 * Useful for visualizing cluster centers on a map
 */
declare function centroidsToGeoJSON<T extends ClusterPoint>(result: ClusterResult<T>): GeoJSONFeatureCollection;
/**
 * Create GeoJSON with cluster hulls (bounding boxes)
 * Useful for visualizing cluster boundaries
 */
declare function clusterBoundsToGeoJSON<T extends ClusterPoint>(result: ClusterResult<T>, coordinateExtractor?: CoordinateExtractor<T>): GeoJSONFeatureCollection;
/**
 * Export cluster result to styled GeoJSON for immediate use in mapping libraries
 * Includes color properties for each cluster
 */
declare function toStyledGeoJSON<T extends ClusterPoint>(result: ClusterResult<T>, coordinateExtractor?: CoordinateExtractor<T>, colorPalette?: string[]): GeoJSONFeatureCollection;

/**
 * Sticky/incremental clustering support
 * Minimizes changes from previous assignment
 */

/**
 * Apply sticky constraint to prefer previous assignments
 * This modifies the cost matrix to penalize reassignments
 *
 * @param costMatrix - Original cost matrix
 * @param previous - Previous assignment
 * @param stickyPenalty - Penalty multiplier for changing assignments (default: 2.0)
 * @returns Modified cost matrix with sticky penalties
 */
declare function applyStickyPenalty(costMatrix: number[][], previous: PreviousAssignment, stickyPenalty?: number): number[][];
/**
 * Calculate assignment delta between two assignments
 * Returns the number of points that changed clusters
 */
declare function calculateAssignmentDelta(assignments1: number[], assignments2: number[]): number;
/**
 * Calculate stability score (percentage of points that stayed in same cluster)
 */
declare function calculateStabilityScore(assignments1: number[], assignments2: number[]): number;
/**
 * Extract assignment array from cluster result
 */
declare function extractAssignments<T extends ClusterPoint>(result: ClusterResult<T>, points: T[]): number[];
/**
 * Validate previous assignment compatibility
 */
declare function validatePreviousAssignment(previous: PreviousAssignment, pointCount: number, clusterCount: number): boolean;

/**
 * Main clustering function with full control
 *
 * @param points - Array of points to cluster
 * @param options - Clustering options
 * @returns Clustering result with statistics
 *
 * @example
 * ```typescript
 * const result = balancedCluster(points, {
 *   k: 5,
 *   weight: p => p.serviceMinutes,
 *   capacity: { min: 90, max: 120 },
 *   distance: distances.haversine,
 *   solver: 'fast',
 *   seed: 42,
 * });
 * ```
 */
declare function balancedCluster<T extends ClusterPoint>(points: T[], options: ClusterOptions<T>): ClusterResult<T>;
/**
 * Convenience function for geographic clustering
 * Automatically handles lat/lng extraction and distance calculation
 *
 * @param points - Array of points with geographic coordinates
 * @param options - Geographic clustering options
 * @returns Clustering result
 *
 * @example
 * ```typescript
 * const result = geoCluster(stores, {
 *   k: 10,
 *   latitude: 'lat',
 *   longitude: 'lng',
 *   useHaversine: true,
 *   capacity: { max: 50 },
 * });
 *
 * const geojson = toGeoJSON(result);
 * ```
 */
declare function geoCluster<T extends ClusterPoint>(points: T[], options: GeoClusterOptions<T>): ClusterResult<T>;

/**
 * Default export
 */
declare const _default: {
    balancedCluster: typeof balancedCluster;
    geoCluster: typeof geoCluster;
    distances: {
        euclideanSquared: typeof distanceSquared;
        euclidean: typeof euclidean2D;
        haversine: typeof haversine;
        euclideanND: typeof euclideanND;
        manhattan: typeof manhattanND;
        fromMatrix: typeof matrixDistance;
        fromFlatMatrix: typeof flatMatrixDistance;
    };
    toGeoJSON: typeof toGeoJSON;
    centroidsToGeoJSON: typeof centroidsToGeoJSON;
    clusterBoundsToGeoJSON: typeof clusterBoundsToGeoJSON;
    toStyledGeoJSON: typeof toStyledGeoJSON;
    extractAssignments: typeof extractAssignments;
    calculateStabilityScore: typeof calculateStabilityScore;
};

export { type CapacityConstraint, type Cluster, type ClusterOptions, type ClusterPoint, type ClusterResult, type ClusterStats, type CoordinateExtractor, type DistanceFunction, type EligibilityConstraint, type GeoClusterOptions, type GeoJSONFeature, type GeoJSONFeatureCollection, type MatrixDistanceFunction, type PreviousAssignment, type SolverMode, type WeightFunction, applyStickyPenalty, balancedCluster, calculateAssignmentDelta, calculateStabilityScore, centroidsToGeoJSON, clusterBoundsToGeoJSON, _default as default, distances, extractAssignments, geoCluster, toGeoJSON, toStyledGeoJSON, validatePreviousAssignment };
