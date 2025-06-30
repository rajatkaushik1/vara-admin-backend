// frontend/src/App.jsx
import React, { useState } from 'react';
import GenreManager from './components/GenreManager';
import SubGenreManager from './components/SubGenreManager';
import SongManager from './components/SongManager'; 

function App() {
  const [activeSection, setActiveSection] = useState('genres');
  const [genreUpdateKey, setGenreUpdateKey] = useState(0); 

  const handleGenreOrSubGenreChange = () => {
    setGenreUpdateKey(prevKey => prevKey + 1); 
    console.log('Genre or Sub-genre change detected, triggering SongManager & SubGenreManager refresh...');
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'genres':
        return <GenreManager onGenreAdded={handleGenreOrSubGenreChange} />;
      case 'subGenres':
        // Pass genreUpdateKey here so SubGenreManager can react to genre changes
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

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '20px auto', backgroundColor: '#222', color: '#eee', borderRadius: '10px', boxShadow: '0 0 15px rgba(0,0,0,0.5)' }}>
      <header style={{ padding: '20px', borderBottom: '1px solid #444', textAlign: 'center' }}>
        <h1 style={{ color: '#eee', marginBottom: '20px' }}>Vara Admin Panel</h1>
        <nav>
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
        </nav>
      </header>

      <main>
        {renderSection()}
      </main>
    </div>
  );
}

export default App;