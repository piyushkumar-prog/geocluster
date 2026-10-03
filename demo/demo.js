import { balancedCluster, toGeoJSON, centroidsToGeoJSON, clusterBoundsToGeoJSON } from '../src/index.ts';

// Color palette for clusters
const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B739', '#52B3D9', '#E74C3C', '#3498DB',
  '#9B59B6', '#2ECC71', '#E67E22', '#1ABC9C',
  '#34495E', '#F39C12', '#D35400', '#C0392B',
];

// Initialize map
const map = L.map('map').setView([39.8283, -98.5795], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

// State
let currentData = [];
let currentLayers = [];
let currentCentroidLayers = [];
let currentBoundLayers = [];

// DOM elements
const kSlider = document.getElementById('k-slider');
const kValue = document.getElementById('k-value');
const capacitySlider = document.getElementById('capacity-slider');
const capacityValue = document.getElementById('capacity-value');
const datasetSelect = document.getElementById('dataset-select');
const solverSelect = document.getElementById('solver-select');
const showCentroids = document.getElementById('show-centroids');
const showBounds = document.getElementById('show-bounds');
const reclusterBtn = document.getElementById('recluster-btn');
const regenerateBtn = document.getElementById('regenerate-btn');
const statsDiv = document.getElementById('stats');
const loadingDiv = document.getElementById('loading');

// Event listeners
kSlider.addEventListener('input', (e) => {
  kValue.textContent = e.target.value;
});

kSlider.addEventListener('change', recluster);

capacitySlider.addEventListener('input', (e) => {
  capacityValue.textContent = e.target.value;
});

capacitySlider.addEventListener('change', recluster);

datasetSelect.addEventListener('change', generateData);
solverSelect.addEventListener('change', recluster);
showCentroids.addEventListener('change', recluster);
showBounds.addEventListener('change', recluster);
reclusterBtn.addEventListener('click', recluster);
regenerateBtn.addEventListener('click', generateData);

// Generate random data
function generateData() {
  const dataset = datasetSelect.value;
  
  switch (dataset) {
    case 'random-usa':
      currentData = generateRandomUSA(100);
      map.setView([39.8283, -98.5795], 4);
      break;
    case 'random-world':
      currentData = generateRandomWorld(200);
      map.setView([20, 0], 2);
      break;
    case 'clusters':
      currentData = generateClustered(150);
      map.setView([39.8283, -98.5795], 4);
      break;
    case 'uniform':
      currentData = generateUniformGrid(100);
      map.setView([39.8283, -98.5795], 4);
      break;
  }
  
  recluster();
}

function generateRandomUSA(count) {
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({
      id: i,
      lat: 25 + Math.random() * 25, // USA latitude range
      lng: -125 + Math.random() * 55, // USA longitude range
      name: `Point ${i + 1}`,
    });
  }
  return points;
}

function generateRandomWorld(count) {
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({
      id: i,
      lat: -60 + Math.random() * 120, // World latitude range
      lng: -180 + Math.random() * 360, // World longitude range
      name: `Point ${i + 1}`,
    });
  }
  return points;
}

function generateClustered(count) {
  const points = [];
  const clusterCenters = [
    { lat: 40.7128, lng: -74.006 }, // NYC
    { lat: 34.0522, lng: -118.2437 }, // LA
    { lat: 41.8781, lng: -87.6298 }, // Chicago
    { lat: 29.7604, lng: -95.3698 }, // Houston
    { lat: 33.4484, lng: -112.074 }, // Phoenix
  ];
  
  for (let i = 0; i < count; i++) {
    const center = clusterCenters[i % clusterCenters.length];
    points.push({
      id: i,
      lat: center.lat + (Math.random() - 0.5) * 5,
      lng: center.lng + (Math.random() - 0.5) * 5,
      name: `Point ${i + 1}`,
    });
  }
  return points;
}

function generateUniformGrid(count) {
  const points = [];
  const gridSize = Math.ceil(Math.sqrt(count));
  
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    
    points.push({
      id: i,
      lat: 25 + (row / gridSize) * 25,
      lng: -125 + (col / gridSize) * 55,
      name: `Point ${i + 1}`,
    });
  }
  return points;
}

// Perform clustering
function recluster() {
  if (currentData.length === 0) return;
  
  showLoading(true);
  
  setTimeout(() => {
    try {
      const k = parseInt(kSlider.value);
      const capacity = parseInt(capacitySlider.value);
      const solver = solverSelect.value;
      
      // Run clustering
      const result = balancedCluster(currentData, {
        k,
        capacity: { max: capacity },
        solver,
        seed: 42,
      });
      
      // Update visualization
      visualizeResult(result);
      
      // Update statistics
      updateStats(result);
      
    } catch (error) {
      console.error('Clustering error:', error);
      alert('Error during clustering: ' + error.message);
    } finally {
      showLoading(false);
    }
  }, 50);
}

// Visualize clustering result
function visualizeResult(result) {
  // Clear existing layers
  currentLayers.forEach(layer => map.removeLayer(layer));
  currentCentroidLayers.forEach(layer => map.removeLayer(layer));
  currentBoundLayers.forEach(layer => map.removeLayer(layer));
  currentLayers = [];
  currentCentroidLayers = [];
  currentBoundLayers = [];
  
  // Convert to GeoJSON
  const geojson = toGeoJSON(result);
  
  // Add points
  L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      const clusterIdx = feature.properties.cluster;
      const color = clusterIdx >= 0 ? colors[clusterIdx % colors.length] : '#999999';
      
      const marker = L.circleMarker(latlng, {
        radius: 6,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      });
      
      marker.bindPopup(`
        <strong>${feature.properties.name || 'Point'}</strong><br>
        Cluster: ${clusterIdx >= 0 ? clusterIdx + 1 : 'Unassigned'}<br>
        Cluster Size: ${feature.properties.clusterSize || 0}<br>
        Lat: ${latlng.lat.toFixed(4)}<br>
        Lng: ${latlng.lng.toFixed(4)}
      `);
      
      currentLayers.push(marker);
      return marker;
    },
  }).addTo(map);
  
  // Add centroids if enabled
  if (showCentroids.checked) {
    const centroidsGeoJSON = centroidsToGeoJSON(result);
    
    L.geoJSON(centroidsGeoJSON, {
      pointToLayer: (feature, latlng) => {
        const clusterIdx = feature.properties.cluster;
        const color = colors[clusterIdx % colors.length];
        
        const marker = L.marker(latlng, {
          icon: L.divIcon({
            className: 'centroid-marker',
            html: `<div style="
              width: 24px;
              height: 24px;
              background: ${color};
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 12px;
            ">${clusterIdx + 1}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        });
        
        marker.bindPopup(`
          <strong>Cluster ${clusterIdx + 1} Centroid</strong><br>
          Size: ${feature.properties.size}<br>
          Total Weight: ${feature.properties.totalWeight.toFixed(2)}
        `);
        
        currentCentroidLayers.push(marker);
        return marker;
      },
    }).addTo(map);
  }
  
  // Add bounds if enabled
  if (showBounds.checked) {
    const boundsGeoJSON = clusterBoundsToGeoJSON(result);
    
    L.geoJSON(boundsGeoJSON, {
      style: (feature) => {
        const clusterIdx = feature.properties.cluster;
        const color = colors[clusterIdx % colors.length];
        
        return {
          color: color,
          weight: 2,
          opacity: 0.6,
          fillColor: color,
          fillOpacity: 0.1,
        };
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`
          <strong>Cluster ${feature.properties.cluster + 1} Bounds</strong><br>
          Size: ${feature.properties.size}<br>
          Total Weight: ${feature.properties.totalWeight.toFixed(2)}
        `);
        currentBoundLayers.push(layer);
      },
    }).addTo(map);
  }
}

// Update statistics display
function updateStats(result) {
  const totalPoints = result.clusters.reduce((sum, c) => sum + c.points.length, 0);
  const avgDist = result.stats.totalDistance / (totalPoints || 1);
  
  const rows = statsDiv.querySelectorAll('.stats-row');
  rows[0].querySelector('.stats-value').textContent = totalPoints;
  rows[1].querySelector('.stats-value').textContent = result.clusters.length;
  rows[2].querySelector('.stats-value').textContent = result.stats.imbalanceRatio.toFixed(3);
  rows[3].querySelector('.stats-value').textContent = avgDist.toFixed(2);
  rows[4].querySelector('.stats-value').textContent = result.stats.maxDistance.toFixed(2);
}

// Show/hide loading indicator
function showLoading(show) {
  if (show) {
    loadingDiv.classList.remove('hidden');
  } else {
    loadingDiv.classList.add('hidden');
  }
}

// Initialize
generateData();
