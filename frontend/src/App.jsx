    // frontend/src/App.jsx
    import React, { useState, useEffect } from 'react';
    import GenreManager from './components/GenreManager';
    import SubGenreManager from './components/SubGenreManager';
    import SongManager from './components/SongManager';
    import LoginPage from './LoginPage'; // Import the new LoginPage component

    function App() {
      const [activeSection, setActiveSection] = useState('genres');
      const [genreUpdateKey, setGenreUpdateKey] = useState(0);
      // State to track if the user is authenticated
      const [isAuthenticated, setIsAuthenticated] = useState(false);

      // Check for token on initial load
      useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) {
          // In a real app, you'd want to validate this token with the backend
          // here to ensure it's not expired or invalid. For now, presence is enough.
          setIsAuthenticated(true);
        }
      }, []);

      const handleLoginSuccess = () => {
        setIsAuthenticated(true);
      };

      const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        localStorage.removeItem('adminRole');
        setIsAuthenticated(false);
        setActiveSection('genres'); // Reset active section on logout
      };

      const handleGenreOrSubGenreChange = () => {
        setGenreUpdateKey(prevKey => prevKey + 1);
        console.log('Genre or Sub-genre change detected, triggering SongManager & SubGenreManager refresh...');
      };

      const renderSection = () => {
        switch (activeSection) {
          case 'genres':
            return <GenreManager onGenreAdded={handleGenreOrSubGenreChange} />;
          case 'subGenres':
            return <SubGenreManager onSubGenreAdded={handleGenreOrSubGenreChange} genreUpdateKey={genreUpdateKey} />;
          case 'songs':
            return <SongManager genreUpdateKey={genreUpdateKey} />;
          default:
            return <GenreManager onGenreAdded={handleGenreOrSubGenreChange} />;
        }
      };

      const navButtonStyle = (section) => ({
        padding: '10px 20px',
        margin: '0 5px',
        backgroundColor: activeSection === section ? '#007bff' : '#555',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '16px',
        transition: 'background-color 0.3s ease'
      });

      // Conditional rendering based on authentication state
      if (!isAuthenticated) {
        return <LoginPage onLoginSuccess={handleLoginSuccess} />;
      }

      return (
        <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '20px auto', backgroundColor: '#222', color: '#eee', borderRadius: '10px', boxShadow: '0 0 15px rgba(0,0,0,0.5)' }}>
          <header style={{ padding: '20px', borderBottom: '1px solid #444', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ color: '#eee', margin: '0' }}>Vara Admin Panel</h1>
            <nav style={{ display: 'flex', alignItems: 'center' }}>
              <button
                style={navButtonStyle('genres')}
                onClick={() => setActiveSection('genres')}
              >
                Manage Genres
              </button>
              <button
                style={navButtonStyle('subGenres')}
                onClick={() => setActiveSection('subGenres')}
              >
                Manage Sub-genres
              </button>
              <button
                style={navButtonStyle('songs')}
                onClick={() => setActiveSection('songs')}
              >
                Manage Songs
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '10px 20px',
                  marginLeft: '20px', // Add some space from other buttons
                  backgroundColor: '#dc3545', // Red for logout
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background-color 0.3s ease'
                }}
              >
                Logout
              </button>
            </nav>
          </header>

          <main>
            {renderSection()}
          </main>
        </div>
      );
    }

    export default App;
    