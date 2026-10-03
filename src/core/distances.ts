/**
 * Distance calculation functions for clustering
 */

import type { ClusterPoint, DistanceFunction, MatrixDistanceFunction } from '../types';

/**
 * Fast Euclidean distance squared (avoids expensive sqrt)
 * Works with 2D coordinates (lat/lng or x/y)
 */
export function distanceSquared(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return dLat * dLat + dLng * dLng;
}

/**
 * Euclidean distance for 2D points
 */
export function euclidean2D(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return Math.sqrt(distanceSquared(lat1, lng1, lat2, lng2));
}

/**
 * Haversine distance in kilometers
 * More accurate for geographic coordinates on Earth's surface
 */
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * N-dimensional Euclidean distance
 * Works with any dimensional vector
 */
export function euclideanND(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let sum = 0;
  for (let i = 0; i < vector1.length; i++) {
    const diff = vector1[i] - vector2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Manhattan (L1) distance for N-dimensional vectors
 */
export function manhattanND(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let sum = 0;
  for (let i = 0; i < vector1.length; i++) {
    sum += Math.abs(vector1[i] - vector2[i]);
  }

  return sum;
}

/**
 * Create a distance function from a precomputed cost matrix
 * This allows using OSRM, Valhalla, or any other routing engine
 * 
 * @param matrix - Square matrix where matrix[i][j] is the distance from point i to point j
 * @returns MatrixDistanceFunction that looks up precomputed distances
 */
export function matrixDistance(
  matrix: number[][]
): MatrixDistanceFunction {
  return (index1: number, index2: number): number => {
    if (index1 < 0 || index1 >= matrix.length) {
      throw new Error(`Invalid index1: ${index1}`);
    }
    if (index2 < 0 || index2 >= matrix[index1].length) {
      throw new Error(`Invalid index2: ${index2}`);
    }
    return matrix[index1][index2];
  };
}

/**
 * Create a distance function from a flat array (for memory efficiency)
 * Array should be in row-major order: [0,0], [0,1], ..., [0,n], [1,0], [1,1], ...
 * 
 * @param flatMatrix - Flattened distance matrix
 * @param size - Number of points (matrix is size x size)
 */
export function flatMatrixDistance(
  flatMatrix: Float64Array | number[],
  size: number
): MatrixDistanceFunction {
  return (index1: number, index2: number): number => {
    if (index1 < 0 || index1 >= size) {
      throw new Error(`Invalid index1: ${index1}`);
    }
    if (index2 < 0 || index2 >= size) {
      throw new Error(`Invalid index2: ${index2}`);
    }
    return flatMatrix[index1 * size + index2];
  };
}

/**
 * Generic distance function wrapper for objects with coordinate extraction
 * 
 * @param distanceFn - Underlying distance function for coordinates
 * @param extractCoords - Function to extract coordinates from objects
 */
export function createDistanceFunction<T extends ClusterPoint>(
  distanceFn: (lat1: number, lng1: number, lat2: number, lng2: number) => number,
  extractCoords: (point: T) => [number, number]
): DistanceFunction<T> {
  return (point1: T, point2: T): number => {
    const [lat1, lng1] = extractCoords(point1);
    const [lat2, lng2] = extractCoords(point2);
    return distanceFn(lat1, lng1, lat2, lng2);
  };
}

/**
 * Generic distance function for N-dimensional vectors stored in objects
 * 
 * @param extractVector - Function to extract vector from object
 * @param distanceFn - Distance function for vectors (default: euclidean)
 */
export function createVectorDistanceFunction<T extends ClusterPoint>(
  extractVector: (point: T) => number[],
  distanceFn: (v1: number[], v2: number[]) => number = euclideanND
): DistanceFunction<T> {
  return (point1: T, point2: T): number => {
    const v1 = extractVector(point1);
    const v2 = extractVector(point2);
    return distanceFn(v1, v2);
  };
}

/**
 * Pre-defined distance functions that can be used directly
 */
export const distances = {
  /** Fast squared Euclidean (avoids sqrt) - best for performance */
  euclideanSquared: distanceSquared,
  
  /** Standard Euclidean distance for 2D */
  euclidean: euclidean2D,
  
  /** Haversine distance for geographic coordinates (in km) */
  haversine: haversine,
  
  /** N-dimensional Euclidean distance */
  euclideanND: euclideanND,
  
  /** Manhattan (L1) distance */
  manhattan: manhattanND,
  
  /** Create distance function from precomputed matrix */
  fromMatrix: matrixDistance,
  
  /** Create distance function from flat array */
  fromFlatMatrix: flatMatrixDistance,
};
