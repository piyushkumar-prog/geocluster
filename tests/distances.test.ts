import { describe, it, expect } from 'vitest';
import {
  distanceSquared,
  euclidean2D,
  haversine,
  euclideanND,
  manhattanND,
  matrixDistance,
  flatMatrixDistance,
} from '../src/core/distances';

describe('Distance Functions', () => {
  describe('distanceSquared', () => {
    it('should calculate squared Euclidean distance', () => {
      expect(distanceSquared(0, 0, 3, 4)).toBe(25); // 3^2 + 4^2 = 25
      expect(distanceSquared(1, 1, 1, 1)).toBe(0);
      expect(distanceSquared(-1, -1, 1, 1)).toBe(8); // 2^2 + 2^2 = 8
    });
  });

  describe('euclidean2D', () => {
    it('should calculate Euclidean distance', () => {
      expect(euclidean2D(0, 0, 3, 4)).toBe(5);
      expect(euclidean2D(1, 1, 1, 1)).toBe(0);
    });
  });

  describe('haversine', () => {
    it('should calculate distance between two coordinates', () => {
      // Distance from New York to Los Angeles (approx 3944 km)
      const nyLat = 40.7128;
      const nyLng = -74.006;
      const laLat = 34.0522;
      const laLng = -118.2437;

      const distance = haversine(nyLat, nyLng, laLat, laLng);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it('should return 0 for same coordinates', () => {
      expect(haversine(0, 0, 0, 0)).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const distance = haversine(-33.8688, 151.2093, 51.5074, -0.1278);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('euclideanND', () => {
    it('should calculate N-dimensional Euclidean distance', () => {
      expect(euclideanND([0, 0, 0], [1, 1, 1])).toBeCloseTo(Math.sqrt(3));
      expect(euclideanND([1, 2, 3, 4], [5, 6, 7, 8])).toBeCloseTo(8);
    });

    it('should throw for mismatched dimensions', () => {
      expect(() => euclideanND([1, 2], [1, 2, 3])).toThrow();
    });
  });

  describe('manhattanND', () => {
    it('should calculate Manhattan distance', () => {
      expect(manhattanND([0, 0], [3, 4])).toBe(7);
      expect(manhattanND([1, 2, 3], [4, 5, 6])).toBe(9);
    });

    it('should throw for mismatched dimensions', () => {
      expect(() => manhattanND([1, 2], [1, 2, 3])).toThrow();
    });
  });

  describe('matrixDistance', () => {
    it('should create distance function from matrix', () => {
      const matrix = [
        [0, 10, 20],
        [10, 0, 15],
        [20, 15, 0],
      ];
      const distFn = matrixDistance(matrix);

      expect(distFn(0, 1)).toBe(10);
      expect(distFn(1, 2)).toBe(15);
      expect(distFn(0, 0)).toBe(0);
    });

    it('should throw for invalid indices', () => {
      const matrix = [[0, 10], [10, 0]];
      const distFn = matrixDistance(matrix);

      expect(() => distFn(-1, 0)).toThrow();
      expect(() => distFn(0, 5)).toThrow();
    });
  });

  describe('flatMatrixDistance', () => {
    it('should create distance function from flat array', () => {
      // 3x3 matrix flattened
      const flatMatrix = [0, 10, 20, 10, 0, 15, 20, 15, 0];
      const distFn = flatMatrixDistance(flatMatrix, 3);

      expect(distFn(0, 1)).toBe(10);
      expect(distFn(1, 2)).toBe(15);
      expect(distFn(2, 0)).toBe(20);
    });

    it('should work with Float64Array', () => {
      const flatMatrix = new Float64Array([0, 5, 5, 0]);
      const distFn = flatMatrixDistance(flatMatrix, 2);

      expect(distFn(0, 1)).toBe(5);
      expect(distFn(1, 0)).toBe(5);
    });
  });
});
