"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  applyStickyPenalty: () => applyStickyPenalty,
  balancedCluster: () => balancedCluster,
  calculateAssignmentDelta: () => calculateAssignmentDelta,
  calculateStabilityScore: () => calculateStabilityScore,
  centroidsToGeoJSON: () => centroidsToGeoJSON,
  clusterBoundsToGeoJSON: () => clusterBoundsToGeoJSON,
  default: () => index_default,
  distances: () => distances,
  extractAssignments: () => extractAssignments,
  geoCluster: () => geoCluster,
  toGeoJSON: () => toGeoJSON,
  toStyledGeoJSON: () => toStyledGeoJSON,
  validatePreviousAssignment: () => validatePreviousAssignment
});
module.exports = __toCommonJS(index_exports);

// src/core/random.ts
var SeededRandom = class {
  constructor(seed = Date.now()) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  /**
   * Generate next random number between 0 and 1
   */
  next() {
    this.seed = this.seed * 16807 % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }
  /**
   * Shuffle array in place using Fisher-Yates algorithm
   */
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /**
   * Reset the seed
   */
  reset(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
};

// src/core/kmeans.ts
function balancedKMeans(points, options) {
  const {
    k,
    distance,
    weight = () => 1,
    capacity,
    eligibility,
    previous,
    seed = 42,
    maxIterations = 30,
    useMatrix = false
  } = options;
  if (points.length === 0) {
    return {
      clusters: [],
      stats: createEmptyStats(),
      unassigned: []
    };
  }
  const actualK = Math.min(k, points.length);
  if (actualK <= 0) {
    return {
      clusters: [],
      stats: createEmptyStats(),
      unassigned: points
    };
  }
  if (actualK === 1) {
    return createSingleCluster(points, weight);
  }
  const rng = new SeededRandom(seed);
  const weights = points.map(weight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const capacities = calculateCapacities(actualK, totalWeight, weights.length, capacity);
  const coordArrays = extractCoordinates(points, distance, useMatrix);
  const centroids = initializeCentroids(
    coordArrays,
    actualK,
    rng,
    useMatrix ? distance : void 0
  );
  let assignments = runKMeansIterations(
    coordArrays,
    centroids,
    maxIterations,
    useMatrix ? distance : void 0
  );
  const balancedAssignments = applyCapacityConstraints(
    coordArrays,
    centroids,
    weights,
    capacities,
    eligibility,
    points,
    actualK,
    previous,
    useMatrix ? distance : void 0
  );
  return buildClusterResult(
    points,
    balancedAssignments,
    centroids,
    weights,
    coordArrays,
    useMatrix ? distance : void 0
  );
}
function extractCoordinates(points, _distance, useMatrix) {
  if (useMatrix) {
    return {
      coords: [],
      dimensions: 0
    };
  }
  const first = points[0];
  if ("lat" in first && "lng" in first) {
    return {
      coords: points.map((p) => Float64Array.from([p.lat, p.lng])),
      dimensions: 2
    };
  }
  if ("latitude" in first && "longitude" in first) {
    return {
      coords: points.map((p) => Float64Array.from([p.latitude, p.longitude])),
      dimensions: 2
    };
  }
  if ("x" in first && "y" in first) {
    return {
      coords: points.map((p) => Float64Array.from([p.x, p.y])),
      dimensions: 2
    };
  }
  if ("coordinates" in first && Array.isArray(first.coordinates)) {
    const coords = first.coordinates;
    return {
      coords: points.map((p) => Float64Array.from(p.coordinates)),
      dimensions: coords.length
    };
  }
  if ("vector" in first && Array.isArray(first.vector)) {
    const vec = first.vector;
    return {
      coords: points.map((p) => Float64Array.from(p.vector)),
      dimensions: vec.length
    };
  }
  throw new Error(
    "Could not auto-detect coordinate format. Points should have lat/lng, latitude/longitude, x/y, coordinates[], or vector[] fields"
  );
}
function coordDistanceSquared(coords1, coords2) {
  let sum = 0;
  for (let i = 0; i < coords1.length; i++) {
    const diff = coords1[i] - coords2[i];
    sum += diff * diff;
  }
  return sum;
}
function initializeCentroids(coordArrays, k, _rng, _matrixDistanceFn) {
  const n = coordArrays.coords.length;
  const dimensions = coordArrays.dimensions;
  const centroids = [];
  if (n === 0 || dimensions === 0) {
    return Array.from({ length: k }, (_, i) => ({
      coords: [i]
      // Use indices as placeholder
    }));
  }
  let avgCoords = new Array(dimensions).fill(0);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dimensions; d++) {
      avgCoords[d] += coordArrays.coords[i][d];
    }
  }
  avgCoords = avgCoords.map((sum) => sum / n);
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
    coords: Array.from(coordArrays.coords[firstIdx])
  });
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
      coords: Array.from(coordArrays.coords[maxIdx])
    });
  }
  return centroids;
}
function runKMeansIterations(coordArrays, centroids, maxIterations, _matrixDistanceFn) {
  const n = coordArrays.coords.length;
  const k = centroids.length;
  if (n === 0 || coordArrays.dimensions === 0) {
    return Array.from({ length: n }, (_, i) => i % k);
  }
  let assignments = new Array(n).fill(0);
  for (let iter = 0; iter < maxIterations; iter++) {
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
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed) {
      break;
    }
    for (let c = 0; c < k; c++) {
      const clusterPoints = [];
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
        centroids[c].coords = newCoords.map((sum) => sum / clusterPoints.length);
      }
    }
  }
  return assignments;
}
function applyCapacityConstraints(coordArrays, centroids, weights, capacities, eligibility, points, k, _previous, _matrixDistanceFn) {
  const n = points.length;
  const pointDistances = [];
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < k; c++) {
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
        if (!eligible) {
          continue;
        }
      }
      let distance;
      if (coordArrays.coords.length > 0) {
        distance = coordDistanceSquared(
          coordArrays.coords[i],
          Float64Array.from(centroids[c].coords)
        );
      } else if (_matrixDistanceFn) {
        distance = i * k + c;
      } else {
        distance = 0;
      }
      pointDistances.push({
        pointIdx: i,
        clusterIdx: c,
        distance
      });
    }
  }
  pointDistances.sort((a, b) => a.distance - b.distance);
  const assignments = new Array(n).fill(-1);
  const clusterWeights = new Array(k).fill(0);
  for (const { pointIdx, clusterIdx, distance } of pointDistances) {
    if (assignments[pointIdx] !== -1) {
      continue;
    }
    const pointWeight = weights[pointIdx];
    const newWeight = clusterWeights[clusterIdx] + pointWeight;
    if (newWeight <= capacities[clusterIdx]) {
      assignments[pointIdx] = clusterIdx;
      clusterWeights[clusterIdx] = newWeight;
    }
  }
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
function buildClusterResult(points, assignments, centroids, weights, coordArrays, _matrixDistanceFn) {
  const k = centroids.length;
  const clusters = [];
  const unassigned = [];
  for (let c = 0; c < k; c++) {
    const clusterPoints = [];
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
      totalWeight
    });
  }
  for (let i = 0; i < points.length; i++) {
    if (assignments[i] === -1) {
      unassigned.push(points[i]);
    }
  }
  const stats = calculateStats(clusters, coordArrays, unassigned.length, _matrixDistanceFn);
  return {
    clusters,
    stats,
    unassigned
  };
}
function calculateStats(clusters, coordArrays, unassignedCount, _matrixDistanceFn) {
  let totalDistance = 0;
  let maxDistance = 0;
  const clusterStats = clusters.map((cluster) => {
    let clusterTotalDist = 0;
    const centroidCoords = Float64Array.from(cluster.centroid);
    for (const point of cluster.points) {
      const pointIdx = 0;
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
      centroid: cluster.centroid
    };
  });
  const sizes = clusters.map((c) => c.points.length);
  const maxSize = Math.max(...sizes, 0);
  const minSize = Math.min(...sizes, Infinity);
  const avgSize = sizes.reduce((sum, s) => sum + s, 0) / (sizes.length || 1);
  const imbalanceRatio = avgSize > 0 ? (maxSize - minSize) / avgSize : 0;
  return {
    totalDistance,
    maxDistance,
    imbalanceRatio,
    unassignedCount,
    clusters: clusterStats
  };
}
function calculateCapacities(k, totalWeight, _pointCount, capacity) {
  if (capacity?.perCluster) {
    return capacity.perCluster.slice(0, k);
  }
  const avgWeight = totalWeight / k;
  const min = capacity?.min ?? avgWeight * 0.8;
  const max = capacity?.max ?? avgWeight * 1.2;
  return Array.from({ length: k }, () => max);
}
function createSingleCluster(points, weight) {
  const totalWeight = points.reduce((sum, p) => sum + weight(p), 0);
  return {
    clusters: [
      {
        index: 0,
        points,
        centroid: [],
        totalWeight
      }
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
          centroid: []
        }
      ]
    },
    unassigned: []
  };
}
function createEmptyStats() {
  return {
    totalDistance: 0,
    maxDistance: 0,
    imbalanceRatio: 0,
    unassignedCount: 0,
    clusters: []
  };
}

// src/core/exact-solver.ts
function exactBalancedSolver(points, options) {
  const {
    k,
    weight = () => 1,
    capacity,
    eligibility,
    seed = 42
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
        clusters: []
      },
      unassigned: []
    };
  }
  const rng = new SeededRandom(seed);
  const weights = points.map(weight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const capacities = calculateCapacities2(actualK, totalWeight, capacity);
  const costMatrix = buildCostMatrix(points, actualK, options);
  const assignments = solveMinCostFlow(
    costMatrix,
    weights,
    capacities,
    eligibility,
    points,
    actualK
  );
  return buildResult(points, assignments, weights, actualK, costMatrix);
}
function buildCostMatrix(points, k, options) {
  const n = points.length;
  const matrix = [];
  const coords = extractPointCoordinates(points);
  const centroidIndices = initializeCentroidIndices(coords, k, options.seed || 42);
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let c = 0; c < k; c++) {
      const centroidIdx = centroidIndices[c];
      const dist = calculatePointDistance(coords[i], coords[centroidIdx]);
      row.push(dist);
    }
    matrix.push(row);
  }
  return matrix;
}
function extractPointCoordinates(points) {
  return points.map((p) => {
    if ("lat" in p && "lng" in p) {
      return [p.lat, p.lng];
    }
    if ("latitude" in p && "longitude" in p) {
      return [p.latitude, p.longitude];
    }
    if ("x" in p && "y" in p) {
      return [p.x, p.y];
    }
    if ("coordinates" in p && Array.isArray(p.coordinates)) {
      return p.coordinates;
    }
    if ("vector" in p && Array.isArray(p.vector)) {
      return p.vector;
    }
    return [0, 0];
  });
}
function calculatePointDistance(coords1, coords2) {
  let sum = 0;
  for (let i = 0; i < coords1.length; i++) {
    const diff = coords1[i] - coords2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
function initializeCentroidIndices(coords, k, seed) {
  const rng = new SeededRandom(seed);
  const n = coords.length;
  const indices = [];
  if (n === 0) return indices;
  indices.push(rng.nextInt(0, n));
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
function solveMinCostFlow(costMatrix, weights, capacities, eligibility, points, k) {
  const n = points.length;
  const assignments = new Array(n).fill(-1);
  const clusterWeights = new Array(k).fill(0);
  const candidates = [];
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < k; c++) {
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
        weight: weights[i]
      });
    }
  }
  candidates.sort((a, b) => a.cost - b.cost);
  for (const candidate of candidates) {
    const { pointIdx, clusterIdx, weight } = candidate;
    if (assignments[pointIdx] !== -1) {
      continue;
    }
    const newWeight = clusterWeights[clusterIdx] + weight;
    if (newWeight <= capacities[clusterIdx]) {
      assignments[pointIdx] = clusterIdx;
      clusterWeights[clusterIdx] = newWeight;
    }
  }
  for (let i = 0; i < n; i++) {
    if (assignments[i] !== -1) continue;
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
  const maxSwapIterations = 10;
  for (let iter = 0; iter < maxSwapIterations; iter++) {
    let improved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ci = assignments[i];
        const cj = assignments[j];
        if (ci === cj) continue;
        const currentCost = costMatrix[i][ci] + costMatrix[j][cj];
        const swappedCost = costMatrix[i][cj] + costMatrix[j][ci];
        const wi = weights[i];
        const wj = weights[j];
        const newWeightI = clusterWeights[ci] - wi + wj;
        const newWeightJ = clusterWeights[cj] - wj + wi;
        if (swappedCost < currentCost && newWeightI <= capacities[ci] && newWeightJ <= capacities[cj]) {
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
function calculateCapacities2(k, totalWeight, capacity) {
  if (capacity?.perCluster) {
    return capacity.perCluster.slice(0, k);
  }
  const avgWeight = totalWeight / k;
  const min = capacity?.min ?? avgWeight * 0.9;
  const max = capacity?.max ?? avgWeight * 1.1;
  return Array.from({ length: k }, () => max);
}
function buildResult(points, assignments, weights, k, costMatrix) {
  const clusters = Array.from({ length: k }, (_, idx) => ({
    index: idx,
    points: [],
    centroid: [],
    totalWeight: 0
  }));
  const unassigned = [];
  for (let i = 0; i < points.length; i++) {
    const clusterIdx = assignments[i];
    if (clusterIdx === -1) {
      unassigned.push(points[i]);
    } else {
      clusters[clusterIdx].points.push(points[i]);
      clusters[clusterIdx].totalWeight += weights[i];
    }
  }
  let totalDistance = 0;
  let maxDistance = 0;
  const clusterStats = clusters.map((cluster) => {
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
      centroid: cluster.centroid
    };
  });
  const sizes = clusters.map((c) => c.points.length);
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
      clusters: clusterStats
    },
    unassigned
  };
}

// src/core/distances.ts
function distanceSquared(lat1, lng1, lat2, lng2) {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return dLat * dLat + dLng * dLng;
}
function euclidean2D(lat1, lng1, lat2, lng2) {
  return Math.sqrt(distanceSquared(lat1, lng1, lat2, lng2));
}
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}
function euclideanND(vector1, vector2) {
  if (vector1.length !== vector2.length) {
    throw new Error("Vectors must have same dimensions");
  }
  let sum = 0;
  for (let i = 0; i < vector1.length; i++) {
    const diff = vector1[i] - vector2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
function manhattanND(vector1, vector2) {
  if (vector1.length !== vector2.length) {
    throw new Error("Vectors must have same dimensions");
  }
  let sum = 0;
  for (let i = 0; i < vector1.length; i++) {
    sum += Math.abs(vector1[i] - vector2[i]);
  }
  return sum;
}
function matrixDistance(matrix) {
  return (index1, index2) => {
    if (index1 < 0 || index1 >= matrix.length) {
      throw new Error(`Invalid index1: ${index1}`);
    }
    if (index2 < 0 || index2 >= matrix[index1].length) {
      throw new Error(`Invalid index2: ${index2}`);
    }
    return matrix[index1][index2];
  };
}
function flatMatrixDistance(flatMatrix, size) {
  return (index1, index2) => {
    if (index1 < 0 || index1 >= size) {
      throw new Error(`Invalid index1: ${index1}`);
    }
    if (index2 < 0 || index2 >= size) {
      throw new Error(`Invalid index2: ${index2}`);
    }
    return flatMatrix[index1 * size + index2];
  };
}
var distances = {
  /** Fast squared Euclidean (avoids sqrt) - best for performance */
  euclideanSquared: distanceSquared,
  /** Standard Euclidean distance for 2D */
  euclidean: euclidean2D,
  /** Haversine distance for geographic coordinates (in km) */
  haversine,
  /** N-dimensional Euclidean distance */
  euclideanND,
  /** Manhattan (L1) distance */
  manhattan: manhattanND,
  /** Create distance function from precomputed matrix */
  fromMatrix: matrixDistance,
  /** Create distance function from flat array */
  fromFlatMatrix: flatMatrixDistance
};

// src/geo/geojson.ts
function toGeoJSON(result, coordinateExtractor) {
  const features = [];
  const getLat = coordinateExtractor?.latitude || defaultLatExtractor;
  const getLng = coordinateExtractor?.longitude || defaultLngExtractor;
  for (const cluster of result.clusters) {
    for (const point of cluster.points) {
      const lat = getLat(point);
      const lng = getLng(point);
      if (lat != null && lng != null) {
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [lng, lat]
            // GeoJSON uses [lng, lat] order
          },
          properties: {
            ...point,
            cluster: cluster.index,
            clusterSize: cluster.points.length,
            clusterWeight: cluster.totalWeight
          }
        });
      }
    }
  }
  for (const point of result.unassigned) {
    const lat = getLat(point);
    const lng = getLng(point);
    if (lat != null && lng != null) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat]
        },
        properties: {
          ...point,
          cluster: -1,
          unassigned: true
        }
      });
    }
  }
  return {
    type: "FeatureCollection",
    features
  };
}
function centroidsToGeoJSON(result) {
  const features = [];
  for (const cluster of result.clusters) {
    if (cluster.centroid.length >= 2) {
      const [lat, lng] = cluster.centroid;
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat]
        },
        properties: {
          cluster: cluster.index,
          size: cluster.points.length,
          totalWeight: cluster.totalWeight,
          isCentroid: true
        }
      });
    }
  }
  return {
    type: "FeatureCollection",
    features
  };
}
function clusterBoundsToGeoJSON(result, coordinateExtractor) {
  const features = [];
  const getLat = coordinateExtractor?.latitude || defaultLatExtractor;
  const getLng = coordinateExtractor?.longitude || defaultLngExtractor;
  for (const cluster of result.clusters) {
    if (cluster.points.length === 0) continue;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const point of cluster.points) {
      const lat = getLat(point);
      const lng = getLng(point);
      if (lat != null && lng != null) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }
    }
    if (isFinite(minLat) && isFinite(maxLat)) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat]
              // Close the polygon
            ]
          ]
        },
        properties: {
          cluster: cluster.index,
          size: cluster.points.length,
          totalWeight: cluster.totalWeight
        }
      });
    }
  }
  return {
    type: "FeatureCollection",
    features
  };
}
function defaultLatExtractor(point) {
  if ("lat" in point) return point.lat;
  if ("latitude" in point) return point.latitude;
  if ("y" in point) return point.y;
  if ("coordinates" in point && Array.isArray(point.coordinates)) {
    return point.coordinates[0];
  }
  return null;
}
function defaultLngExtractor(point) {
  if ("lng" in point) return point.lng;
  if ("lon" in point) return point.lon;
  if ("longitude" in point) return point.longitude;
  if ("x" in point) return point.x;
  if ("coordinates" in point && Array.isArray(point.coordinates)) {
    return point.coordinates[1];
  }
  return null;
}
function toStyledGeoJSON(result, coordinateExtractor, colorPalette) {
  const defaultColors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
    "#F8B739",
    "#52B3D9",
    "#E74C3C",
    "#3498DB"
  ];
  const colors = colorPalette || defaultColors;
  const geojson = toGeoJSON(result, coordinateExtractor);
  for (const feature of geojson.features) {
    const clusterIdx = feature.properties.cluster;
    if (clusterIdx >= 0) {
      feature.properties.color = colors[clusterIdx % colors.length];
      feature.properties["marker-color"] = colors[clusterIdx % colors.length];
    } else {
      feature.properties.color = "#999999";
      feature.properties["marker-color"] = "#999999";
    }
  }
  return geojson;
}

// src/core/sticky.ts
function applyStickyPenalty(costMatrix, previous, stickyPenalty = 2) {
  const n = costMatrix.length;
  const k = costMatrix[0]?.length || 0;
  const modifiedMatrix = costMatrix.map((row) => [...row]);
  for (let i = 0; i < n; i++) {
    const prevCluster = previous.assignments[i];
    if (prevCluster === void 0 || prevCluster === -1) {
      continue;
    }
    if (prevCluster >= 0 && prevCluster < k) {
      modifiedMatrix[i][prevCluster] /= stickyPenalty;
    }
  }
  return modifiedMatrix;
}
function calculateAssignmentDelta(assignments1, assignments2) {
  let delta = 0;
  const n = Math.min(assignments1.length, assignments2.length);
  for (let i = 0; i < n; i++) {
    if (assignments1[i] !== assignments2[i]) {
      delta++;
    }
  }
  return delta;
}
function calculateStabilityScore(assignments1, assignments2) {
  const n = Math.min(assignments1.length, assignments2.length);
  if (n === 0) return 1;
  let stable = 0;
  for (let i = 0; i < n; i++) {
    if (assignments1[i] === assignments2[i]) {
      stable++;
    }
  }
  return stable / n;
}
function extractAssignments(result, points) {
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
function validatePreviousAssignment(previous, pointCount, clusterCount) {
  if (!previous.assignments || !Array.isArray(previous.assignments)) {
    return false;
  }
  if (previous.assignments.length !== pointCount) {
    return false;
  }
  for (const assignment of previous.assignments) {
    if (typeof assignment !== "number" || assignment !== -1 && (assignment < 0 || assignment >= clusterCount)) {
      return false;
    }
  }
  return true;
}

// src/index.ts
function balancedCluster(points, options) {
  const solver = options.solver || "fast";
  if (solver === "exact") {
    return exactBalancedSolver(points, options);
  } else {
    return balancedKMeans(points, options);
  }
}
function geoCluster(points, options) {
  const {
    latitude = "latitude",
    longitude = "longitude",
    useHaversine = false,
    ...clusterOptions
  } = options;
  const getLat = typeof latitude === "function" ? latitude : (p) => p[latitude];
  const getLng = typeof longitude === "function" ? longitude : (p) => p[longitude];
  const distanceFn = useHaversine ? haversine : euclidean2D;
  const distance = (p1, p2) => {
    const lat1 = getLat(p1);
    const lng1 = getLng(p1);
    const lat2 = getLat(p2);
    const lng2 = getLng(p2);
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
      return Infinity;
    }
    return distanceFn(lat1, lng1, lat2, lng2);
  };
  return balancedCluster(points, {
    ...clusterOptions,
    distance
  });
}
var index_default = {
  balancedCluster,
  geoCluster,
  distances,
  toGeoJSON,
  centroidsToGeoJSON,
  clusterBoundsToGeoJSON,
  toStyledGeoJSON,
  extractAssignments,
  calculateStabilityScore
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  applyStickyPenalty,
  balancedCluster,
  calculateAssignmentDelta,
  calculateStabilityScore,
  centroidsToGeoJSON,
  clusterBoundsToGeoJSON,
  distances,
  extractAssignments,
  geoCluster,
  toGeoJSON,
  toStyledGeoJSON,
  validatePreviousAssignment
});
