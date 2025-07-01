    // C:\Users\Dell\Desktop\FRONTEND\src\LoginPage.jsx
    import React, { useState } from 'react';
    import { API_BASE_URL } from './config';

    function LoginPage({ onLoginSuccess }) {
      const [username, setUsername] = useState('');
      const [password, setPassword] = useState('');
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(false);

      const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // ADDED FOR DEBUGGING: Log the credentials being sent
        console.log('Attempting login with:');
        console.log('Username:', username);
        console.log('Password:', password); // Be cautious logging passwords in production!

        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
          });

          const data = await response.json();

          if (response.ok) {
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUsername', data.username);
            localStorage.setItem('adminRole', data.role);

            onLoginSuccess();
          } else {
            setError(data.message || 'Login failed. Please check your credentials.');
          }
        } catch (err) {
          console.error("Login error:", err);
          setError('Network error or server unavailable.');
        } finally {
          setLoading(false);
        }
      };

      return (
        <div style={{
          fontFamily: 'Arial, sans-serif',
          maxWidth: '400px',
          margin: '100px auto',
          padding: '30px',
          backgroundColor: '#222',
          color: '#eee',
          borderRadius: '10px',
          boxShadow: '0 0 15px rgba(0,0,0,0.5)',
          textAlign: 'center'
        }}>
          <h2 style={{ marginBottom: '20px', color: '#eee' }}>Admin Login</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label htmlFor="username" style={{ display: 'block', marginBottom: '5px', color: '#bbb', textAlign: 'left' }}>Username:</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  padding: '10px',
                  width: 'calc(100% - 20px)',
                  backgroundColor: '#555',
                  color: 'white',
                  border: '1px solid #666',
                  borderRadius: '4px'
                }}
                disabled={loading}
                required
              />
            </div>
            <div>
              <label htmlFor="password" style={{ display: 'block', marginBottom: '5px', color: '#bbb', textAlign: 'left' }}>Password:</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  padding: '10px',
                  width: 'calc(100% - 20px)',
                  backgroundColor: '#555',
                  color: 'white',
                  border: '1px solid #666',
                  borderRadius: '4px'
                }}
                disabled={loading}
                required
              />
            </div>
            {error && <p style={{ color: '#dc3545', margin: '0', fontSize: '0.9em' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 20px',
                backgroundColor: loading ? '#888' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                marginTop: '10px'
              }}
            >
              {loading ? 'Logging In...' : 'Login'}
            </button>
          </form>
        </div>
      );
    }

    export default LoginPage;
    