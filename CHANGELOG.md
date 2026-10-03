# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-04

### Added
- Initial release of GeoCluster by Piyush Kumar and Shivanghi Sharma
- Balanced k-means clustering with capacity constraints
- Pluggable distance functions (Haversine, Euclidean, N-dimensional, matrix-based)
- Weighted points support
- Eligibility constraints (tag-based filtering)
- Two solver modes: fast (greedy) and exact (min-cost-flow)
- Sticky/incremental clustering support
- Deterministic results with seeded RNG
- GeoJSON export utilities
- Comprehensive statistics (imbalance ratio, distances, etc.)
- TypeScript support with full type definitions
- Zero dependencies
- 44 unit tests with 100% pass rate
- Interactive web demo
- Benchmarking suite
- Complete documentation and examples
