import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different vehicle statuses
const createCustomIcon = (status) => {
  const colors = {
    'idle': '#10b981',
    'en-route': '#3b82f6',
    'maintenance': '#f59e0b'
  };
  
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${colors[status] || '#64748b'}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

function MapView() {
  const [vehicles, setVehicles] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchData();
    
    // Setup WebSocket connection
    const wsUrl = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const newSocket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
    });

    newSocket.on('message', (data) => {
      if (data.type === 'vehicle_update') {
        setVehicles(prev => {
          const updated = [...prev];
          const index = updated.findIndex(v => v.id === data.data.id);
          if (index !== -1) {
            updated[index] = data.data;
          }
          return updated;
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [vehiclesRes, zonesRes] = await Promise.all([
        axios.get(`${API}/vehicles`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/zones`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setVehicles(vehiclesRes.data);
      setZones(zonesRes.data);
    } catch (error) {
      toast.error('Failed to load map data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div data-testid="map-loading">
        <div className="page-header">
          <h2>Live Map View</h2>
          <p>Loading map...</p>
        </div>
      </div>
    );
  }

  const hyderabadCenter = [17.385, 78.4867];

  return (
    <div data-testid="map-view">
      <div className="page-header">
        <h2>Live Map View</h2>
        <p>Real-time vehicle tracking across Hyderabad industrial zones</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#10b981' }}></div>
            <span style={{ fontSize: '14px' }}>Idle</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#3b82f6' }}></div>
            <span style={{ fontSize: '14px' }}>En-Route</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#f59e0b' }}></div>
            <span style={{ fontSize: '14px' }}>Maintenance</span>
          </div>
        </div>

        <div className="map-container" data-testid="map-container">
          <MapContainer
            center={hyderabadCenter}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Zone circles */}
            {zones.map((zone) => (
              <Circle
                key={zone.id}
                center={[zone.coordinates.lat, zone.coordinates.lng]}
                radius={5000}
                pathOptions={{
                  color: zone.delay_count > 10 ? '#ef4444' : '#3b82f6',
                  fillColor: zone.delay_count > 10 ? '#fecaca' : '#dbeafe',
                  fillOpacity: 0.2
                }}
              >
                <Popup>
                  <div>
                    <strong>{zone.name}</strong><br />
                    Delays: {zone.delay_count}
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* Vehicle markers */}
            {vehicles.map((vehicle) => (
              <Marker
                key={vehicle.id}
                position={[vehicle.location.lat, vehicle.location.lng]}
                icon={createCustomIcon(vehicle.status)}
              >
                <Popup>
                  <div data-testid={`vehicle-popup-${vehicle.id}`}>
                    <strong>{vehicle.plate_number}</strong><br />
                    Driver: {vehicle.driver_name || 'Unassigned'}<br />
                    Status: <span className={`status-badge ${vehicle.status}`}>{vehicle.status}</span><br />
                    Type: {vehicle.vehicle_type}<br />
                    Load: {vehicle.current_load.toFixed(2)} / {vehicle.load_capacity} kg
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default MapView;
