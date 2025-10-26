import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, Clock, CheckCircle, MapPin } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function JobsBoard() {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    zone: 'all',
    loadType: 'all'
  });
  const [stats, setStats] = useState({
    pending: 0,
    inTransit: 0,
    delivered: 0
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [jobs, filters]);

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setJobs(response.data);
      
      const pending = response.data.filter(j => j.status === 'pending').length;
      const inTransit = response.data.filter(j => j.status === 'in-transit').length;
      const delivered = response.data.filter(j => j.status === 'delivered').length;
      
      setStats({ pending, inTransit, delivered });
    } catch (error) {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...jobs];

    if (filters.status !== 'all') {
      filtered = filtered.filter(j => j.status === filters.status);
    }

    if (filters.zone !== 'all') {
      filtered = filtered.filter(j => j.zone === filters.zone);
    }

    if (filters.loadType !== 'all') {
      filtered = filtered.filter(j => j.load_type === filters.loadType);
    }

    setFilteredJobs(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Job Number', 'Status', 'Zone', 'Load Type', 'Load Weight', 'ETA', 'Created At'];
    const rows = filteredJobs.map(job => [
      job.job_number,
      job.status,
      job.zone,
      job.load_type,
      job.load_weight,
      new Date(job.estimated_eta).toLocaleString(),
      new Date(job.created_at).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hyderfleet-jobs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Jobs exported to CSV');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('HyderFleet Pro - Delivery Jobs Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

    const tableData = filteredJobs.map(job => [
      job.job_number,
      job.status,
      job.zone,
      job.load_type,
      `${job.load_weight} kg`,
      new Date(job.estimated_eta).toLocaleString()
    ]);

    doc.autoTable({
      head: [['Job #', 'Status', 'Zone', 'Load Type', 'Weight', 'ETA']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 60, 114] }
    });

    doc.save(`hyderfleet-jobs-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Jobs exported to PDF');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Package size={18} />;
      case 'in-transit':
        return <Clock size={18} />;
      case 'delivered':
        return <CheckCircle size={18} />;
      default:
        return <Package size={18} />;
    }
  };

  if (loading) {
    return (
      <div data-testid="jobs-loading">
        <div className="page-header">
          <h2>Delivery Jobs Board</h2>
          <p>Loading jobs...</p>
        </div>
      </div>
    );
  }

  const loadTypes = [...new Set(jobs.map(j => j.load_type))];

  return (
    <div data-testid="jobs-board">
      <div className="page-header">
        <h2>Delivery Jobs Board</h2>
        <p>Track and manage all delivery operations</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card pending" data-testid="stat-pending">
          <div className="stat-label">Pending Pickups</div>
          <div className="stat-value">{stats.pending}</div>
        </div>
        <div className="stat-card in-transit" data-testid="stat-in-transit">
          <div className="stat-label">In Transit</div>
          <div className="stat-value">{stats.inTransit}</div>
        </div>
        <div className="stat-card delivered" data-testid="stat-delivered">
          <div className="stat-label">Delivered</div>
          <div className="stat-value">{stats.delivered}</div>
        </div>
      </div>

      <div className="card">
        <div className="filters">
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              data-testid="filter-status"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Zone</label>
            <select
              value={filters.zone}
              onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
              data-testid="filter-zone"
            >
              <option value="all">All Zones</option>
              <option value="Patancheru">Patancheru</option>
              <option value="Medchal">Medchal</option>
              <option value="Shamshabad">Shamshabad</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Load Type</label>
            <select
              value={filters.loadType}
              onChange={(e) => setFilters({ ...filters, loadType: e.target.value })}
              data-testid="filter-load-type"
            >
              <option value="all">All Load Types</option>
              {loadTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={exportToCSV}
            data-testid="export-csv-btn"
            style={{
              padding: '10px 20px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            Export CSV
          </button>
          <button
            onClick={exportToPDF}
            data-testid="export-pdf-btn"
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            Export PDF
          </button>
        </div>

        <div className="table-container">
          <table data-testid="jobs-table">
            <thead>
              <tr>
                <th>Job Number</th>
                <th>Status</th>
                <th>Zone</th>
                <th>Load Type</th>
                <th>Weight</th>
                <th>Pickup Location</th>
                <th>Delivery Location</th>
                <th>ETA</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id} data-testid={`job-row-${job.id}`}>
                  <td><strong>{job.job_number}</strong></td>
                  <td>
                    <span className={`status-badge ${job.status}`} data-testid={`job-status-${job.id}`}>
                      {getStatusIcon(job.status)}
                      <span style={{ marginLeft: '6px' }}>{job.status}</span>
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} />
                      {job.zone}
                    </span>
                  </td>
                  <td>{job.load_type}</td>
                  <td>{job.load_weight} kg</td>
                  <td style={{ fontSize: '13px', color: '#64748b' }}>
                    {job.pickup_location.address}
                  </td>
                  <td style={{ fontSize: '13px', color: '#64748b' }}>
                    {job.delivery_location.address}
                  </td>
                  <td>{new Date(job.estimated_eta).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredJobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }} data-testid="no-jobs">
            No jobs found matching the selected filters.
          </div>
        )}
      </div>
    </div>
  );
}

export default JobsBoard;
