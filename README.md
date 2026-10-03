# GeoCluster

**High-performance capacity-constrained spatial clustering for JavaScript/TypeScript**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Live Demo](https://img.shields.io/badge/Demo-Interactive%20Map-brightgreen?logo=leaflet)](https://piyushkumar-prog.github.io/geocluster/)

👉 **[Try the Interactive Live Demo](https://piyushkumar-prog.github.io/geocluster/)** — test different datasets, adjust cluster counts and capacities, and visualize balanced clustering live on Leaflet maps!

GeoCluster solves the problem that standard k-means clustering ignores: **you need balanced clusters with controlled sizes**. While normal clustering gives you one massive cluster and several tiny ones, GeoCluster ensures every cluster respects your capacity constraints while minimizing total distance.

## 🎯 The Problem

Standard spatial clustering libraries only minimize geometric distance. They produce wildly unbalanced results:

- **Cluster 1:** 4,000 points
- **Cluster 2:** 8 points  
- **Cluster 3:** 2,500 points

When you're dividing work among delivery drivers, field technicians, or sales reps, this is useless. You need **balanced workloads** that respect real-world constraints.

## ✨ The Solution

```typescript
import { balancedCluster } from 'geocluster-js';

const result = balancedCluster(deliveryStops, {
  k: 8,                              // 8 drivers
  capacity: { min: 50, max: 65 },    // 50-65 stops per driver
  weight: stop => stop.serviceMinutes,
  distance: distances.haversine,
  solver: 'fast',
  seed: 42,
});

// Every cluster has 50-65 stops
// Total distance is minimized
// Ready to export as GeoJSON for maps
```

## 🚀 Key Features

- **⚡ Fast:** Clusters 10,000 points in ~3 seconds
- **⚖️ Balanced:** Enforces min/max capacity constraints
- **🔧 Flexible:** Pluggable distance functions (Haversine, Euclidean, road network via OSRM)
- **📊 Weighted:** Handle service time, package weight, or any custom metric
- **🎨 Ready for maps:** Built-in GeoJSON export for Mapbox/Leaflet
- **🔒 Deterministic:** Seeded RNG for reproducible results
- **📦 Zero dependencies:** Pure TypeScript, runs in Node and browsers
- **🧪 Well tested:** Comprehensive test suite with 95%+ coverage

## 📦 Installation

```bash
npm install geocluster-js
```

## 🎓 Quick Start

### Basic Geographic Clustering

```typescript
import { geoCluster, toGeoJSON } from 'geocluster-js';

const stores = [
  { name: 'Store 1', lat: 40.7128, lng: -74.006 },
  { name: 'Store 2', lat: 40.7589, lng: -73.9851 },
  // ... more stores
];

const result = geoCluster(stores, {
  k: 5,                    // Create 5 territories
  latitude: 'lat',         // Field name for latitude
  longitude: 'lng',        // Field name for longitude
  useHaversine: true,      // Use geographic distance
  capacity: { max: 50 },   // Max 50 stores per territory
});

console.log(result.clusters.length);              // 5
console.log(result.clusters[0].points.length);    // ~10 stores
console.log(result.stats.imbalanceRatio);         // 0.05 (very balanced)

// Export for mapping
const geojson = toGeoJSON(result);
// Use with Mapbox, Leaflet, etc.
```

### Advanced: Custom Weights and Constraints

```typescript
import { balancedCluster, distances } from 'geocluster-js';

const deliveries = [
  { lat: 40.7, lng: -74.0, serviceMinutes: 15, coldChain: true },
  { lat: 40.8, lng: -74.1, serviceMinutes: 30, coldChain: false },
  // ...
];

const result = balancedCluster(deliveries, {
  k: 10,
  
  // Weight by service time (not just count)
  weight: delivery => delivery.serviceMinutes,
  
  // Each route: 180-240 minutes of service time
  capacity: { min: 180, max: 240 },
  
  // Use real distance calculation
  distance: distances.haversine,
  
  // Eligibility constraints (optional)
  eligibility: {
    points: d => d.coldChain ? ['cold-chain'] : [],
    clusters: idx => idx < 3 ? ['cold-chain'] : [],
  },
  
  solver: 'fast',
  seed: 42,
});

// Routes are balanced by service time
result.clusters.forEach((cluster, i) => {
  console.log(`Route ${i + 1}: ${cluster.totalWeight} minutes`);
});
```

### Using Precomputed Distance Matrix (Road Network)

```typescript
import { balancedCluster, distances } from 'geocluster-js';

// Get driving times from OSRM, Valhalla, or Google Maps
const drivingTimes = [
  [0, 10, 25, 30],      // From point 0 to all others (minutes)
  [10, 0, 15, 20],      // From point 1 to all others
  [25, 15, 0, 12],      // From point 2 to all others
  [30, 20, 12, 0],      // From point 3 to all others
];

const result = balancedCluster(points, {
  k: 2,
  distance: distances.fromMatrix(drivingTimes),
  useMatrix: true,
});

// Clusters minimize actual driving time, not crow-flies distance
```

### Sticky/Incremental Clustering

```typescript
import { balancedCluster, extractAssignments } from 'geocluster-js';

// Initial clustering
const result1 = balancedCluster(points, { k: 5, seed: 42 });
const previousAssignments = extractAssignments(result1, points);

// Add new points but keep existing assignments mostly stable
const newPoints = [...points, ...additionalPoints];
const result2 = balancedCluster(newPoints, {
  k: 5,
  previous: { assignments: previousAssignments },
  seed: 42,
});

// Most original points stay in their clusters
```

## 🎨 Visualization

### Live Demo

Check out the **[interactive demo](demo/index.html)** with real-time clustering on a map.

### Export to GeoJSON

```typescript
import { toGeoJSON, centroidsToGeoJSON, toStyledGeoJSON } from 'geocluster-js';

const result = geoCluster(stores, { k: 5 });

// Points with cluster assignments
const pointsGeoJSON = toGeoJSON(result);

// Cluster centroids (for map markers)
const centroidsGeoJSON = centroidsToGeoJSON(result);

// Pre-styled with colors (ready for Mapbox/Leaflet)
const styledGeoJSON = toStyledGeoJSON(result);
```

## 📊 Real-World Use Cases

### Last-Mile Delivery
Split daily orders into balanced routes for your drivers.

```typescript
const orders = await getOrdersForToday();
const routes = balancedCluster(orders, {
  k: driverCount,
  weight: order => order.packageCount,
  capacity: { max: 50 }, // Max 50 packages per route
  distance: distances.haversine,
});
```

### Field Service Territory Management
Assign service locations to technicians with balanced workloads.

```typescript
const serviceLocations = await getClientLocations();
const territories = geoCluster(serviceLocations, {
  k: technicianCount,
  weight: loc => loc.monthlyVisits,
  capacity: { min: 40, max: 60 },
  useHaversine: true,
});
```

### Sales Territory Planning
Create balanced sales territories by account value.

```typescript
const accounts = await getAccounts();
const territories = balancedCluster(accounts, {
  k: repCount,
  weight: account => account.annualRevenue,
  capacity: { min: 1000000, max: 1500000 }, // $1M-$1.5M per rep
});
```

### Warehouse Zone Optimization
Divide pick locations into balanced zones for warehouse workers.

```typescript
const pickLocations = await getWarehouseLocations();
const zones = balancedCluster(pickLocations, {
  k: workerCount,
  weight: loc => loc.dailyPicks,
  capacity: { max: 150 },
});
```

## ⚡ Performance

Benchmarks on Apple M1 MacBook:

| Dataset | Clusters | Fast Solver | Exact Solver | Speedup |
|---------|----------|-------------|--------------|---------|
| 100 points | 5 | 2.5ms | 8.3ms | 3.3x |
| 500 points | 10 | 12.1ms | 45.2ms | 3.7x |
| 1,000 points | 20 | 28.4ms | 124.8ms | 4.4x |
| 5,000 points | 50 | 287.3ms | N/A | - |
| 10,000 points | 100 | 1,243ms | N/A | - |

**Balance Quality:**
- Fast solver: ~0.05-0.15 imbalance ratio
- Exact solver: ~0.02-0.08 imbalance ratio

The fast (greedy) solver is recommended for most use cases. Use the exact solver for small datasets (<500 points) where you need optimal balance.

## 🔧 API Reference

### `balancedCluster<T>(points: T[], options: ClusterOptions<T>)`

Main clustering function with full control.

**Options:**
- `k: number` - Number of clusters
- `distance?: DistanceFunction` - Distance function (default: Euclidean)
- `weight?: WeightFunction` - Weight function (default: constant 1)
- `capacity?: CapacityConstraint` - Min/max capacity per cluster
- `eligibility?: EligibilityConstraint` - Point/cluster tag matching
- `previous?: PreviousAssignment` - Previous assignment for stability
- `solver?: 'fast' | 'exact'` - Solver mode (default: 'fast')
- `seed?: number` - Random seed for determinism
- `maxIterations?: number` - K-means iterations (default: 30)

**Returns:** `ClusterResult<T>` with clusters, statistics, and unassigned points.

### `geoCluster<T>(points: T[], options: GeoClusterOptions<T>)`

Convenience function for geographic clustering.

**Additional Options:**
- `latitude?: string | Function` - Latitude field or extractor
- `longitude?: string | Function` - Longitude field or extractor
- `useHaversine?: boolean` - Use Haversine distance (default: false)

### Distance Functions

```typescript
import { distances } from 'geocluster-js';

distances.euclidean          // 2D Euclidean
distances.haversine          // Geographic (km)
distances.euclideanND        // N-dimensional
distances.manhattan          // Manhattan/L1
distances.fromMatrix(matrix) // Precomputed cost matrix
```

### GeoJSON Exports

```typescript
toGeoJSON(result)              // Points with cluster assignments
centroidsToGeoJSON(result)     // Cluster centroids
clusterBoundsToGeoJSON(result) // Bounding box polygons
toStyledGeoJSON(result)        // Pre-styled with colors
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test -- --coverage

# Run benchmarks
npm run benchmark
```

## 🎮 Demo

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Start demo server
npm run demo
```

Open http://localhost:5173 to see the interactive map demo.

## 🏗️ Architecture

GeoCluster uses a two-phase approach:

1. **K-means++ initialization**: Spreads initial centroids optimally
2. **Capacity-constrained assignment**: Greedy or exact solver respects constraints

The fast solver uses a greedy O(n log n) algorithm. The exact solver uses minimum cost flow with local optimization for better balance at the cost of speed.

## 🤝 Contributing

Contributions are welcome! Potential areas for enhancement:

- [ ] Performance: Compile core algorithms to WASM
- [ ] Features: Contiguity constraints for geographic continuity
- [ ] Features: Better support for real-time incremental updates
- [ ] Algorithms: Multi-objective optimization (balance multiple criteria)
- [ ] Testing: Additional edge case coverage and fuzzing

Please open an issue to discuss major changes before submitting a PR.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 👥 Authors

**GeoCluster** is created and maintained by:

- **[Piyush Kumar](https://github.com/piyushkumar-prog)** - Co-Author & Maintainer
- **Shivanghi Sharma** - Co-Author

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for contribution guidelines.

---

**Made with ❤️ for developers building location-based applications**

[Report Bug](https://github.com/piyushkumar-prog/geocluster/issues) · [Request Feature](https://github.com/piyushkumar-prog/geocluster/issues)
