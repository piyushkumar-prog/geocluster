/**
 * GeoJSON export utilities for map visualization
 */

import type { ClusterResult, ClusterPoint, CoordinateExtractor } from '../types';

/**
 * GeoJSON Feature
 */
export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: Record<string, any>;
}

/**
 * GeoJSON FeatureCollection
 */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Convert cluster result to GeoJSON FeatureCollection
 * 
 * @param result - Clustering result
 * @param coordinateExtractor - How to extract lat/lng from points
 * @returns GeoJSON FeatureCollection ready for Mapbox/Leaflet
 */
export function toGeoJSON<T extends ClusterPoint>(
  result: ClusterResult<T>,
  coordinateExtractor?: CoordinateExtractor<T>
): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = [];

  // Default coordinate extractors
  const getLat = coordinateExtractor?.latitude || defaultLatExtractor;
  const getLng = coordinateExtractor?.longitude || defaultLngExtractor;

  // Add all clustered points
  for (const cluster of result.clusters) {
    for (const point of cluster.points) {
      const lat = getLat(point);
      const lng = getLng(point);

      if (lat != null && lng != null) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat], // GeoJSON uses [lng, lat] order
          },
          properties: {
            ...point,
            cluster: cluster.index,
            clusterSize: cluster.points.length,
            clusterWeight: cluster.totalWeight,
          },
        });
      }
    }
  }

  // Add unassigned points
  for (const point of result.unassigned) {
    const lat = getLat(point);
    const lng = getLng(point);

    if (lat != null && lng != null) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          ...point,
          cluster: -1,
          unassigned: true,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Create GeoJSON with cluster centroids
 * Useful for visualizing cluster centers on a map
 */
export function centroidsToGeoJSON<T extends ClusterPoint>(
  result: ClusterResult<T>
): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = [];

  for (const cluster of result.clusters) {
    if (cluster.centroid.length >= 2) {
      const [lat, lng] = cluster.centroid;
      
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          cluster: cluster.index,
          size: cluster.points.length,
          totalWeight: cluster.totalWeight,
          isCentroid: true,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Create GeoJSON with cluster hulls (bounding boxes)
 * Useful for visualizing cluster boundaries
 */
export function clusterBoundsToGeoJSON<T extends ClusterPoint>(
  result: ClusterResult<T>,
  coordinateExtractor?: CoordinateExtractor<T>
): GeoJSONFeatureCollection {
  const features: any[] = [];

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
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat], // Close the polygon
            ],
          ],
        },
        properties: {
          cluster: cluster.index,
          size: cluster.points.length,
          totalWeight: cluster.totalWeight,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Default latitude extractor - tries common field names
 */
function defaultLatExtractor<T extends ClusterPoint>(
  point: T
): number | null | undefined {
  if ('lat' in point) return point.lat as number;
  if ('latitude' in point) return point.latitude as number;
  if ('y' in point) return point.y as number;
  if ('coordinates' in point && Array.isArray(point.coordinates)) {
    return point.coordinates[0];
  }
  return null;
}

/**
 * Default longitude extractor - tries common field names
 */
function defaultLngExtractor<T extends ClusterPoint>(
  point: T
): number | null | undefined {
  if ('lng' in point) return point.lng as number;
  if ('lon' in point) return point.lon as number;
  if ('longitude' in point) return point.longitude as number;
  if ('x' in point) return point.x as number;
  if ('coordinates' in point && Array.isArray(point.coordinates)) {
    return point.coordinates[1];
  }
  return null;
}

/**
 * Export cluster result to styled GeoJSON for immediate use in mapping libraries
 * Includes color properties for each cluster
 */
export function toStyledGeoJSON<T extends ClusterPoint>(
  result: ClusterResult<T>,
  coordinateExtractor?: CoordinateExtractor<T>,
  colorPalette?: string[]
): GeoJSONFeatureCollection {
  const defaultColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B3D9', '#E74C3C', '#3498DB',
  ];

  const colors = colorPalette || defaultColors;
  const geojson = toGeoJSON(result, coordinateExtractor);

  // Add color to each feature
  for (const feature of geojson.features) {
    const clusterIdx = feature.properties.cluster;
    if (clusterIdx >= 0) {
      feature.properties.color = colors[clusterIdx % colors.length];
      feature.properties['marker-color'] = colors[clusterIdx % colors.length];
    } else {
      feature.properties.color = '#999999';
      feature.properties['marker-color'] = '#999999';
    }
  }

  return geojson;
}
