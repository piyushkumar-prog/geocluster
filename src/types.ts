/**
 * Core type definitions for GeoCluster
 */

/**
 * A generic point that can be clustered
 */
export interface ClusterPoint {
  [key: string]: any;
}

/**
 * Distance function type - calculates distance between two points
 */
export type DistanceFunction<T = ClusterPoint> = (
  point1: T,
  point2: T
) => number;

/**
 * Matrix distance function type - uses precomputed distance matrix
 */
export type MatrixDistanceFunction = (
  index1: number,
  index2: number
) => number;

/**
 * Weight function - extracts weight from a point (default: 1)
 */
export type WeightFunction<T = ClusterPoint> = (point: T) => number;

/**
 * Eligibility function for points - returns tags/capabilities
 */
export type PointEligibilityFunction<T = ClusterPoint> = (
  point: T
) => string[] | Set<string>;

/**
 * Eligibility function for clusters - returns required tags/capabilities
 */
export type ClusterEligibilityFunction = (
  clusterIndex: number
) => string[] | Set<string>;

/**
 * Capacity constraints for clusters
 */
export interface CapacityConstraint {
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
export interface EligibilityConstraint<T = ClusterPoint> {
  /** Function to get point tags/capabilities */
  points: PointEligibilityFunction<T>;
  /** Function to get cluster required tags/capabilities */
  clusters: ClusterEligibilityFunction;
}

/**
 * Previous assignment for sticky/incremental clustering
 */
export interface PreviousAssignment {
  /** Point index to cluster index mapping */
  assignments: number[];
}

/**
 * Solver modes
 */
export type SolverMode = 'fast' | 'exact';

/**
 * Configuration options for balanced clustering
 */
export interface ClusterOptions<T = ClusterPoint> {
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
export interface ClusterStats {
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
export interface Cluster<T = ClusterPoint> {
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
export interface ClusterResult<T = ClusterPoint> {
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
export interface CoordinateExtractor<T = ClusterPoint> {
  latitude: (point: T) => number | null | undefined;
  longitude: (point: T) => number | null | undefined;
}

/**
 * Options for geo-specific clustering (convenience wrapper)
 */
export interface GeoClusterOptions<T = ClusterPoint>
  extends Omit<ClusterOptions<T>, 'distance'> {
  /** How to extract latitude from points */
  latitude?: string | ((point: T) => number | null | undefined);

  /** How to extract longitude from points */
  longitude?: string | ((point: T) => number | null | undefined);

  /** Use Haversine distance instead of Euclidean */
  useHaversine?: boolean;
}
