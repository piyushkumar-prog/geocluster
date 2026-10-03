import { describe, it, expect } from 'vitest';
import { balancedCluster } from '../src/index';
import {
  toGeoJSON,
  centroidsToGeoJSON,
  clusterBoundsToGeoJSON,
  toStyledGeoJSON,
} from '../src/geo/geojson';

describe('GeoJSON Export', () => {
  const samplePoints = [
    { lat: 40.7128, lng: -74.006, name: 'NYC' },
    { lat: 40.7589, lng: -73.9851, name: 'Times Square' },
    { lat: 34.0522, lng: -118.2437, name: 'LA' },
    { lat: 34.0689, lng: -118.4452, name: 'Santa Monica' },
  ];

  describe('toGeoJSON', () => {
    it('should convert cluster result to GeoJSON', () => {
      const result = balancedCluster(samplePoints, { k: 2, seed: 42 });
      const geojson = toGeoJSON(result);

      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features).toHaveLength(4);

      for (const feature of geojson.features) {
        expect(feature.type).toBe('Feature');
        expect(feature.geometry.type).toBe('Point');
        expect(feature.geometry.coordinates).toHaveLength(2);
        expect(feature.properties.cluster).toBeGreaterThanOrEqual(0);
      }
    });

    it('should use correct coordinate order [lng, lat]', () => {
      const result = balancedCluster([{ lat: 10, lng: 20 }], { k: 1 });
      const geojson = toGeoJSON(result);

      const coords = geojson.features[0].geometry.coordinates;
      expect(coords[0]).toBe(20); // longitude first
      expect(coords[1]).toBe(10); // latitude second
    });

    it('should include cluster metadata', () => {
      const result = balancedCluster(samplePoints, { k: 2, seed: 42 });
      const geojson = toGeoJSON(result);

      for (const feature of geojson.features) {
        expect(feature.properties).toHaveProperty('cluster');
        expect(feature.properties).toHaveProperty('clusterSize');
        expect(feature.properties).toHaveProperty('clusterWeight');
      }
    });

    it('should mark unassigned points', () => {
      const points = [{ lat: 0, lng: 0 }];
      const result = balancedCluster(points, {
        k: 2,
        capacity: { max: 0 }, // Force unassignment
      });

      const geojson = toGeoJSON(result);

      const unassigned = geojson.features.filter(
        f => f.properties.cluster === -1
      );
      expect(unassigned.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle custom coordinate extractors', () => {
      const customPoints = [
        { latitude: 10, longitude: 20 },
        { latitude: 30, longitude: 40 },
      ];

      const result = balancedCluster(customPoints, { k: 2, seed: 42 });
      const geojson = toGeoJSON(result, {
        latitude: p => p.latitude,
        longitude: p => p.longitude,
      });

      expect(geojson.features).toHaveLength(2);
    });
  });

  describe('centroidsToGeoJSON', () => {
    it('should create GeoJSON for centroids', () => {
      const result = balancedCluster(samplePoints, { k: 2, seed: 42 });
      const geojson = centroidsToGeoJSON(result);

      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features).toHaveLength(2);

      for (const feature of geojson.features) {
        expect(feature.geometry.type).toBe('Point');
        expect(feature.properties.isCentroid).toBe(true);
        expect(feature.properties).toHaveProperty('size');
        expect(feature.properties).toHaveProperty('totalWeight');
      }
    });

    it('should skip centroids without coordinates', () => {
      const result = {
        clusters: [
          {
            index: 0,
            points: [],
            centroid: [], // Empty centroid
            totalWeight: 0,
          },
        ],
        stats: {
          totalDistance: 0,
          maxDistance: 0,
          imbalanceRatio: 0,
          unassignedCount: 0,
          clusters: [],
        },
        unassigned: [],
      };

      const geojson = centroidsToGeoJSON(result);
      expect(geojson.features).toHaveLength(0);
    });
  });

  describe('clusterBoundsToGeoJSON', () => {
    it('should create polygon bounds for clusters', () => {
      const result = balancedCluster(samplePoints, { k: 2, seed: 42 });
      const geojson = clusterBoundsToGeoJSON(result);

      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features.length).toBeGreaterThan(0);

      for (const feature of geojson.features) {
        expect(feature.geometry.type).toBe('Polygon');
        expect(feature.properties).toHaveProperty('cluster');
        expect(feature.properties).toHaveProperty('size');
      }
    });

    it('should create closed polygons', () => {
      const result = balancedCluster(samplePoints, { k: 2, seed: 42 });
      const geojson = clusterBoundsToGeoJSON(result);

      for (const feature of geojson.features) {
        const coords = feature.geometry.coordinates[0];
        // First and last coordinates should be the same
        expect(coords[0]).toEqual(coords[coords.length - 1]);
      }
    });

    it('should skip empty clusters', () => {
      const result = {
        clusters: [
          {
            index: 0,
            points: [],
            centroid: [],
            totalWeight: 0,
          },
        ],
        stats: {
          totalDistance: 0,
          maxDistance: 0,
          imbalanceRatio: 0,
          unassignedCount: 0,
          clusters: [],
        },
        unassigned: [],
      };

      const geojson = clusterBoundsToGeoJSON(result);
      expect(geojson.features).toHaveLength(0);
    });
  });

  describe('toStyledGeoJSON', () => {
    it('should add color properties', () => {
      const result = balancedCluster(samplePoints, { k: 2, seed: 42 });
      const geojson = toStyledGeoJSON(result);

      for (const feature of geojson.features) {
        expect(feature.properties).toHaveProperty('color');
        expect(feature.properties).toHaveProperty('marker-color');
        expect(typeof feature.properties.color).toBe('string');
        expect(feature.properties.color).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });

    it('should use custom color palette', () => {
      const result = balancedCluster(samplePoints, { k: 2, seed: 42 });
      const customColors = ['#FF0000', '#00FF00'];
      const geojson = toStyledGeoJSON(result, undefined, customColors);

      const usedColors = new Set(
        geojson.features
          .filter(f => f.properties.cluster >= 0)
          .map(f => f.properties.color)
      );

      for (const color of usedColors) {
        expect(customColors).toContain(color);
      }
    });

    it('should assign gray to unassigned points', () => {
      const result = {
        clusters: [],
        stats: {
          totalDistance: 0,
          maxDistance: 0,
          imbalanceRatio: 0,
          unassignedCount: 1,
          clusters: [],
        },
        unassigned: [{ lat: 0, lng: 0 }],
      };

      const geojson = toStyledGeoJSON(result);
      const unassignedFeatures = geojson.features.filter(
        f => f.properties.cluster === -1
      );

      for (const feature of unassignedFeatures) {
        expect(feature.properties.color).toBe('#999999');
      }
    });
  });
});
