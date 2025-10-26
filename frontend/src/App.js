import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@/App.css';
import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';
import FleetOverview from '@/components/FleetOverview';
import MapView from '@/components/MapView';
import JobsBoard from '@/components/JobsBoard';
import Alerts from '@/components/Alerts';
import Analytics from '@/components/Analytics';
import DriverView from '@/components/DriverView';
import { Toaster } from '@/components/ui/sonner';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={
            user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />
          } />
          <Route path="/" element={
            !user ? <Navigate to="/login" /> : 
            user.role === 'driver' ? <DriverView user={user} onLogout={handleLogout} /> :
            <Dashboard user={user} onLogout={handleLogout} />
          }>
            <Route index element={<FleetOverview />} />
            <Route path="map" element={<MapView />} />
            <Route path="jobs" element={<JobsBoard />} />
            <Route path="alerts" element={<Alerts user={user} />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
