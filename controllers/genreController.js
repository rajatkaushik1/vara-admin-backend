    // C:\Users\Dell\Desktop\vara-admin\controllers\genreController.js
    const Genre = require('../models/Genre');
    const SubGenre = require('../models/SubGenre'); // Needed for deletion cascade
    const cloudinary = require('cloudinary').v2; // Import Cloudinary

    // Helper function to extract public ID from Cloudinary URL
    const getPublicIdFromCloudinaryUrl = (url) => {
        if (!url) return null;
        const parts = url.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex > -1 && parts[uploadIndex + 1]) {
            const publicIdWithVersion = parts.slice(uploadIndex + 1).join('/');
            // Remove version number (e.g., 'v123456789/') and extension
            const finalId = publicIdWithVersion.split('/').slice(1).join('/').split('.')[0];
            return finalId;
        }
        return null;
    };

    // @desc    Create a new genre
    // @route   POST /api/genres
    // @access  Private (Admin) - will be protected by middleware later
    exports.createGenre = async (req, res) => {
        // ADDED: description from req.body
        const { name, description } = req.body;
        // ADDED: imageFile from req.files
        const imageFile = req.files && req.files.genreImage && req.files.genreImage.length > 0 ? req.files.genreImage[0] : null;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Genre name is required.' });
        }

        // Image is now optional for genres, but if provided, we'll use it
        // If imageFile is required, add `!imageFile` check here.

        try {
            const genreExists = await Genre.findOne({ name });
            if (genreExists) {
                // If genre exists and a new image was uploaded, consider deleting the new image from Cloudinary
                // This is an advanced cleanup, for now, just return the error.
                return res.status(409).json({ success: false, error: 'Genre with this name already exists.' });
            }

            const genre = new Genre({
                name,
                description: description || '', // Use provided description or empty string
                imageUrl: imageFile ? imageFile.path : '' // Store Cloudinary URL if image exists
            });

            await genre.save();
            res.status(201).json(genre);
        } catch (error) {
            console.error("Error creating genre:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // @desc    Get all genres
    // @route   GET /api/genres
    // @access  Public
    exports.getAllGenres = async (req, res) => {
        try {
            const genres = await Genre.find({});
            res.json(genres);
        } catch (error) {
            console.error("Error fetching genres:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // @desc    Update a genre by ID
    // @route   PUT /api/genres/:id
    // @access  Private (Admin)
    exports.updateGenre = async (req, res) => {
        const { id } = req.params;
        // ADDED: description from req.body
        const { name, description } = req.body;
        // ADDED: imageFile from req.files
        const imageFile = req.files && req.files.genreImage && req.files.genreImage.length > 0 ? req.files.genreImage[0] : null;

        try {
            const existingGenre = await Genre.findById(id);
            if (!existingGenre) {
                return res.status(404).json({ success: false, error: 'Genre not found.' });
            }

            // Check if a genre with the new name already exists (excluding the current genre being updated)
            if (name && name !== existingGenre.name) {
                const nameExists = await Genre.findOne({ name });
                if (nameExists) {
                    return res.status(409).json({ success: false, error: 'Another genre with this name already exists.' });
                }
            }

            let newImageUrl = existingGenre.imageUrl;

            // Handle new image upload
            if (imageFile) {
                // Delete old image from Cloudinary if it exists
                if (existingGenre.imageUrl) {
                    const oldPublicId = getPublicIdFromCloudinaryUrl(existingGenre.imageUrl);
                    if (oldPublicId) {
                        await cloudinary.uploader.destroy(oldPublicId, (error, result) => {
                            if (error) console.error("Failed to delete old genre image from Cloudinary:", error);
                            else console.log("Cloudinary old genre image deletion result:", result);
                        });
                    }
                }
                newImageUrl = imageFile.path; // Set new Cloudinary URL
            } else if (req.body.clearImage === 'true') { // Allow clearing image if checkbox/flag is sent from frontend
                if (existingGenre.imageUrl) {
                    const oldPublicId = getPublicIdFromCloudinaryUrl(existingGenre.imageUrl);
                    if (oldPublicId) {
                        await cloudinary.uploader.destroy(oldPublicId, (error, result) => {
                            if (error) console.error("Failed to delete old genre image from Cloudinary (clear request):", error);
                            else console.log("Cloudinary old genre image deletion result (clear request):", result);
                        });
                    }
                }
                newImageUrl = ''; // Clear image URL in DB
            }


            const updatedGenre = await Genre.findByIdAndUpdate(
                id,
                {
                    name: name || existingGenre.name, // Use new name if provided, else keep old
                    description: description !== undefined ? description : existingGenre.description, // Use new desc or keep old
                    imageUrl: newImageUrl // Update image URL
                },
                { new: true, runValidators: true }
            );

            if (!updatedGenre) {
                return res.status(404).json({ success: false, error: 'Genre not found after update attempt.' });
            }

            res.status(200).json(updatedGenre);
        } catch (error) {
            console.error("Error updating genre:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // @desc    Delete a genre
    // @route   DELETE /api/genres/:id
    // @access  Private (Admin)
    exports.deleteGenre = async (req, res) => {
        try {
            const { id } = req.params;

            // Find the genre to get its image URL before deleting
            const genreToDelete = await Genre.findById(id);
            if (!genreToDelete) {
                return res.status(404).json({ success: false, error: 'Genre not found.' });
            }

            // Delete associated sub-genres first
            const deleteSubGenresResult = await SubGenre.deleteMany({ genre: id });
            console.log(`Deleted ${deleteSubGenresResult.deletedCount} sub-genres associated with genre ID: ${id}`);

            // Delete genre image from Cloudinary
            if (genreToDelete.imageUrl) {
                const publicId = getPublicIdFromCloudinaryUrl(genreToDelete.imageUrl);
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId, (error, result) => {
                        if (error) console.error("Failed to delete genre image from Cloudinary:", error);
                        else console.log("Cloudinary genre image deletion result:", result);
                    });
                } else {
                    console.warn("Could not extract public ID from genre imageUrl:", genreToDelete.imageUrl);
                }
            }

            const deletedGenre = await Genre.findByIdAndDelete(id);

            if (!deletedGenre) {
                return res.status(404).json({ success: false, error: 'Genre not found.' });
            }

            res.status(200).json({ success: true, message: 'Genre and associated sub-genres (and image) deleted successfully.' });
        } catch (error) {
            console.error("Error deleting genre and its sub-genres:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };
    