/**
 * Benchmark suite comparing fast vs exact solvers
 */

import { balancedCluster } from '../src/index';

interface BenchmarkResult {
  name: string;
  solver: 'fast' | 'exact';
  pointCount: number;
  clusterCount: number;
  duration: number;
  imbalanceRatio: number;
  totalDistance: number;
  maxDistance: number;
}

// Generate random points
function generatePoints(count: number): Array<{ lat: number; lng: number }> {
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({
      lat: 25 + Math.random() * 25,
      lng: -125 + Math.random() * 55,
    });
  }
  return points;
}

// Run single benchmark
function runBenchmark(
  name: string,
  points: Array<{ lat: number; lng: number }>,
  k: number,
  solver: 'fast' | 'exact'
): BenchmarkResult {
  const start = performance.now();
  
  const result = balancedCluster(points, {
    k,
    solver,
    seed: 42,
  });
  
  const duration = performance.now() - start;
  
  return {
    name,
    solver,
    pointCount: points.length,
    clusterCount: k,
    duration,
    imbalanceRatio: result.stats.imbalanceRatio,
    totalDistance: result.stats.totalDistance,
    maxDistance: result.stats.maxDistance,
  };
}

// Format duration
function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Print results table
function printResults(results: BenchmarkResult[]) {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         GeoCluster Benchmark Results                        ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════╣');
  console.log('║  Test Name          │ Solver │ Points │ Clusters │ Time    │ Imbalance    ║');
  console.log('╟────────────────────────────────────────────────────────────────────────────╢');
  
  for (const result of results) {
    const name = result.name.padEnd(18);
    const solver = result.solver.padEnd(6);
    const points = result.pointCount.toString().padStart(6);
    const clusters = result.clusterCount.toString().padStart(8);
    const time = formatDuration(result.duration).padStart(7);
    const imbalance = result.imbalanceRatio.toFixed(4).padStart(12);
    
    console.log(`║  ${name} │ ${solver} │ ${points} │ ${clusters} │ ${time} │ ${imbalance} ║`);
  }
  
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
}

// Compare solvers
function compareSolvers(results: BenchmarkResult[]) {
  console.log('Performance Comparison:');
  console.log('─────────────────────────────────────────────────────────────────────────\n');
  
  const grouped = new Map<string, { fast?: BenchmarkResult; exact?: BenchmarkResult }>();
  
  for (const result of results) {
    if (!grouped.has(result.name)) {
      grouped.set(result.name, {});
    }
    grouped.get(result.name)![result.solver] = result;
  }
  
  for (const [name, { fast, exact }] of grouped) {
    if (fast && exact) {
      console.log(`${name}:`);
      console.log(`  Speed:   Fast is ${(exact.duration / fast.duration).toFixed(2)}x faster`);
      console.log(`  Balance: Fast ${fast.imbalanceRatio.toFixed(4)} vs Exact ${exact.imbalanceRatio.toFixed(4)}`);
      console.log(`  Quality: Fast ${fast.totalDistance.toFixed(2)} vs Exact ${exact.totalDistance.toFixed(2)} total distance`);
      console.log('');
    }
  }
}

// Main benchmark suite
async function main() {
  console.log('Starting GeoCluster Benchmarks...\n');
  
  const results: BenchmarkResult[] = [];
  
  // Small dataset (100 points)
  console.log('Running small dataset benchmarks (100 points)...');
  const small = generatePoints(100);
  results.push(runBenchmark('Small - 5 clusters', small, 5, 'fast'));
  results.push(runBenchmark('Small - 5 clusters', small, 5, 'exact'));
  results.push(runBenchmark('Small - 10 clusters', small, 10, 'fast'));
  results.push(runBenchmark('Small - 10 clusters', small, 10, 'exact'));
  
  // Medium dataset (500 points)
  console.log('Running medium dataset benchmarks (500 points)...');
  const medium = generatePoints(500);
  results.push(runBenchmark('Medium - 10 clusters', medium, 10, 'fast'));
  results.push(runBenchmark('Medium - 10 clusters', medium, 10, 'exact'));
  results.push(runBenchmark('Medium - 20 clusters', medium, 20, 'fast'));
  results.push(runBenchmark('Medium - 20 clusters', medium, 20, 'exact'));
  
  // Large dataset (1000 points)
  console.log('Running large dataset benchmarks (1000 points)...');
  const large = generatePoints(1000);
  results.push(runBenchmark('Large - 20 clusters', large, 20, 'fast'));
  results.push(runBenchmark('Large - 20 clusters', large, 20, 'exact'));
  results.push(runBenchmark('Large - 50 clusters', large, 50, 'fast'));
  results.push(runBenchmark('Large - 50 clusters', large, 50, 'exact'));
  
  // Very large dataset (5000 points) - fast only
  console.log('Running very large dataset benchmarks (5000 points)...');
  const veryLarge = generatePoints(5000);
  results.push(runBenchmark('Very Large - 50', veryLarge, 50, 'fast'));
  results.push(runBenchmark('Very Large - 100', veryLarge, 100, 'fast'));
  
  // Print results
  printResults(results);
  compareSolvers(results);
  
  // Test with capacity constraints
  console.log('\nCapacity Constraint Test:');
  console.log('─────────────────────────────────────────────────────────────────────────\n');
  
  const testPoints = generatePoints(200);
  const constrainedStart = performance.now();
  const constrainedResult = balancedCluster(testPoints, {
    k: 10,
    capacity: { min: 15, max: 25 },
    solver: 'fast',
    seed: 42,
  });
  const constrainedDuration = performance.now() - constrainedStart;
  
  console.log(`200 points into 10 clusters with capacity [15, 25]:`);
  console.log(`  Time: ${formatDuration(constrainedDuration)}`);
  console.log(`  Imbalance: ${constrainedResult.stats.imbalanceRatio.toFixed(4)}`);
  console.log(`  Cluster sizes: ${constrainedResult.clusters.map(c => c.points.length).join(', ')}`);
  console.log('');
  
  // Test with weighted points
  console.log('Weighted Points Test:');
  console.log('─────────────────────────────────────────────────────────────────────────\n');
  
  const weightedPoints = generatePoints(150).map((p, i) => ({
    ...p,
    weight: 1 + Math.random() * 5,
  }));
  
  const weightedStart = performance.now();
  const weightedResult = balancedCluster(weightedPoints, {
    k: 8,
    weight: p => p.weight,
    capacity: { max: 150 },
    solver: 'fast',
    seed: 42,
  });
  const weightedDuration = performance.now() - weightedStart;
  
  console.log(`150 points with variable weights into 8 clusters:`);
  console.log(`  Time: ${formatDuration(weightedDuration)}`);
  console.log(`  Imbalance: ${weightedResult.stats.imbalanceRatio.toFixed(4)}`);
  console.log(`  Cluster weights: ${weightedResult.clusters.map(c => c.totalWeight.toFixed(1)).join(', ')}`);
  console.log('');
  
  console.log('✅ All benchmarks completed successfully!\n');
}

// Run benchmarks
main().catch(console.error);
