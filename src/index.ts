/**
 * GeoCluster - High-performance capacity-constrained spatial clustering
 * 
 * @packageDocumentation
 */

import type {
  ClusterPoint,
  ClusterOptions,
  ClusterResult,
  GeoClusterOptions,
  CoordinateExtractor,
} from './types';
import { balancedKMeans } from './core/kmeans';
import { exactBalancedSolver } from './core/exact-solver';
import { distances, haversine, euclidean2D } from './core/distances';
import {
  toGeoJSON,
  centroidsToGeoJSON,
  clusterBoundsToGeoJSON,
  toStyledGeoJSON,
} from './geo/geojson';
import {
  applyStickyPenalty,
  calculateAssignmentDelta,
  calculateStabilityScore,
  extractAssignments,
  validatePreviousAssignment,
} from './core/sticky';

// Re-export types
export type {
  ClusterPoint,
  ClusterOptions,
  ClusterResult,
  Cluster,
  ClusterStats,
  DistanceFunction,
  MatrixDistanceFunction,
  WeightFunction,
  CapacityConstraint,
  EligibilityConstraint,
  PreviousAssignment,
  SolverMode,
  GeoClusterOptions,
  CoordinateExtractor,
} from './types';

// Re-export GeoJSON types
export type {
  GeoJSONFeature,
  GeoJSONFeatureCollection,
} from './geo/geojson';

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
export function balancedCluster<T extends ClusterPoint>(
  points: T[],
  options: ClusterOptions<T>
): ClusterResult<T> {
  const solver = options.solver || 'fast';

  if (solver === 'exact') {
    return exactBalancedSolver(points, options);
  } else {
    return balancedKMeans(points, options);
  }
}

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
export function geoCluster<T extends ClusterPoint>(
  points: T[],
  options: GeoClusterOptions<T>
): ClusterResult<T> {
  const {
    latitude = 'latitude',
    longitude = 'longitude',
    useHaversine = false,
    ...clusterOptions
  } = options;

  // Build coordinate extractor
  const getLat =
    typeof latitude === 'function'
      ? latitude
      : (p: T) => (p as any)[latitude];

  const getLng =
    typeof longitude === 'function'
      ? longitude
      : (p: T) => (p as any)[longitude];

  // Build distance function
  const distanceFn = useHaversine ? haversine : euclidean2D;

  const distance = (p1: T, p2: T): number => {
    const lat1 = getLat(p1);
    const lng1 = getLng(p1);
    const lat2 = getLat(p2);
    const lng2 = getLng(p2);

    if (
      lat1 == null ||
      lng1 == null ||
      lat2 == null ||
      lng2 == null
    ) {
      return Infinity;
    }

    return distanceFn(lat1, lng1, lat2, lng2);
  };

  return balancedCluster(points, {
    ...clusterOptions,
    distance,
  });
}

/**
 * Re-export distance functions
 */
export { distances };

/**
 * Re-export GeoJSON utilities
 */
export {
  toGeoJSON,
  centroidsToGeoJSON,
  clusterBoundsToGeoJSON,
  toStyledGeoJSON,
};

/**
 * Re-export sticky/incremental utilities
 */
export {
  applyStickyPenalty,
  calculateAssignmentDelta,
  calculateStabilityScore,
  extractAssignments,
  validatePreviousAssignment,
};

/**
 * Default export
 */
export default {
  balancedCluster,
  geoCluster,
  distances,
  toGeoJSON,
  centroidsToGeoJSON,
  clusterBoundsToGeoJSON,
  toStyledGeoJSON,
  extractAssignments,
  calculateStabilityScore,
};
