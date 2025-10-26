import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, Clock, Wrench, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Alerts({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `${API}/alerts`;
      if (filter !== 'all') {
        url += `?acknowledged=${filter === 'acknowledged'}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAlerts(response.data);
    } catch (error) {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/alerts/${alertId}/acknowledge`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ));
      
      toast.success('Alert acknowledged');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to acknowledge alert');
    }
  };

  const getAlertIcon = (type, severity) => {
    const iconProps = { size: 24 };
    
    switch (type) {
      case 'delay':
        return <Clock {...iconProps} />;
      case 'maintenance':
        return <Wrench {...iconProps} />;
      case 'overload':
        return <AlertTriangle {...iconProps} />;
      default:
        return <AlertTriangle {...iconProps} />;
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now - alertTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div data-testid="alerts-loading">
        <div className="page-header">
          <h2>Alerts</h2>
          <p>Loading alerts...</p>
        </div>
      </div>
    );
  }

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div data-testid="alerts-page">
      <div className="page-header">
        <h2>System Alerts</h2>
        <p>Monitor delays, maintenance requirements, and load warnings</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Active Alerts</h3>
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              {unacknowledgedCount} unacknowledged alert{unacknowledgedCount !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="filter-group" style={{ margin: 0, minWidth: '200px' }}>
            <label>Filter</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              data-testid="alert-filter"
            >
              <option value="all">All Alerts</option>
              <option value="unacknowledged">Unacknowledged</option>
              <option value="acknowledged">Acknowledged</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }} data-testid="no-alerts">
            No alerts found.
          </div>
        ) : (
          <div>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-item ${alert.severity}`}
                style={{ opacity: alert.acknowledged ? 0.6 : 1 }}
                data-testid={`alert-${alert.id}`}
              >
                <div className="alert-icon">
                  {getAlertIcon(alert.type, alert.severity)}
                </div>
                
                <div className="alert-content">
                  <div className="alert-type">{alert.type}</div>
                  <div className="alert-message" data-testid={`alert-message-${alert.id}`}>
                    {alert.message}
                  </div>
                  <div className="alert-time">{getTimeAgo(alert.created_at)}</div>
                </div>

                {!alert.acknowledged && user.role === 'admin' && (
                  <button
                    className="acknowledge-btn"
                    onClick={() => handleAcknowledge(alert.id)}
                    data-testid={`acknowledge-btn-${alert.id}`}
                  >
                    <CheckCircle size={16} style={{ marginRight: '6px', display: 'inline' }} />
                    Acknowledge
                  </button>
                )}

                {alert.acknowledged && (
                  <div style={{ color: '#10b981', fontSize: '14px', fontWeight: '500' }}>
                    <CheckCircle size={16} style={{ marginRight: '6px', display: 'inline' }} />
                    Acknowledged
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Alerts;
