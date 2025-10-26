import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Truck, Map, ClipboardList, AlertCircle, BarChart3, LogOut } from 'lucide-react';

function Dashboard({ user, onLogout }) {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="dashboard-container" data-testid="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>HyderFleet Pro</h1>
          <p>Logistics Management</p>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/"
            className={`nav-item ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}
            data-testid="nav-fleet"
          >
            <Truck />
            Fleet Overview
          </Link>
          <Link
            to="/map"
            className={`nav-item ${isActive('/map') ? 'active' : ''}`}
            data-testid="nav-map"
          >
            <Map />
            Live Map
          </Link>
          <Link
            to="/jobs"
            className={`nav-item ${isActive('/jobs') ? 'active' : ''}`}
            data-testid="nav-jobs"
          >
            <ClipboardList />
            Delivery Jobs
          </Link>
          <Link
            to="/alerts"
            className={`nav-item ${isActive('/alerts') ? 'active' : ''}`}
            data-testid="nav-alerts"
          >
            <AlertCircle />
            Alerts
          </Link>
          <Link
            to="/analytics"
            className={`nav-item ${isActive('/analytics') ? 'active' : ''}`}
            data-testid="nav-analytics"
          >
            <BarChart3 />
            Analytics
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <p data-testid="user-name">{user.username}</p>
            <span className="role-badge" data-testid="user-role">{user.role}</span>
          </div>
          <button
            className="logout-btn"
            onClick={onLogout}
            data-testid="logout-button"
          >
            <LogOut size={16} style={{ marginRight: '8px', display: 'inline' }} />
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Dashboard;
