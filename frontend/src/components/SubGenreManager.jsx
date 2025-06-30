// frontend/src/components/SubGenreManager.jsx
import React, { useEffect, useState } from 'react';

// Receive onSubGenreAdded (to notify App.jsx) and genreUpdateKey (to react to genre changes)
function SubGenreManager({ onSubGenreAdded, genreUpdateKey }) {
  // --- STATE VARIABLES ---
  const [subGenres, setSubGenres] = useState([]); 
  const [genresForSelection, setGenresForSelection] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States for add/edit form
  const [newSubGenreName, setNewSubGenreName] = useState('');
  const [selectedGenreId, setSelectedGenreId] = useState('');

  // States for editing a sub-genre
  const [editingSubGenreId, setEditingSubGenreId] = useState(null);
  const [editingSubGenreOriginalName, setEditingSubGenreOriginalName] = useState('');


  // --- API FETCHING FUNCTIONS ---

  const fetchSubGenres = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/subgenres');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSubGenres(data);
    } catch (err) {
      console.error("Failed to fetch sub-genres:", err);
      setError(err.message);
      // No re-throw here, let finally handle loading state
    }
  };

  const fetchGenresForSelection = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/genres');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setGenresForSelection(data);
      // Only set initial selected genre if not editing and there are genres
      if (!editingSubGenreId && data.length > 0 && !selectedGenreId) { // Only set if selectedGenreId is not already set (e.g. from an edit click)
        setSelectedGenreId(data[0]._id); 
      } else if (data.length === 0) {
        setSelectedGenreId('');
      }
    } catch (err) {
      console.error("Failed to fetch genres for selection:", err);
      setError(err.message);
      // No re-throw here
    }
  };

  // --- EFFECT HOOKS ---

  // This useEffect now depends on genreUpdateKey and onSubGenreAdded (for its own internal updates)
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchSubGenres(), fetchGenresForSelection()]);
      } catch (err) {
        // Errors are already handled and set in individual fetch functions
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [onSubGenreAdded, genreUpdateKey]); // Add genreUpdateKey as a dependency


  // --- EVENT HANDLERS ---

  const handleAddSubGenre = async () => {
    const subGenreName = newSubGenreName.trim();
    if (!subGenreName) {
      alert('Sub-genre name cannot be empty!');
      return;
    }
    if (!selectedGenreId) {
      alert('Please select a parent genre!');
      return;
    }

    try {
      let response;
      let method;
      let url;

      if (editingSubGenreId) {
        method = 'PUT';
        url = `http://localhost:5000/api/subgenres/${editingSubGenreId}`;
      } else {
        method = 'POST';
        url = 'http://localhost:5000/api/subgenres';
      }

      response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: subGenreName,
          genreId: selectedGenreId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Reset form and editing states
      setNewSubGenreName('');
      setEditingSubGenreId(null);
      setEditingSubGenreOriginalName('');
      if (genresForSelection.length > 0) {
          setSelectedGenreId(genresForSelection[0]._id);
      } else {
          setSelectedGenreId('');
      }

      await fetchSubGenres(); // Re-fetch the list of sub-genres
      
      // IMPORTANT: Notify App.jsx about this change so SongManager also refreshes
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
      const response = await fetch(`http://localhost:5000/api/subgenres/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      alert('Sub-genre deleted successfully!');
      await fetchSubGenres(); // Re-fetch the list of sub-genres
      
      // IMPORTANT: Notify App.jsx about this change so SongManager also refreshes
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
    setEditingSubGenreOriginalName(subGenre.name);
    setNewSubGenreName(subGenre.name);
    // Ensure that if subGenre.genre is null or undefined (e.g., from old data), we handle it safely
    setSelectedGenreId(subGenre.genre ? subGenre.genre._id : ''); 
  };


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
        <h3>{editingSubGenreId ? `Edit Sub-genre: ${editingSubGenreOriginalName}` : 'Add New Sub-genre:'}</h3> 
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="genre-select" style={{ marginRight: '10px', color: '#bbb' }}>Parent Genre:</label>
          <select
            id="genre-select"
            value={selectedGenreId}
            onChange={(e) => setSelectedGenreId(e.target.value)}
            style={{ padding: '8px', width: '200px', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
          >
            {genresForSelection.length === 0 ? (
              <option value="">No genres available</option>
            ) : (
              genresForSelection.map(genre => (
                <option key={genre._id} value={genre._id}>
                  {genre.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <input
            type="text"
            placeholder="Enter sub-genre name"
            value={newSubGenreName}
            onChange={(e) => setNewSubGenreName(e.target.value)}
            style={{ padding: '8px', marginRight: '10px', width: '200px', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
          />
          <button 
            onClick={handleAddSubGenre} 
            style={{ 
              padding: '8px 15px', 
              backgroundColor: editingSubGenreId ? '#007bff' : '#6200EE',
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
              onClick={() => {
                setEditingSubGenreId(null);
                setEditingSubGenreOriginalName('');
                setNewSubGenreName('');
                if (genresForSelection.length > 0) {
                    setSelectedGenreId(genresForSelection[0]._id);
                } else {
                    setSelectedGenreId('');
                }
              }}
              style={{ padding: '8px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' }}
            >
              Cancel Edit
            </button>
          )}
        </div>
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
                {subGenre.name} (Parent Genre: <span style={{ color: '#888' }}>{subGenre.genre ? subGenre.genre.name : 'N/A'}</span>) (ID: <span style={{ fontSize: '0.8em', color: '#777' }}>{subGenre._id}</span>)
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
