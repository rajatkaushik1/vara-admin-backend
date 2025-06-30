// frontend/src/components/SubGenreManager.jsx
import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config'; // ADDED: Import API_BASE_URL from config.js

function SubGenreManager({ onSubGenreAdded, genreUpdateKey }) {
  // --- STATE VARIABLES ---
  const [subGenres, setSubGenres] = useState([]);
  const [genres, setGenres] = useState([]); // To populate the genre dropdown
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newSubGenreName, setNewSubGenreName] = useState('');
  const [selectedGenreId, setSelectedGenreId] = useState(''); // For linking sub-genre to genre
  const [editingSubGenreId, setEditingSubGenreId] = useState(null);
  const [editingSubGenreName, setEditingSubGenreName] = useState('');
  const [editingSubGenreGenreId, setEditingSubGenreGenreId] = useState(''); // Store original genre ID for context


  // --- API FETCHING FUNCTIONS ---

  // Function to fetch all genres (for dropdown)
  const fetchGenres = async () => {
    try {
      // CHANGED: Use API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/genres`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setGenres(data);
    } catch (err) {
      console.error("Failed to fetch genres for sub-genre dropdown:", err);
      setError(err.message);
    }
  };

  // Function to fetch all sub-genres
  const fetchSubGenres = async () => {
    try {
      setLoading(true);
      // CHANGED: Use API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/subgenres`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSubGenres(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch sub-genres:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  // --- EVENT HANDLERS ---

  const handleAddSubGenre = async () => {
    const subGenreName = newSubGenreName.trim();
    if (!subGenreName || !selectedGenreId) {
      alert('Sub-genre name and a parent genre are required!');
      return;
    }

    try {
      let response;
      let method;
      let url;

      if (editingSubGenreId) {
        method = 'PUT';
        // CHANGED: Use API_BASE_URL
        url = `${API_BASE_URL}/api/subgenres/${editingSubGenreId}`;
      } else {
        method = 'POST';
        // CHANGED: Use API_BASE_URL
        url = `${API_BASE_URL}/api/subgenres`;
      }

      response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: subGenreName, genre: selectedGenreId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      setNewSubGenreName('');
      setSelectedGenreId('');
      setEditingSubGenreId(null);
      setEditingSubGenreName('');
      setEditingSubGenreGenreId('');

      await fetchSubGenres();
      if (onSubGenreAdded) {
        onSubGenreAdded();
      }
      alert(`Sub-genre ${editingSubGenreId ? 'updated' : 'added'} successfully!`);

    } catch (err) {
      console.error(`Failed to ${editingSubGenreId ? 'update' : 'add'} sub-genre:`, err);
      setError(err.message);
      alert(`Error ${editingSubGenreId ? 'updating' : 'adding'} sub-genre: ${err.message}`);
    }
  };

  const handleDeleteSubGenre = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the sub-genre "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // CHANGED: Use API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/subgenres/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      alert('Sub-genre deleted successfully!');
      await fetchSubGenres();
      if (onSubGenreAdded) {
        onSubGenreAdded();
      }
    } catch (err) {
      console.error("Failed to delete sub-genre:", err);
      setError(err.message);
      alert(`Error deleting sub-genre: ${err.message}`);
    }
  };

  const handleEditClick = (subGenre) => {
    setEditingSubGenreId(subGenre._id);
    setEditingSubGenreName(subGenre.name);
    setEditingSubGenreGenreId(subGenre.genre._id); // Store original genre ID
    setNewSubGenreName(subGenre.name);
    setSelectedGenreId(subGenre.genre._id); // Pre-select the genre in the dropdown
  };

  const handleCancelEdit = () => {
    setEditingSubGenreId(null);
    setEditingSubGenreName('');
    setEditingSubGenreGenreId('');
    setNewSubGenreName('');
    setSelectedGenreId('');
  };


  // --- useEffect HOOKS ---
  // Fetch genres and sub-genres on initial mount
  useEffect(() => {
    fetchGenres();
    fetchSubGenres();
  }, []);

  // Re-fetch sub-genres and genres when genreUpdateKey changes (from App.jsx)
  useEffect(() => {
    fetchGenres(); // Re-fetch genres to ensure dropdown is up-to-date
    fetchSubGenres(); // Re-fetch subgenres to ensure list is up-to-date
  }, [genreUpdateKey]); // Dependency array includes genreUpdateKey


  // --- RENDER LOGIC ---

  if (loading) {
    return (
      <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px', backgroundColor: '#333', color: '#eee' }}>
        Loading sub-genres...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px', backgroundColor: '#333', color: '#eee' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px', backgroundColor: '#333', color: '#eee' }}>
      <h2>Manage Sub-genres</h2>

      {/* Form to add/edit a sub-genre */}
      <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #444' }}>
        <h3>{editingSubGenreId ? `Edit Sub-genre: ${editingSubGenreName}` : 'Add New Sub-genre:'}</h3>
        <input
          type="text"
          placeholder="Enter sub-genre name"
          value={newSubGenreName}
          onChange={(e) => setNewSubGenreName(e.target.value)}
          style={{ padding: '8px', marginRight: '10px', width: '200px', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
        />
        <select
          value={selectedGenreId}
          onChange={(e) => setSelectedGenreId(e.target.value)}
          style={{ padding: '8px', marginRight: '10px', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
        >
          <option value="">Select Parent Genre</option>
          {genres.map(genre => (
            <option key={genre._id} value={genre._id}>{genre.name}</option>
          ))}
        </select>
        <button
          onClick={handleAddSubGenre}
          style={{
            padding: '8px 15px',
            backgroundColor: editingSubGenreId ? '#007bff' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {editingSubGenreId ? 'Update Sub-genre' : 'Add Sub-genre'}
        </button>
        {editingSubGenreId && (
          <button
            onClick={handleCancelEdit}
            style={{
              padding: '8px 15px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginLeft: '10px'
            }}
          >
            Cancel Edit
          </button>
        )}
      </div>

      {/* List of existing sub-genres */}
      <h3>Existing Sub-genres:</h3>
      {subGenres.length === 0 ? (
        <p style={{ color: '#bbb' }}>No sub-genres found. Add some above!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {subGenres.map(subGenre => (
            <li key={subGenre._id} style={{ marginBottom: '5px', padding: '8px', background: '#444', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {subGenre.name} (Parent: {subGenre.genre ? subGenre.genre.name : 'N/A'}) (ID: <span style={{ fontSize: '0.8em', color: '#777' }}>{subGenre._id}</span>)
              </span>
              <div>
                <button
                  onClick={() => handleEditClick(subGenre)}
                  style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteSubGenre(subGenre._id, subGenre.name)}
                  style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SubGenreManager;
