/**
 * Fast greedy balanced K-means clustering algorithm
 * Based on the proven implementation from Project 1
 */

import type {
  ClusterPoint,
  ClusterOptions,
  ClusterResult,
  Cluster,
  ClusterStats,
} from '../types';
import { distanceSquared } from './distances';
import { SeededRandom } from './random';

/**
 * Extract coordinates from points for distance calculations
 */
interface CoordinateArrays {
  coords: Float64Array[]; // Array of coordinate vectors per point
  dimensions: number;
}

/**
 * Internal centroid representation
 */
interface Centroid {
  coords: number[];
}

/**
 * Fast greedy balanced K-means clustering
 */
export function balancedKMeans<T extends ClusterPoint>(
  points: T[],
  options: ClusterOptions<T>
): ClusterResult<T> {
  const {
    k,
    distance,
    weight = () => 1,
    capacity,
    eligibility,
    previous,
    seed = 42,
    maxIterations = 30,
    useMatrix = false,
  } = options;

  // Handle empty input
  if (points.length === 0) {
    return {
      clusters: [],
      stats: createEmptyStats(),
      unassigned: [],
    };
  }

  // Adjust k to valid range
  const actualK = Math.min(k, points.length);
  if (actualK <= 0) {
    return {
      clusters: [],
      stats: createEmptyStats(),
      unassigned: points,
    };
  }

  if (actualK === 1) {
    return createSingleCluster(points, weight);
  }

  const rng = new SeededRandom(seed);

  // Calculate point weights
  const weights = points.map(weight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Determine cluster capacities
  const capacities = calculateCapacities(actualK, totalWeight, weights.length, capacity);

  // Extract coordinates for distance calculations
  const coordArrays = extractCoordinates(points, distance, useMatrix);

  // Initialize centroids using k-means++ strategy
  const centroids = initializeCentroids(
    coordArrays,
    actualK,
    rng,
    useMatrix ? distance : undefined
  );

  // Run k-means iterations (unconstrained)
  let assignments = runKMeansIterations(
    coordArrays,
    centroids,
    maxIterations,
    useMatrix ? distance : undefined
  );

  // Apply capacity constraints with greedy assignment
  const balancedAssignments = applyCapacityConstraints(
    coordArrays,
    centroids,
    weights,
    capacities,
    eligibility,
    points,
    actualK,
    previous,
    useMatrix ? distance : undefined
  );

  // Build final clusters
  return buildClusterResult(
    points,
    balancedAssignments,
    centroids,
    weights,
    coordArrays,
    useMatrix ? distance : undefined
  );
}

/**
 * Extract coordinate arrays from points
 */
function extractCoordinates<T extends ClusterPoint>(
  points: T[],
  _distance: any,
  useMatrix: boolean
): CoordinateArrays {
  if (useMatrix) {
    // For matrix mode, we don't need actual coordinates
    return {
      coords: [],
      dimensions: 0,
    };
  }

  // Try to auto-detect coordinate format
  const first = points[0];
  
  // Check for common geo formats
  if ('lat' in first && 'lng' in first) {
    return {
      coords: points.map(p => Float64Array.from([p.lat as number, p.lng as number])),
      dimensions: 2,
    };
  }
  
  if ('latitude' in first && 'longitude' in first) {
    return {
      coords: points.map(p => Float64Array.from([p.latitude as number, p.longitude as number])),
      dimensions: 2,
    };
  }

  // Check for x/y format
  if ('x' in first && 'y' in first) {
    return {
      coords: points.map(p => Float64Array.from([p.x as number, p.y as number])),
      dimensions: 2,
    };
  }

  // Check for coordinate array
  if ('coordinates' in first && Array.isArray(first.coordinates)) {
    const coords = first.coordinates as number[];
    return {
      coords: points.map(p => Float64Array.from(p.coordinates as number[])),
      dimensions: coords.length,
    };
  }

  // Check for vector field
  if ('vector' in first && Array.isArray(first.vector)) {
    const vec = first.vector as number[];
    return {
      coords: points.map(p => Float64Array.from(p.vector as number[])),
      dimensions: vec.length,
    };
  }

  // Default: assume point is [number, number]
  throw new Error(
    'Could not auto-detect coordinate format. Points should have lat/lng, latitude/longitude, x/y, coordinates[], or vector[] fields'
  );
}

/**
 * Calculate Euclidean distance squared between coordinate arrays
 */
function coordDistanceSquared(coords1: Float64Array, coords2: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < coords1.length; i++) {
    const diff = coords1[i] - coords2[i];
    sum += diff * diff;
  }
  return sum;
}

/**
 * Calculate distance using provided function or default squared Euclidean
 */
function calculateDistance(
  coordArrays: CoordinateArrays,
  idx1: number,
  centroid: Centroid,
  _matrixDistanceFn?: any
): number {
  if (_matrixDistanceFn) {
    // For matrix mode, we need a way to calculate point-to-centroid distance
    // This is a limitation - centroids don't have indices
    // Fall back to coordinate distance
  }

  const coords1 = coordArrays.coords[idx1];
  const coords2 = Float64Array.from(centroid.coords);
  return coordDistanceSquared(coords1, coords2);
}

/**
 * Initialize centroids using k-means++ algorithm
 */
function initializeCentroids(
  coordArrays: CoordinateArrays,
  k: number,
  _rng: SeededRandom,
  _matrixDistanceFn?: any
): Centroid[] {
  const n = coordArrays.coords.length;
  const dimensions = coordArrays.dimensions;
  const centroids: Centroid[] = [];

  if (n === 0 || dimensions === 0) {
    // Matrix mode or no coordinates
    return Array.from({ length: k }, (_, i) => ({
      coords: [i], // Use indices as placeholder
    }));
  }

  // First centroid: random point (or farthest from center for better spread)
  // Calculate geographic center
  let avgCoords = new Array(dimensions).fill(0);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dimensions; d++) {
      avgCoords[d] += coordArrays.coords[i][d];
    }
  }
  avgCoords = avgCoords.map(sum => sum / n);

  // Find farthest point from center
  let firstIdx = 0;
  let maxDist = -1;
  for (let i = 0; i < n; i++) {
    const coords = coordArrays.coords[i];
    let distSq = 0;
    for (let d = 0; d < dimensions; d++) {
      const diff = coords[d] - avgCoords[d];
      distSq += diff * diff;
    }
    if (distSq > maxDist) {
      maxDist = distSq;
      firstIdx = i;
    }
  }

  centroids.push({
    coords: Array.from(coordArrays.coords[firstIdx]),
  });

  // Remaining centroids: k-means++ (farthest from existing centroids)
  for (let c = 1; c < k; c++) {
    let maxMinDist = -1;
    let maxIdx = 0;

    for (let i = 0; i < n; i++) {
      const coords = coordArrays.coords[i];
      let minDist = Infinity;

      for (const centroid of centroids) {
        const dist = coordDistanceSquared(coords, Float64Array.from(centroid.coords));
        if (dist < minDist) {
          minDist = dist;
        }
      }

      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        maxIdx = i;
      }
    }

    centroids.push({
      coords: Array.from(coordArrays.coords[maxIdx]),
    });
  }

  return centroids;
}

/**
 * Run k-means iterations to find good initial centroids
 */
function runKMeansIterations(
  coordArrays: CoordinateArrays,
  centroids: Centroid[],
  maxIterations: number,
  _matrixDistanceFn?: any
): number[] {
  const n = coordArrays.coords.length;
  const k = centroids.length;

  if (n === 0 || coordArrays.dimensions === 0) {
    // Can't run k-means without coordinates
    return Array.from({ length: n }, (_, i) => i % k);
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each point to nearest centroid
    const newAssignments = new Array(n);
    for (let i = 0; i < n; i++) {
      let bestCluster = 0;
      let bestDist = Infinity;

      for (let c = 0; c < k; c++) {
        const dist = coordDistanceSquared(
          coordArrays.coords[i],
          Float64Array.from(centroids[c].coords)
        );
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }

      newAssignments[i] = bestCluster;
    }

    // Check for convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;

    if (!changed) {
      break;
    }

    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterPoints: number[] = [];
      for (let i = 0; i < n; i++) {
        if (assignments[i] === c) {
          clusterPoints.push(i);
        }
      }

      if (clusterPoints.length > 0) {
        const newCoords = new Array(coordArrays.dimensions).fill(0);
        for (const idx of clusterPoints) {
          for (let d = 0; d < coordArrays.dimensions; d++) {
            newCoords[d] += coordArrays.coords[idx][d];
          }
        }
        centroids[c].coords = newCoords.map(sum => sum / clusterPoints.length);
      }
    }
  }

  return assignments;
}

/**
 * Apply capacity constraints using greedy assignment
 */
function applyCapacityConstraints<T extends ClusterPoint>(
  coordArrays: CoordinateArrays,
  centroids: Centroid[],
  weights: number[],
  capacities: number[],
  eligibility: any,
  points: T[],
  k: number,
  _previous?: any,
  _matrixDistanceFn?: any
): number[] {
  const n = points.length;
  
  // Calculate distance from each point to each centroid
  interface PointDistance {
    pointIdx: number;
    clusterIdx: number;
    distance: number;
  }

  const pointDistances: PointDistance[] = [];

  for (let i = 0; i < n; i++) {
    for (let c = 0; c < k; c++) {
      // Check eligibility if provided
      if (eligibility) {
        const pointTags = new Set(eligibility.points(points[i]));
        const clusterTags = new Set(eligibility.clusters(c));
        
        // Point must have all required cluster tags
        let eligible = true;
        for (const tag of clusterTags) {
          if (!pointTags.has(tag)) {
            eligible = false;
            break;
          }
        }
        
        if (!eligible) {
          continue; // Skip this cluster for this point
        }
      }

      let distance: number;
      if (coordArrays.coords.length > 0) {
        distance = coordDistanceSquared(
          coordArrays.coords[i],
          Float64Array.from(centroids[c].coords)
        );
      } else if (_matrixDistanceFn) {
        // Matrix mode: use point index and cluster index
        // Note: centroids don't have meaningful indices in matrix mode
        // We'll need to approximate
        distance = i * k + c; // Placeholder
      } else {
        distance = 0;
      }

      pointDistances.push({
        pointIdx: i,
        clusterIdx: c,
        distance,
      });
    }
  }

  // Sort by distance (greedy: assign closest first)
  pointDistances.sort((a, b) => a.distance - b.distance);

  // Track assignments and capacities
  const assignments = new Array(n).fill(-1);
  const clusterWeights = new Array(k).fill(0);

  // Greedy assignment
  for (const { pointIdx, clusterIdx, distance } of pointDistances) {
    if (assignments[pointIdx] !== -1) {
      continue; // Already assigned
    }

    const pointWeight = weights[pointIdx];
    const newWeight = clusterWeights[clusterIdx] + pointWeight;

    if (newWeight <= capacities[clusterIdx]) {
      assignments[pointIdx] = clusterIdx;
      clusterWeights[clusterIdx] = newWeight;
    }
  }

  // Second pass: assign any remaining points to first available cluster
  for (let i = 0; i < n; i++) {
    if (assignments[i] !== -1) {
      continue;
    }

    for (let c = 0; c < k; c++) {
      const pointWeight = weights[i];
      const newWeight = clusterWeights[c] + pointWeight;

      if (newWeight <= capacities[c]) {
        assignments[i] = c;
        clusterWeights[c] = newWeight;
        break;
      }
    }
  }

  return assignments;
}

/**
 * Build final cluster result with statistics
 */
function buildClusterResult<T extends ClusterPoint>(
  points: T[],
  assignments: number[],
  centroids: Centroid[],
  weights: number[],
  coordArrays: CoordinateArrays,
  _matrixDistanceFn?: any
): ClusterResult<T> {
  const k = centroids.length;
  const clusters: Cluster<T>[] = [];
  const unassigned: T[] = [];

  // Group points by cluster
  for (let c = 0; c < k; c++) {
    const clusterPoints: T[] = [];
    let totalWeight = 0;

    for (let i = 0; i < points.length; i++) {
      if (assignments[i] === c) {
        clusterPoints.push(points[i]);
        totalWeight += weights[i];
      }
    }

    clusters.push({
      index: c,
      points: clusterPoints,
      centroid: centroids[c].coords,
      totalWeight,
    });
  }

  // Collect unassigned points
  for (let i = 0; i < points.length; i++) {
    if (assignments[i] === -1) {
      unassigned.push(points[i]);
    }
  }

  // Calculate statistics
  const stats = calculateStats(clusters, coordArrays, unassigned.length, _matrixDistanceFn);

  return {
    clusters,
    stats,
    unassigned,
  };
}

/**
 * Calculate cluster statistics
 */
function calculateStats(
  clusters: Cluster<any>[],
  coordArrays: CoordinateArrays,
  unassignedCount: number,
  _matrixDistanceFn?: any
): ClusterStats {
  let totalDistance = 0;
  let maxDistance = 0;

  const clusterStats = clusters.map(cluster => {
    let clusterTotalDist = 0;
    const centroidCoords = Float64Array.from(cluster.centroid);

    for (const point of cluster.points) {
      // Find point index
      const pointIdx = 0; // TODO: maintain index mapping
      
      if (coordArrays.coords.length > 0 && coordArrays.coords[pointIdx]) {
        const dist = Math.sqrt(
          coordDistanceSquared(coordArrays.coords[pointIdx], centroidCoords)
        );
        clusterTotalDist += dist;
        totalDistance += dist;
        maxDistance = Math.max(maxDistance, dist);
      }
    }

    const avgDist = cluster.points.length > 0 ? clusterTotalDist / cluster.points.length : 0;

    return {
      index: cluster.index,
      size: cluster.points.length,
      totalWeight: cluster.totalWeight,
      averageDistance: avgDist,
      centroid: cluster.centroid,
    };
  });

  // Calculate imbalance ratio
  const sizes = clusters.map(c => c.points.length);
  const maxSize = Math.max(...sizes, 0);
  const minSize = Math.min(...sizes, Infinity);
  const avgSize = sizes.reduce((sum, s) => sum + s, 0) / (sizes.length || 1);
  const imbalanceRatio = avgSize > 0 ? (maxSize - minSize) / avgSize : 0;

  return {
    totalDistance,
    maxDistance,
    imbalanceRatio,
    unassignedCount,
    clusters: clusterStats,
  };
}

/**
 * Calculate cluster capacities based on constraints
 */
function calculateCapacities(
  k: number,
  totalWeight: number,
  _pointCount: number,
  capacity?: any
): number[] {
  if (capacity?.perCluster) {
    return capacity.perCluster.slice(0, k);
  }

  const avgWeight = totalWeight / k;
  const min = capacity?.min ?? avgWeight * 0.8;
  const max = capacity?.max ?? avgWeight * 1.2;

  // Distribute capacity evenly with some flexibility
  return Array.from({ length: k }, () => max);
}

/**
 * Create a single cluster containing all points
 */
function createSingleCluster<T extends ClusterPoint>(
  points: T[],
  weight: (p: T) => number
): ClusterResult<T> {
  const totalWeight = points.reduce((sum, p) => sum + weight(p), 0);

  return {
    clusters: [
      {
        index: 0,
        points,
        centroid: [],
        totalWeight,
      },
    ],
    stats: {
      totalDistance: 0,
      maxDistance: 0,
      imbalanceRatio: 0,
      unassignedCount: 0,
      clusters: [
        {
          index: 0,
          size: points.length,
          totalWeight,
          averageDistance: 0,
          centroid: [],
        },
      ],
    },
    unassigned: [],
  };
}

/**
 * Create empty stats object
 */
function createEmptyStats(): ClusterStats {
  return {
    totalDistance: 0,
    maxDistance: 0,
    imbalanceRatio: 0,
    unassignedCount: 0,
    clusters: [],
  };
}
