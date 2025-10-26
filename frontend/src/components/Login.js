import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, {
        username,
        password
      });

      const { access_token, user } = response.data;
      onLogin(user, access_token);
      toast.success(`Welcome back, ${user.username}!`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" data-testid="login-container">
      <div className="login-card">
        <div className="login-logo">
          <h1 data-testid="login-title">HyderFleet Pro</h1>
          <p>Logistics Management System</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              data-testid="username-input"
              placeholder="Enter your username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="password-input"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
            data-testid="login-button"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="demo-credentials">
          <strong>Demo Credentials:</strong>
          <p><strong>Admin:</strong> admin / admin123</p>
          <p><strong>Driver:</strong> driver1 / driver123</p>
          <p><strong>Viewer:</strong> viewer / viewer123</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
