// frontend/src/components/GenreManager.jsx
import React, { useEffect, useState } from 'react';

// We now receive 'onGenreAdded' as a prop from App.jsx
function GenreManager({ onGenreAdded }) {
  // --- STATE VARIABLES ---
  const [genres, setGenres] = useState([]); // List of genres fetched from API
  const [loading, setLoading] = useState(true); // Loading state for API calls
  const [error, setError] = useState(null); // Error state for API calls

  // States for the add/edit form
  const [newGenreName, setNewGenreName] = useState(''); // Value of the input field
  const [editingGenreId, setEditingGenreId] = useState(null); // ID of the genre currently being edited (null if adding)
  const [editingGenreName, setEditingGenreName] = useState(''); // Original name of genre being edited (for display/context)


  // --- API FETCHING FUNCTIONS ---

  // Function to fetch all genres from the backend
  const fetchGenres = async () => {
    try {
      setLoading(true); // Indicate loading
      const response = await fetch('http://localhost:5000/api/genres');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setGenres(data);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error("Failed to fetch genres:", err);
      setError(err.message);
    } finally {
      setLoading(false); // End loading
    }
  };


  // --- EVENT HANDLERS ---

  // Handles adding a new genre or updating an existing one
  const handleAddGenre = async () => {
    const genreName = newGenreName.trim();
    if (!genreName) {
      alert('Genre name cannot be empty!');
      return;
    }

    try {
      let response;
      let method;
      let url;

      if (editingGenreId) { // If editingGenreId is set, it's an UPDATE operation
        method = 'PUT';
        url = `http://localhost:5000/api/genres/${editingGenreId}`;
      } else { // Otherwise, it's a new ADD operation
        method = 'POST';
        url = 'http://localhost:5000/api/genres';
      }

      response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: genreName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Reset form and editing states after successful operation
      setNewGenreName('');
      setEditingGenreId(null);
      setEditingGenreName('');

      await fetchGenres(); // Re-fetch the list of genres to update the UI

      // Notify the parent component (App.jsx) that genre data has changed.
      // This will trigger a refresh in SubGenreManager and SongManager.
      if (onGenreAdded) {
        onGenreAdded(); 
      }

      alert(`Genre ${editingGenreId ? 'updated' : 'added'} successfully!`);

    } catch (err) {
      console.error(`Failed to ${editingGenreId ? 'update' : 'add'} genre:`, err);
      setError(err.message);
      alert(`Error ${editingGenreId ? 'updating' : 'adding'} genre: ${err.message}`);
    }
  };


  // Handles clicking the 'Delete' button for a genre
  const handleDeleteGenre = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the genre "${name}"? This action cannot be undone and will also delete all linked sub-genres.`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/genres/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      alert('Genre deleted successfully!');
      await fetchGenres(); // Re-fetch genres to update the list
      
      // Notify parent about genre change (for sub-genre dropdown refresh in other components)
      if (onGenreAdded) { 
          onGenreAdded(); 
      }
    } catch (err) {
      console.error("Failed to delete genre:", err);
      setError(err.message);
      alert(`Error deleting genre: ${err.message}`);
    }
  };


  // NEW: Handles clicking the 'Edit' button for a genre
  const handleEditClick = (genre) => {
    setEditingGenreId(genre._id);       // Set the ID of the genre being edited
    setEditingGenreName(genre.name);     // Store original name for context (optional)
    setNewGenreName(genre.name);         // Populate the input field with the current name
  };


  // --- useEffect HOOK ---
  // This hook runs once after the initial render to fetch existing genres
  useEffect(() => {
    fetchGenres();
  }, []); // Empty dependency array means it runs only once on mount


  // --- RENDER LOGIC ---

  if (loading) {
    return (
      <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px', backgroundColor: '#333', color: '#eee' }}>
        Loading genres...
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
      <h2>Manage Genres</h2>
      
      {/* Form to add/edit a genre */}
      <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #444' }}>
        {/* Dynamic heading based on whether we are editing or adding */}
        <h3>{editingGenreId ? `Edit Genre: ${editingGenreName}` : 'Add New Genre:'}</h3> 
        <input
          type="text"
          placeholder="Enter genre name"
          value={newGenreName} // This input is used for both add and edit
          onChange={(e) => setNewGenreName(e.target.value)} // Update state as user types
          style={{ padding: '8px', marginRight: '10px', width: '200px', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
        />
        <button 
          onClick={handleAddGenre} 
          style={{ 
            padding: '8px 15px', 
            backgroundColor: editingGenreId ? '#007bff' : '#4CAF50', // Blue for Update, Green for Add
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer' 
          }}
        >
          {editingGenreId ? 'Update Genre' : 'Add Genre'} {/* Dynamic button text */}
        </button>
        {editingGenreId && ( // Show "Cancel Edit" button only when editing
          <button
            onClick={() => {
              setEditingGenreId(null);       // Exit editing mode
              setEditingGenreName('');      // Clear editing name
              setNewGenreName('');          // Clear the input field
            }}
            style={{ 
              padding: '8px 15px', 
              backgroundColor: '#6c757d', // Grey for Cancel
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

      {/* List of existing genres */}
      <h3>Existing Genres:</h3>
      {genres.length === 0 ? (
        <p style={{ color: '#bbb' }}>No genres found. Add some above!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {genres.map(genre => (
            <li key={genre._id} style={{ marginBottom: '5px', padding: '8px', background: '#444', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {genre.name} (ID: <span style={{ fontSize: '0.8em', color: '#777' }}>{genre._id}</span>)
              </span>
              <div> {/* Container for buttons */}
                {/* NEW: Edit Button */}
                <button
                  onClick={() => handleEditClick(genre)}
                  style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}
                >
                  Edit
                </button>
                {/* Existing Delete Button */}
                <button
                  onClick={() => handleDeleteGenre(genre._id, genre.name)}
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

export default GenreManager;
