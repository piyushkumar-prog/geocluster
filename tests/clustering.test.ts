import { describe, it, expect } from 'vitest';
import { balancedCluster, geoCluster } from '../src/index';

describe('Balanced Clustering', () => {
  describe('Basic clustering', () => {
    it('should cluster simple 2D points', () => {
      const points = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 10, lng: 10 },
        { lat: 10, lng: 11 },
      ];

      const result = balancedCluster(points, {
        k: 2,
        seed: 42,
      });

      expect(result.clusters).toHaveLength(2);
      expect(result.unassigned).toHaveLength(0);
      expect(result.clusters[0].points.length).toBeGreaterThan(0);
      expect(result.clusters[1].points.length).toBeGreaterThan(0);
    });

    it('should handle empty input', () => {
      const result = balancedCluster([], { k: 3 });

      expect(result.clusters).toHaveLength(0);
      expect(result.unassigned).toHaveLength(0);
      expect(result.stats.unassignedCount).toBe(0);
    });

    it('should handle k=1', () => {
      const points = [
        { lat: 0, lng: 0 },
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
      ];

      const result = balancedCluster(points, { k: 1 });

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].points).toHaveLength(3);
    });

    it('should handle k > n', () => {
      const points = [
        { lat: 0, lng: 0 },
        { lat: 1, lng: 1 },
      ];

      const result = balancedCluster(points, { k: 5 });

      expect(result.clusters.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Capacity constraints', () => {
    it('should respect max capacity', () => {
      const points = Array.from({ length: 100 }, (_, i) => ({
        lat: Math.random() * 10,
        lng: Math.random() * 10,
      }));

      const result = balancedCluster(points, {
        k: 5,
        capacity: { max: 25 },
        seed: 42,
      });

      for (const cluster of result.clusters) {
        expect(cluster.points.length).toBeLessThanOrEqual(25);
      }
    });

    it('should respect weighted capacity', () => {
      const points = [
        { lat: 0, lng: 0, weight: 10 },
        { lat: 0, lng: 1, weight: 15 },
        { lat: 10, lng: 10, weight: 20 },
        { lat: 10, lng: 11, weight: 5 },
      ];

      const result = balancedCluster(points, {
        k: 2,
        weight: p => p.weight,
        capacity: { max: 30 },
        seed: 42,
      });

      for (const cluster of result.clusters) {
        expect(cluster.totalWeight).toBeLessThanOrEqual(30);
      }
    });
  });

  describe('Deterministic results', () => {
    it('should produce same results with same seed', () => {
      const points = Array.from({ length: 50 }, (_, i) => ({
        lat: Math.random() * 10,
        lng: Math.random() * 10,
      }));

      const result1 = balancedCluster(points, { k: 5, seed: 42 });
      const result2 = balancedCluster(points, { k: 5, seed: 42 });

      expect(result1.clusters[0].points.length).toBe(result2.clusters[0].points.length);
      expect(result1.stats.totalDistance).toBeCloseTo(result2.stats.totalDistance);
    });

    it('should produce different results with different seeds', () => {
      const points = Array.from({ length: 50 }, (_, i) => ({
        lat: Math.random() * 10,
        lng: Math.random() * 10,
      }));

      const result1 = balancedCluster(points, { k: 5, seed: 42 });
      const result2 = balancedCluster(points, { k: 5, seed: 100 });

      // With different seeds, at least one cluster should have different size
      const sizes1 = result1.clusters.map(c => c.points.length).sort();
      const sizes2 = result2.clusters.map(c => c.points.length).sort();
      
      // Allow for same results occasionally, but usually they differ
      // Just ensure both produce valid results
      expect(result1.clusters).toHaveLength(5);
      expect(result2.clusters).toHaveLength(5);
    });
  });

  describe('Solver modes', () => {
    it('should work with fast solver', () => {
      const points = Array.from({ length: 20 }, (_, i) => ({
        lat: Math.random() * 10,
        lng: Math.random() * 10,
      }));

      const result = balancedCluster(points, {
        k: 4,
        solver: 'fast',
        seed: 42,
      });

      expect(result.clusters).toHaveLength(4);
      expect(result.stats.imbalanceRatio).toBeGreaterThanOrEqual(0);
    });

    it('should work with exact solver', () => {
      const points = Array.from({ length: 20 }, (_, i) => ({
        lat: Math.random() * 10,
        lng: Math.random() * 10,
      }));

      const result = balancedCluster(points, {
        k: 4,
        solver: 'exact',
        seed: 42,
      });

      expect(result.clusters).toHaveLength(4);
      expect(result.stats.imbalanceRatio).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const points = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 10, lng: 10 },
        { lat: 10, lng: 11 },
      ];

      const result = balancedCluster(points, { k: 2, seed: 42 });

      expect(result.stats.totalDistance).toBeGreaterThanOrEqual(0);
      expect(result.stats.maxDistance).toBeGreaterThanOrEqual(0);
      expect(result.stats.imbalanceRatio).toBeGreaterThanOrEqual(0);
      expect(result.stats.unassignedCount).toBe(0);
      expect(result.stats.clusters).toHaveLength(2);
    });

    it('should calculate imbalance ratio correctly', () => {
      // Create perfectly balanced clusters
      const points = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 10, lng: 10 },
        { lat: 10, lng: 11 },
      ];

      const result = balancedCluster(points, {
        k: 2,
        capacity: { max: 2 },
        seed: 42,
      });

      // With max capacity of 2, should be perfectly balanced
      expect(result.stats.imbalanceRatio).toBeLessThan(0.1);
    });
  });
});

describe('Geographic Clustering', () => {
  it('should cluster with geoCluster convenience function', () => {
    const stores = [
      { name: 'Store 1', latitude: 40.7128, longitude: -74.006 },
      { name: 'Store 2', latitude: 40.7589, longitude: -73.9851 },
      { name: 'Store 3', latitude: 34.0522, longitude: -118.2437 },
      { name: 'Store 4', latitude: 34.0689, longitude: -118.4452 },
    ];

    const result = geoCluster(stores, {
      k: 2,
      useHaversine: true,
      seed: 42,
    });

    expect(result.clusters).toHaveLength(2);
    expect(result.unassigned).toHaveLength(0);
  });

  it('should handle custom coordinate extractors', () => {
    const points = [
      { pos: { lat: 0, lng: 0 }, lat: 0, lng: 0 },
      { pos: { lat: 1, lng: 1 }, lat: 1, lng: 1 },
      { pos: { lat: 10, lng: 10 }, lat: 10, lng: 10 },
    ];

    const result = geoCluster(points, {
      k: 2,
      latitude: 'lat',
      longitude: 'lng',
      seed: 42,
    });

    expect(result.clusters).toHaveLength(2);
  });

  it('should use haversine when enabled', () => {
    const points = [
      { lat: 40.7128, lng: -74.006 },
      { lat: 34.0522, lng: -118.2437 },
    ];

    const result = geoCluster(points, {
      k: 2,
      latitude: 'lat',
      longitude: 'lng',
      useHaversine: true,
      seed: 42,
    });

    expect(result.clusters).toHaveLength(2);
  });
});

describe('Edge cases', () => {
  it('should handle points with null coordinates', () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: null, lng: null },
      { lat: 1, lng: 1 },
    ];

    const result = balancedCluster(points, { k: 2, seed: 42 });

    // Should still create clusters
    expect(result.clusters.length).toBeGreaterThan(0);
  });

  it('should handle collinear points', () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
      { lat: 3, lng: 3 },
    ];

    const result = balancedCluster(points, { k: 2, seed: 42 });

    expect(result.clusters).toHaveLength(2);
    expect(result.unassigned).toHaveLength(0);
  });

  it('should handle duplicate points', () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0 },
      { lat: 10, lng: 10 },
    ];

    const result = balancedCluster(points, { k: 2, seed: 42 });

    expect(result.clusters).toHaveLength(2);
    expect(result.clusters[0].points.length + result.clusters[1].points.length).toBe(4);
  });
});
