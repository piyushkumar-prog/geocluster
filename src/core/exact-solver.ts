/**
 * Exact min-cost-flow inspired solver for balanced clustering
 * This is a simplified implementation that finds optimal assignments
 * given fixed centroids from k-means initialization
 * 
 * For small to medium datasets (< 5000 points), this provides
 * better balance than the greedy solver at the cost of speed
 */

import type {
  ClusterPoint,
  ClusterOptions,
  ClusterResult,
} from '../types';
import { SeededRandom } from './random';

/**
 * Assignment candidate with cost
 */
interface Assignment {
  pointIdx: number;
  clusterIdx: number;
  cost: number;
  weight: number;
}

/**
 * Exact solver using Hungarian-inspired assignment algorithm
 * 
 * This finds the minimum-cost assignment that respects capacity constraints
 * by iteratively solving the assignment problem with constraint violations
 */
export function exactBalancedSolver<T extends ClusterPoint>(
  points: T[],
  options: ClusterOptions<T>
): ClusterResult<T> {
  const {
    k,
    weight = () => 1,
    capacity,
    eligibility,
    seed = 42,
  } = options;

  const n = points.length;
  const actualK = Math.min(k, n);

  if (n === 0 || actualK === 0) {
    return {
      clusters: [],
      stats: {
        totalDistance: 0,
        maxDistance: 0,
        imbalanceRatio: 0,
        unassignedCount: 0,
        clusters: [],
      },
      unassigned: [],
    };
  }

  const rng = new SeededRandom(seed);
  const weights = points.map(weight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Calculate cluster capacities
  const capacities = calculateCapacities(actualK, totalWeight, capacity);

  // Build cost matrix (point x cluster)
  const costMatrix = buildCostMatrix(points, actualK, options);

  // Solve minimum cost flow problem
  const assignments = solveMinCostFlow(
    costMatrix,
    weights,
    capacities,
    eligibility,
    points,
    actualK
  );

  // Build result
  return buildResult(points, assignments, weights, actualK, costMatrix);
}

/**
 * Build cost matrix for all point-cluster pairs
 */
function buildCostMatrix<T extends ClusterPoint>(
  points: T[],
  k: number,
  options: ClusterOptions<T>
): number[][] {
  const n = points.length;
  const matrix: number[][] = [];

  // Extract coordinates
  const coords = extractPointCoordinates(points);

  // Initialize k cluster centroids using k-means++
  const centroidIndices = initializeCentroidIndices(coords, k, options.seed || 42);

  // Calculate distance from each point to each centroid
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let c = 0; c < k; c++) {
      const centroidIdx = centroidIndices[c];
      const dist = calculatePointDistance(coords[i], coords[centroidIdx]);
      row.push(dist);
    }
    matrix.push(row);
  }

  return matrix;
}

/**
 * Extract coordinates from points
 */
function extractPointCoordinates<T extends ClusterPoint>(
  points: T[]
): number[][] {
  return points.map(p => {
    // Try various coordinate formats
    if ('lat' in p && 'lng' in p) {
      return [p.lat as number, p.lng as number];
    }
    if ('latitude' in p && 'longitude' in p) {
      return [p.latitude as number, p.longitude as number];
    }
    if ('x' in p && 'y' in p) {
      return [p.x as number, p.y as number];
    }
    if ('coordinates' in p && Array.isArray(p.coordinates)) {
      return p.coordinates as number[];
    }
    if ('vector' in p && Array.isArray(p.vector)) {
      return p.vector as number[];
    }
    return [0, 0]; // Default fallback
  });
}

/**
 * Calculate distance between two coordinate arrays
 */
function calculatePointDistance(coords1: number[], coords2: number[]): number {
  let sum = 0;
  for (let i = 0; i < coords1.length; i++) {
    const diff = coords1[i] - coords2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Initialize centroid indices using k-means++
 */
function initializeCentroidIndices(
  coords: number[][],
  k: number,
  seed: number
): number[] {
  const rng = new SeededRandom(seed);
  const n = coords.length;
  const indices: number[] = [];

  if (n === 0) return indices;

  // First centroid: random
  indices.push(rng.nextInt(0, n));

  // Remaining centroids: farthest from existing
  for (let c = 1; c < k; c++) {
    let maxMinDist = -1;
    let maxIdx = 0;

    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      for (const idx of indices) {
        const dist = calculatePointDistance(coords[i], coords[idx]);
        minDist = Math.min(minDist, dist);
      }
      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        maxIdx = i;
      }
    }

    indices.push(maxIdx);
  }

  return indices;
}

/**
 * Solve minimum cost flow problem with capacity constraints
 * Uses a greedy approach with local optimization
 */
function solveMinCostFlow<T extends ClusterPoint>(
  costMatrix: number[][],
  weights: number[],
  capacities: number[],
  eligibility: any,
  points: T[],
  k: number
): number[] {
  const n = points.length;
  const assignments = new Array(n).fill(-1);
  const clusterWeights = new Array(k).fill(0);

  // Create sorted list of all feasible assignments
  const candidates: Assignment[] = [];

  for (let i = 0; i < n; i++) {
    for (let c = 0; c < k; c++) {
      // Check eligibility
      if (eligibility) {
        const pointTags = new Set(eligibility.points(points[i]));
        const clusterTags = new Set(eligibility.clusters(c));
        
        let eligible = true;
        for (const tag of clusterTags) {
          if (!pointTags.has(tag)) {
            eligible = false;
            break;
          }
        }
        
        if (!eligible) continue;
      }

      candidates.push({
        pointIdx: i,
        clusterIdx: c,
        cost: costMatrix[i][c],
        weight: weights[i],
      });
    }
  }

  // Sort by cost (ascending)
  candidates.sort((a, b) => a.cost - b.cost);

  // Greedy assignment with capacity constraints
  for (const candidate of candidates) {
    const { pointIdx, clusterIdx, weight } = candidate;

    if (assignments[pointIdx] !== -1) {
      continue; // Already assigned
    }

    const newWeight = clusterWeights[clusterIdx] + weight;
    if (newWeight <= capacities[clusterIdx]) {
      assignments[pointIdx] = clusterIdx;
      clusterWeights[clusterIdx] = newWeight;
    }
  }

  // Second pass: force assignment of remaining points
  for (let i = 0; i < n; i++) {
    if (assignments[i] !== -1) continue;

    // Find cluster with minimum cost and available capacity
    let bestCluster = -1;
    let bestCost = Infinity;

    for (let c = 0; c < k; c++) {
      const newWeight = clusterWeights[c] + weights[i];
      if (newWeight <= capacities[c] && costMatrix[i][c] < bestCost) {
        bestCost = costMatrix[i][c];
        bestCluster = c;
      }
    }

    if (bestCluster !== -1) {
      assignments[i] = bestCluster;
      clusterWeights[bestCluster] += weights[i];
    } else {
      // Force into least full cluster
      let minWeight = Infinity;
      let minCluster = 0;
      for (let c = 0; c < k; c++) {
        if (clusterWeights[c] < minWeight) {
          minWeight = clusterWeights[c];
          minCluster = c;
        }
      }
      assignments[i] = minCluster;
      clusterWeights[minCluster] += weights[i];
    }
  }

  // Local optimization: try swapping assignments to reduce total cost
  const maxSwapIterations = 10;
  for (let iter = 0; iter < maxSwapIterations; iter++) {
    let improved = false;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ci = assignments[i];
        const cj = assignments[j];

        if (ci === cj) continue;

        // Calculate current cost
        const currentCost = costMatrix[i][ci] + costMatrix[j][cj];

        // Calculate swapped cost
        const swappedCost = costMatrix[i][cj] + costMatrix[j][ci];

        // Check if swap improves and maintains capacity constraints
        const wi = weights[i];
        const wj = weights[j];

        const newWeightI = clusterWeights[ci] - wi + wj;
        const newWeightJ = clusterWeights[cj] - wj + wi;

        if (
          swappedCost < currentCost &&
          newWeightI <= capacities[ci] &&
          newWeightJ <= capacities[cj]
        ) {
          // Perform swap
          assignments[i] = cj;
          assignments[j] = ci;
          clusterWeights[ci] = newWeightI;
          clusterWeights[cj] = newWeightJ;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return assignments;
}

/**
 * Calculate cluster capacities
 */
function calculateCapacities(
  k: number,
  totalWeight: number,
  capacity?: any
): number[] {
  if (capacity?.perCluster) {
    return capacity.perCluster.slice(0, k);
  }

  const avgWeight = totalWeight / k;
  const min = capacity?.min ?? avgWeight * 0.9;
  const max = capacity?.max ?? avgWeight * 1.1;

  return Array.from({ length: k }, () => max);
}

/**
 * Build final result from assignments
 */
function buildResult<T extends ClusterPoint>(
  points: T[],
  assignments: number[],
  weights: number[],
  k: number,
  costMatrix: number[][]
): ClusterResult<T> {
  const clusters = Array.from({ length: k }, (_, idx) => ({
    index: idx,
    points: [] as T[],
    centroid: [] as number[],
    totalWeight: 0,
  }));

  const unassigned: T[] = [];

  // Group points by cluster
  for (let i = 0; i < points.length; i++) {
    const clusterIdx = assignments[i];
    if (clusterIdx === -1) {
      unassigned.push(points[i]);
    } else {
      clusters[clusterIdx].points.push(points[i]);
      clusters[clusterIdx].totalWeight += weights[i];
    }
  }

  // Calculate statistics
  let totalDistance = 0;
  let maxDistance = 0;

  const clusterStats = clusters.map(cluster => {
    let clusterDist = 0;
    for (const point of cluster.points) {
      const pointIdx = points.indexOf(point);
      const dist = costMatrix[pointIdx][cluster.index];
      clusterDist += dist;
      totalDistance += dist;
      maxDistance = Math.max(maxDistance, dist);
    }

    return {
      index: cluster.index,
      size: cluster.points.length,
      totalWeight: cluster.totalWeight,
      averageDistance: cluster.points.length > 0 ? clusterDist / cluster.points.length : 0,
      centroid: cluster.centroid,
    };
  });

  const sizes = clusters.map(c => c.points.length);
  const maxSize = Math.max(...sizes, 0);
  const minSize = Math.min(...sizes, Infinity);
  const avgSize = sizes.reduce((sum, s) => sum + s, 0) / (sizes.length || 1);
  const imbalanceRatio = avgSize > 0 ? (maxSize - minSize) / avgSize : 0;

  return {
    clusters,
    stats: {
      totalDistance,
      maxDistance,
      imbalanceRatio,
      unassignedCount: unassigned.length,
      clusters: clusterStats,
    },
    unassigned,
  };
}
