    // frontend/src/components/SongManager.jsx
    import React, { useEffect, useState, useCallback } from 'react';
    import { API_BASE_URL } from '../config';

    function SongManager({ genreUpdateKey }) {
      // --- STATE VARIABLES ---
      const [songs, setSongs] = useState([]);
      const [allGenres, setAllGenres] = useState([]);
      const [allSubGenres, setAllSubGenres] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);

      // States for song upload form inputs
      const [newSongTitle, setNewSongTitle] = useState('');
      const [selectedGenreIds, setSelectedGenreIds] = useState([]);
      const [selectedSubGenreIds, setSelectedSubGenreIds] = useState([]);
      // REMOVED: isNewSongExclusive state
      const [newSongCollectionType, setNewSongCollectionType] = useState('free'); // Default to 'free'
      const [newSongImage, setNewSongImage] = useState(null);
      const [newSongAudio, setNewSongAudio] = useState(null);
      const [uploading, setUploading] = useState(false);

      // States for search/filter inputs
      const [genreSearchTerm, setGenreSearchTerm] = useState('');
      const [subGenreSearchTerm, setSubGenreSearchTerm] = useState('');
      const [songSearchTerm, setSongSearchTerm] = useState('');
      const [sortOrder, setSortOrder] = useState('desc');

      // States for editing a song
      const [editingSongId, setEditingSongId] = useState(null);
      const [editingSongOriginalTitle, setEditingSongOriginalTitle] = useState('');

      // State for success notifications
      const [notification, setNotification] = useState({ message: '', type: '' });

      const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => {
          setNotification({ message: '', type: '' });
        }, 4000);
      };

      // --- API FETCHING FUNCTIONS ---
      const fetchSongs = useCallback(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/songs`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setSongs(data);
        } catch (err) {
          console.error("Failed to fetch songs:", err);
          setError(err.message);
          showNotification(`Error fetching songs: ${err.message}`, 'error');
        }
      }, []);

      const fetchAllGenres = useCallback(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/genres`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setAllGenres(data);
        } catch (err) {
          console.error("Failed to fetch genres for song manager:", err);
          setError(err.message);
          showNotification(`Error fetching genres: ${err.message}`, 'error');
        }
      }, []);

      const fetchAllSubGenres = useCallback(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/subgenres`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setAllSubGenres(data);
        } catch (err) {
          console.error("Failed to fetch sub-genres for song manager:", err);
          setError(err.message);
          showNotification(`Error fetching sub-genres: ${err.message}`, 'error');
        }
      }, []);

      // --- useEffect for Initial Data Load ---
      useEffect(() => {
        const loadInitialData = async () => {
          setLoading(true);
          setError(null);
          try {
            await Promise.all([fetchSongs(), fetchAllGenres(), fetchAllSubGenres()]);
          } catch (err) {
            // Errors are handled by individual fetch functions
          } finally {
            setLoading(false);
          }
        };

        loadInitialData();
      }, [genreUpdateKey, fetchSongs, fetchAllGenres, fetchAllSubGenres]);

      // --- Derived State / Filtering and Sorting Logic ---
      const filteredGenres = allGenres.filter(genre =>
        genre.name.toLowerCase().includes(genreSearchTerm.toLowerCase())
      );

      const filteredSubGenres = allSubGenres.filter(subGenre => {
        const matchesSearch = subGenre.name.toLowerCase().includes(subGenreSearchTerm.toLowerCase());

        if (selectedGenreIds.length === 0) {
          return matchesSearch;
        }
        const matchesSelectedGenre = subGenre.genre && selectedGenreIds.includes(subGenre.genre._id);
        return matchesSearch && matchesSelectedGenre;
      });

      const displayedSongs = songs
        .filter(song =>
          song.title.toLowerCase().includes(songSearchTerm.toLowerCase())
        )
        .sort((a, b) => {
          if (sortOrder === 'asc') {
            return a._id.localeCompare(b._id);
          } else {
            return b._id.localeCompare(a._id);
          }
        });


      // --- Event Handler for Song Upload/Update ---
      const handleAddSong = async (e) => {
        e.preventDefault();

        if (!newSongTitle.trim() || selectedGenreIds.length === 0 || selectedSubGenreIds.length === 0) {
          showNotification('Please fill in required fields (Title, Genres, Sub-genres)!', 'error');
          return;
        }

        if (!editingSongId && (!newSongImage || !newSongAudio)) {
          showNotification('Both image and audio files are required for new songs!', 'error');
          return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('title', newSongTitle);
        selectedGenreIds.forEach(id => formData.append('genres', id));
        selectedSubGenreIds.forEach(id => formData.append('subGenres', id));
        // REMOVED: isExclusive append
        formData.append('collectionType', newSongCollectionType);

        if (newSongImage) formData.append('imageFile', newSongImage);
        if (newSongAudio) formData.append('audioFile', newSongAudio);

        try {
          let response;
          let method;
          let url;

          if (editingSongId) {
            method = 'PUT';
            url = `${API_BASE_URL}/api/songs/${editingSongId}`;
          } else {
            method = 'POST';
            url = `${API_BASE_URL}/api/songs`;
          }

          response = await fetch(url, {
            method: method,
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }

          // Reset form and editing states
          setNewSongTitle('');
          setSelectedGenreIds([]);
          setSelectedSubGenreIds([]);
          // REMOVED: isNewSongExclusive reset
          setNewSongCollectionType('free'); // Reset to default 'free'
          setNewSongImage(null);
          setNewSongAudio(null);
          setEditingSongId(null);
          setEditingSongOriginalTitle('');

          if (document.getElementById('image')) document.getElementById('image').value = '';
          if (document.getElementById('audio')) document.getElementById('audio').value = '';

          await fetchSongs();
          showNotification(`Song ${editingSongId ? 'updated' : 'uploaded'} successfully!`, 'success');

        } catch (err) {
          console.error(`Failed to ${editingSongId ? 'update' : 'upload'} song:`, err);
          setError(err.message);
          showNotification(`Error ${editingSongId ? 'updating' : 'uploading'} song: ${err.message}`, 'error');
        } finally {
          setUploading(false);
        }
      };


      // Handles deleting a song
      const handleDeleteSong = async (id, title) => {
        if (!window.confirm(`Are you sure you want to delete the song "${title}"? This action cannot be undone and will remove its files from Cloudinary.`)) {
          return;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/songs/${id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }

          showNotification('Song deleted successfully!', 'success');
          await fetchSongs();
        } catch (err) {
          console.error("Failed to delete song:", err);
          setError(err.message);
          showNotification(`Error deleting song: ${err.message}`, 'error');
        }
      };


      // Handles clicking the 'Edit' button for a song
      const handleEditClick = (song) => {
        setEditingSongId(song._id);
        setEditingSongOriginalTitle(song.title);

        setNewSongTitle(song.title);
        setSelectedGenreIds(song.genres ? song.genres.map(g => g._id) : []);
        setSelectedSubGenreIds(song.subGenres ? song.subGenres.map(sg => sg._id) : []);
        // REMOVED: isNewSongExclusive assignment
        setNewSongCollectionType(song.collectionType); // Keep original collection type

        setNewSongImage(null);
        setNewSongAudio(null);

        if (document.getElementById('image')) document.getElementById('image').value = '';
        if (document.getElementById('audio')) document.getElementById('audio').value = '';
      };


      // --- RENDER LOGIC ---
      if (loading) {
        return <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px', backgroundColor: '#333', color: '#eee' }}>Loading song data...</div>;
      }

      if (error) {
        return <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px', backgroundColor: '#333', color: '#eee' }}>Error: {error}</div>;
      }

      return (
        <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px', backgroundColor: '#333', color: '#eee' }}>
          <h2>Manage Songs</h2>

          {notification.message && (
            <div style={{
              padding: '10px 15px',
              marginBottom: '20px',
              borderRadius: '4px',
              backgroundColor: notification.type === 'success' ? '#28a745' : '#dc3545',
              color: 'white',
              textAlign: 'center',
              fontWeight: 'bold'
            }}>
              {notification.message}
            </div>
          )}

          {/* Form for uploading/updating songs */}
          <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #444' }}>
            <h3>{editingSongId ? `Edit Song: ${editingSongOriginalTitle}` : 'Upload New Song:'}</h3>
            <form onSubmit={handleAddSong} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {/* Title Input */}
              <div>
                <label htmlFor="title" style={{ display: 'block', marginBottom: '5px', color: '#bbb' }}>Title:</label>
                <input
                  type="text"
                  id="title"
                  placeholder="Enter song title"
                  value={newSongTitle}
                  onChange={(e) => setNewSongTitle(e.target.value)}
                  style={{ padding: '8px', width: 'calc(100% - 16px)', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
                  required
                />
              </div>

              {/* Genres Checkboxes with Search */}
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#bbb' }}>Genres (Select multiple):</label>
                <input
                  type="text"
                  placeholder="Search genres..."
                  value={genreSearchTerm}
                  onChange={(e) => setGenreSearchTerm(e.target.value)}
                  style={{ padding: '8px', width: 'calc(100% - 16px)', marginBottom: '10px', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '8px', backgroundColor: '#555', border: '1px solid #666', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                  {filteredGenres.length === 0 ? (
                    <p style={{ color: '#bbb' }}>No matching genres.</p>
                  ) : (
                    filteredGenres.map(genre => (
                      <label key={genre._id} style={{ display: 'flex', alignItems: 'center', color: 'white', marginRight: '10px' }}>
                        <input
                          type="checkbox"
                          value={genre._id}
                          checked={selectedGenreIds.includes(genre._id)}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedGenreIds(prev =>
                              e.target.checked
                                ? [...prev, id]
                                : prev.filter(item => item !== id)
                            );
                          }}
                          style={{ marginRight: '5px' }}
                        />
                        {genre.name}
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Sub-genres Checkboxes with Search & Dynamic Filtering */}
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#bbb' }}>Sub-genres (Select multiple):</label>
                <input
                  type="text"
                  placeholder="Search sub-genres..."
                  value={subGenreSearchTerm}
                  onChange={(e) => setSubGenreSearchTerm(e.target.value)}
                  style={{ padding: '8px', width: 'calc(100% - 16px)', marginBottom: '10px', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '8px', backgroundColor: '#555', border: '1px solid #666', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                  {filteredSubGenres.length === 0 ? (
                    <p style={{ color: '#bbb' }}>No matching sub-genres or select a genre first.</p>
                  ) : (
                    filteredSubGenres.map(subGenre => (
                      <label key={subGenre._id} style={{ display: 'flex', alignItems: 'center', color: 'white', marginRight: '10px' }}>
                        <input
                          type="checkbox"
                          value={subGenre._id}
                          checked={selectedSubGenreIds.includes(subGenre._id)}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedSubGenreIds(prev =>
                              e.target.checked
                                ? [...prev, id]
                                : prev.filter(item => item !== id)
                            );
                          }}
                          style={{ marginRight: '5px' }}
                        />
                        {subGenre.name} ({subGenre.genre ? subGenre.genre.name.split(' ')[0] : 'N/A'})
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* REMOVED: Is Exclusive Checkbox */}
              {/* <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  id="isExclusive"
                  checked={isNewSongExclusive}
                  onChange={(e) => setIsNewSongExclusive(e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                <label htmlFor="isExclusive" style={{ color: '#bbb' }}>Is Exclusive (for Collection B)</label>
              </div> */}

              {/* Collection Type Radio Buttons */}
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#bbb' }}>Collection Type:</label>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <label style={{ color: '#bbb' }}>
                    <input
                      type="radio"
                      name="collectionType"
                      value="free"
                      checked={newSongCollectionType === 'free'}
                      onChange={(e) => setNewSongCollectionType(e.target.value)}
                      style={{ marginRight: '5px' }}
                    />
                    Collection Free (Requires Signup)
                  </label>
                  <label style={{ color: '#bbb' }}>
                    <input
                      type="radio"
                      name="collectionType"
                      value="paid"
                      checked={newSongCollectionType === 'paid'}
                      onChange={(e) => setNewSongCollectionType(e.target.value)}
                      style={{ marginRight: '5px' }}
                    />
                    Collection Paid (Monthly Subscription)
                  </label>
                </div>
              </div>

              {/* Cover Image Input */}
              <div>
                <label htmlFor="image" style={{ display: 'block', marginBottom: '5px', color: '#bbb' }}>Cover Image (JPEG/PNG/JPG/WEBP) {editingSongId && '(optional, leave blank to keep current)'}:</label>
                <input
                  type="file"
                  id="image"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={(e) => setNewSongImage(e.target.files[0])}
                  style={{ padding: '8px', width: 'calc(100% - 16px)', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
                  required={!editingSongId}
                />
              </div>

              {/* Audio File Input */}
              <div>
                <label htmlFor="audio" style={{ display: 'block', marginBottom: '5px', color: '#bbb' }}>Audio File (MP3/WAV/AAC/OGG) {editingSongId && '(optional, leave blank to keep current)'}:</label>
                <input
                  type="file"
                  id="audio"
                  accept="audio/mpeg,audio/wav,audio/mp3,audio/aac,audio/ogg"
                  onChange={(e) => setNewSongAudio(e.target.files[0])}
                  style={{ padding: '8px', width: 'calc(100% - 16px)', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
                  required={!editingSongId}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={uploading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: uploading ? '#888' : (editingSongId ? '#007bff' : '#007bff'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  marginTop: '15px'
                }}
              >
                {uploading ? (editingSongId ? 'Updating...' : 'Uploading...') : (editingSongId ? 'Update Song' : 'Upload Song')}
              </button>

              {editingSongId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSongId(null);
                    setEditingSongOriginalTitle('');
                    setNewSongTitle('');
                    setSelectedGenreIds([]);
                    setSelectedSubGenreIds([]);
                    // REMOVED: isNewSongExclusive reset
                    setNewSongCollectionType('free');
                    setNewSongImage(null);
                    setNewSongAudio(null);
                    if (document.getElementById('image')) document.getElementById('image').value = '';
                    if (document.getElementById('audio')) document.getElementById('audio').value = '';
                  }}
                  style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}
                >
                  Cancel Edit
                </button>
              )}
            </form>
          </div>

          {/* List of existing songs with Search and Sort */}
          <h3>Existing Songs:</h3>
          <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Search by Title */}
            <input
              type="text"
              placeholder="Search by Title..."
              value={songSearchTerm}
              onChange={(e) => setSongSearchTerm(e.target.value)}
              style={{ padding: '8px', width: '250px', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
            />
            {/* Sort by Date Added */}
            <label style={{ color: '#bbb', marginRight: '5px' }}>Sort by Date Added:</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ padding: '8px', backgroundColor: '#555', color: 'white', border: '1px solid #666', borderRadius: '4px' }}
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>

          {displayedSongs.length === 0 ? (
            <p style={{ color: '#bbb' }}>No songs found matching your criteria. Upload some above!</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {displayedSongs.map(song => (
                <li key={song._id} style={{ marginBottom: '15px', padding: '10px', background: '#444', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                  {/* Song Image */}
                  <img
                    src={song.imageUrl}
                    alt={song.title}
                    style={{ width: '80px', height: '80px', borderRadius: '4px', marginRight: '15px', objectFit: 'cover' }}
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/80x80/000/FFF?text=No+Image'; }}
                  />

                  {/* Song Details */}
                  <div style={{ flexGrow: 1 }}>
                    {/* CHANGED: Removed isExclusive display */}
                    <h4 style={{ margin: '0', color: 'white' }}>{song.title} (Collection {song.collectionType === 'free' ? 'Free' : 'Paid'})</h4>
                    <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#bbb' }}>
                      Genres: {song.genres && Array.isArray(song.genres) && song.genres.length > 0 ? song.genres.map(g => g.name).join(', ') : 'N/A'}
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#bbb' }}>
                      Sub-genres: {song.subGenres && Array.isArray(song.subGenres) && song.subGenres.length > 0 ? song.subGenres.map(sg => sg.name).join(', ') : 'N/A'}
                    </p>
                    {/* Audio Player */}
                    <audio controls src={song.audioUrl} style={{ width: '100%', marginTop: '10px' }}>
                      Your browser does not support the audio element.
                    </audio>
                    <span style={{ fontSize: '0.8em', color: '#777' }}>ID: {song._id}</span>
                  </div>

                  {/* Buttons Container */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                    <button
                      onClick={() => handleEditClick(song)}
                      style={{ padding: '8px 15px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Edit Song
                    </button>
                    <button
                      onClick={() => handleDeleteSong(song._id, song.title)}
                      style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Delete Song
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    export default SongManager;
    