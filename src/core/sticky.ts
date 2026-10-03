/**
 * Sticky/incremental clustering support
 * Minimizes changes from previous assignment
 */

import type {
  ClusterPoint,
  ClusterOptions,
  ClusterResult,
  PreviousAssignment,
} from '../types';

/**
 * Apply sticky constraint to prefer previous assignments
 * This modifies the cost matrix to penalize reassignments
 * 
 * @param costMatrix - Original cost matrix
 * @param previous - Previous assignment
 * @param stickyPenalty - Penalty multiplier for changing assignments (default: 2.0)
 * @returns Modified cost matrix with sticky penalties
 */
export function applyStickyPenalty(
  costMatrix: number[][],
  previous: PreviousAssignment,
  stickyPenalty: number = 2.0
): number[][] {
  const n = costMatrix.length;
  const k = costMatrix[0]?.length || 0;

  const modifiedMatrix = costMatrix.map(row => [...row]);

  for (let i = 0; i < n; i++) {
    const prevCluster = previous.assignments[i];
    
    if (prevCluster === undefined || prevCluster === -1) {
      continue; // No previous assignment
    }

    if (prevCluster >= 0 && prevCluster < k) {
      // Reduce cost for staying in same cluster
      modifiedMatrix[i][prevCluster] /= stickyPenalty;
    }
  }

  return modifiedMatrix;
}

/**
 * Calculate assignment delta between two assignments
 * Returns the number of points that changed clusters
 */
export function calculateAssignmentDelta(
  assignments1: number[],
  assignments2: number[]
): number {
  let delta = 0;
  const n = Math.min(assignments1.length, assignments2.length);

  for (let i = 0; i < n; i++) {
    if (assignments1[i] !== assignments2[i]) {
      delta++;
    }
  }

  return delta;
}

/**
 * Calculate stability score (percentage of points that stayed in same cluster)
 */
export function calculateStabilityScore(
  assignments1: number[],
  assignments2: number[]
): number {
  const n = Math.min(assignments1.length, assignments2.length);
  if (n === 0) return 1.0;

  let stable = 0;
  for (let i = 0; i < n; i++) {
    if (assignments1[i] === assignments2[i]) {
      stable++;
    }
  }

  return stable / n;
}

/**
 * Extract assignment array from cluster result
 */
export function extractAssignments<T extends ClusterPoint>(
  result: ClusterResult<T>,
  points: T[]
): number[] {
  const assignments = new Array(points.length).fill(-1);

  for (const cluster of result.clusters) {
    for (const point of cluster.points) {
      const idx = points.indexOf(point);
      if (idx !== -1) {
        assignments[idx] = cluster.index;
      }
    }
  }

  return assignments;
}

/**
 * Validate previous assignment compatibility
 */
export function validatePreviousAssignment(
  previous: PreviousAssignment,
  pointCount: number,
  clusterCount: number
): boolean {
  if (!previous.assignments || !Array.isArray(previous.assignments)) {
    return false;
  }

  if (previous.assignments.length !== pointCount) {
    return false;
  }

  // Check that all assignments are valid cluster indices or -1 (unassigned)
  for (const assignment of previous.assignments) {
    if (
      typeof assignment !== 'number' ||
      (assignment !== -1 && (assignment < 0 || assignment >= clusterCount))
    ) {
      return false;
    }
  }

  return true;
}
