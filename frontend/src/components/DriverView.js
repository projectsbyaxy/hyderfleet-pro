import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, Navigation, CheckCircle, MapPin, LogOut } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function DriverView({ user, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDriverJobs();
  }, []);

  const fetchDriverJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      // In a real app, filter by driver ID
      const response = await axios.get(`${API}/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Show only pending and in-transit jobs for driver view
      const driverJobs = response.data.filter(
        job => job.status === 'pending' || job.status === 'in-transit'
      );
      setJobs(driverJobs);
    } catch (error) {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const openNavigation = (location) => {
    const { lat, lng } = location;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '20px' }} data-testid="driver-view">
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', marginBottom: '8px', fontWeight: '700' }}>Driver Dashboard</h1>
          <p style={{ fontSize: '16px', opacity: 0.9 }}>Welcome, {user.username}!</p>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: '12px 24px',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            color: 'white',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          data-testid="driver-logout-button"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>

      {/* Jobs List */}
      <div>
        <h2 style={{ fontSize: '24px', marginBottom: '20px', fontWeight: '600', color: '#1a2332' }}>
          Your Jobs ({jobs.length})
        </h2>

        {jobs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }} data-testid="no-driver-jobs">
            <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>All Caught Up!</h3>
            <p style={{ color: '#64748b' }}>No pending jobs at the moment.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="card"
                style={{
                  borderLeft: `4px solid ${job.status === 'pending' ? '#8b5cf6' : '#06b6d4'}`,
                  transition: 'transform 0.2s',
                  cursor: 'pointer'
                }}
                data-testid={`driver-job-${job.id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>
                      Job #{job.job_number}
                    </h3>
                    <span className={`status-badge ${job.status}`}>
                      {job.status === 'pending' ? <Package size={14} /> : <Navigation size={14} />}
                      <span style={{ marginLeft: '6px' }}>{job.status}</span>
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Zone</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a2332' }}>{job.zone}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      <MapPin size={14} style={{ display: 'inline', marginRight: '6px' }} />
                      PICKUP
                    </div>
                    <div style={{ fontSize: '15px', color: '#1a2332' }}>{job.pickup_location.address}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      <MapPin size={14} style={{ display: 'inline', marginRight: '6px' }} />
                      DELIVERY
                    </div>
                    <div style={{ fontSize: '15px', color: '#1a2332' }}>{job.delivery_location.address}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Load Type</div>
                    <div style={{ fontSize: '15px', fontWeight: '600' }}>{job.load_type}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Weight</div>
                    <div style={{ fontSize: '15px', fontWeight: '600' }}>{job.load_weight} kg</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>ETA</div>
                    <div style={{ fontSize: '15px', fontWeight: '600' }}>
                      {new Date(job.estimated_eta).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => openNavigation(job.pickup_location)}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '12px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    data-testid={`navigate-pickup-${job.id}`}
                  >
                    <Navigation size={16} />
                    Navigate to Pickup
                  </button>
                  <button
                    onClick={() => openNavigation(job.delivery_location)}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '12px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    data-testid={`navigate-delivery-${job.id}`}
                  >
                    <Navigation size={16} />
                    Navigate to Delivery
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverView;
