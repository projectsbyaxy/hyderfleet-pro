import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, CheckCircle, MapPin } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Analytics() {
  const [loading, setLoading] = useState(true);
  const [dailyDeliveries, setDailyDeliveries] = useState([]);
  const [onTimePercentage, setOnTimePercentage] = useState(null);
  const [zoneDelays, setZoneDelays] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const [dailyRes, onTimeRes, zonesRes] = await Promise.all([
        axios.get(`${API}/analytics/daily-deliveries`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/analytics/on-time-percentage`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/analytics/zone-delays`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      // Transform daily deliveries data
      const dailyData = Object.entries(dailyRes.data.daily_deliveries).map(([date, count]) => ({
        date,
        deliveries: count
      })).sort((a, b) => new Date(a.date) - new Date(b.date));

      setDailyDeliveries(dailyData);
      setOnTimePercentage(onTimeRes.data);
      setZoneDelays(zonesRes.data.zones);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div data-testid="analytics-loading">
        <div className="page-header">
          <h2>Analytics</h2>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const zoneDelayData = zoneDelays.map(zone => ({
    name: zone.name,
    delays: zone.delay_count
  }));

  return (
    <div data-testid="analytics-page">
      <div className="page-header">
        <h2>Analytics & Reports</h2>
        <p>Performance metrics and delivery insights</p>
      </div>

      {/* Key Metrics */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderColor: '#3b82f6' }}>
          <div className="stat-label">
            <TrendingUp size={20} style={{ display: 'inline', marginRight: '8px' }} />
            On-Time Delivery Rate
          </div>
          <div className="stat-value" data-testid="on-time-percentage">
            {onTimePercentage?.on_time_percentage || 0}%
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
            {onTimePercentage?.on_time_jobs || 0} of {onTimePercentage?.total_jobs || 0} deliveries
          </p>
        </div>

        <div className="stat-card" style={{ borderColor: '#10b981' }}>
          <div className="stat-label">
            <Package size={20} style={{ display: 'inline', marginRight: '8px' }} />
            Total Deliveries (7 days)
          </div>
          <div className="stat-value" data-testid="total-deliveries">
            {dailyDeliveries.reduce((sum, day) => sum + day.deliveries, 0)}
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: '#f59e0b' }}>
          <div className="stat-label">
            <MapPin size={20} style={{ display: 'inline', marginRight: '8px' }} />
            Active Zones
          </div>
          <div className="stat-value">{zoneDelays.length}</div>
        </div>
      </div>

      {/* Daily Deliveries Chart */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>
          Daily Delivery Count (Last 7 Days)
        </h3>
        <div className="chart-container" data-testid="daily-deliveries-chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyDeliveries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                stroke="#64748b"
              />
              <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px'
                }}
              />
              <Legend />
              <Bar dataKey="deliveries" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zone Delays Heatmap */}
      <div className="card">
        <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>
          Zone Delay Heatmap
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          {zoneDelays.map((zone, index) => (
            <div
              key={zone.id}
              style={{
                padding: '20px',
                background: zone.delay_count > 10 ? '#fef2f2' : '#dbeafe',
                borderRadius: '12px',
                border: `2px solid ${zone.delay_count > 10 ? '#ef4444' : '#3b82f6'}`,
                transition: 'transform 0.2s'
              }}
              data-testid={`zone-card-${zone.name}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                    {zone.name}
                  </h4>
                  <p style={{ fontSize: '14px', color: '#64748b' }}>
                    Lat: {zone.coordinates.lat.toFixed(4)}, Lng: {zone.coordinates.lng.toFixed(4)}
                  </p>
                </div>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: zone.delay_count > 10 ? '#ef4444' : '#3b82f6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: '700'
                  }}
                  data-testid={`zone-delay-count-${zone.name}`}
                >
                  {zone.delay_count}
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: '600', color: zone.delay_count > 10 ? '#dc2626' : '#1e40af' }}>
                {zone.delay_count > 10 ? 'High Delay Zone' : 'Normal Operations'}
              </div>
            </div>
          ))}
        </div>

        <div className="chart-container" style={{ marginTop: '32px' }} data-testid="zone-delays-chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={zoneDelayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px'
                }}
              />
              <Legend />
              <Bar dataKey="delays" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
