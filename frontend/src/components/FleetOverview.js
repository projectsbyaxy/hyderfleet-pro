import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Truck, AlertTriangle, Wrench, Navigation } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function FleetOverview() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    idle: 0,
    enRoute: 0,
    maintenance: 0
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setVehicles(response.data);
      
      const idle = response.data.filter(v => v.status === 'idle').length;
      const enRoute = response.data.filter(v => v.status === 'en-route').length;
      const maintenance = response.data.filter(v => v.status === 'maintenance').length;
      
      setStats({ idle, enRoute, maintenance });
    } catch (error) {
      toast.error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'idle':
        return <Truck size={20} color="#10b981" />;
      case 'en-route':
        return <Navigation size={20} color="#3b82f6" />;
      case 'maintenance':
        return <Wrench size={20} color="#f59e0b" />;
      default:
        return <AlertTriangle size={20} />;
    }
  };

  if (loading) {
    return (
      <div data-testid="fleet-loading">
        <div className="page-header">
          <h2>Fleet Overview</h2>
          <p>Loading vehicles...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="fleet-overview">
      <div className="page-header">
        <h2>Fleet Overview</h2>
        <p>Monitor and manage your vehicle fleet across Hyderabad</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card idle" data-testid="stat-idle">
          <div className="stat-label">Idle Vehicles</div>
          <div className="stat-value">{stats.idle}</div>
        </div>
        <div className="stat-card en-route" data-testid="stat-en-route">
          <div className="stat-label">En-Route</div>
          <div className="stat-value">{stats.enRoute}</div>
        </div>
        <div className="stat-card maintenance" data-testid="stat-maintenance">
          <div className="stat-label">Under Maintenance</div>
          <div className="stat-value">{stats.maintenance}</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>All Vehicles</h3>
        <div className="table-container">
          <table data-testid="vehicles-table">
            <thead>
              <tr>
                <th>Plate Number</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Vehicle Type</th>
                <th>Load Capacity</th>
                <th>Current Load</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} data-testid={`vehicle-row-${vehicle.id}`}>
                  <td>
                    <strong>{vehicle.plate_number}</strong>
                  </td>
                  <td>{vehicle.driver_name || 'Unassigned'}</td>
                  <td>
                    <span className={`status-badge ${vehicle.status}`} data-testid={`vehicle-status-${vehicle.id}`}>
                      {getStatusIcon(vehicle.status)}
                      <span style={{ marginLeft: '6px' }}>{vehicle.status}</span>
                    </span>
                  </td>
                  <td>{vehicle.vehicle_type}</td>
                  <td>{vehicle.load_capacity} kg</td>
                  <td>{vehicle.current_load.toFixed(2)} kg</td>
                  <td>{new Date(vehicle.last_updated).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FleetOverview;
