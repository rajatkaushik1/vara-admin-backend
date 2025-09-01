// C:\Users\Dell\Desktop\vara-admin\controllers\subGenreController.js
    const SubGenre = require('../models/SubGenre');
    const Genre = require('../models/Genre'); // Needed for validation
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

    // @desc    Create a new sub-genre
    // @route   POST /api/subgenres
    // @access  Private (Admin)
    exports.createSubGenre = async (req, res) => {
        const { name, genre, description } = req.body;
        const imageFile = req.files && req.files.subGenreImage && req.files.subGenreImage.length > 0 ? req.files.subGenreImage[0] : null;

        if (!name || !genre) {
            return res.status(400).json({ success: false, error: 'Sub-genre name and parent genre are required.' });
        }

        try {
            const parentGenre = await Genre.findById(genre);
            if (!parentGenre) {
                return res.status(404).json({ success: false, error: 'Parent genre not found.' });
            }

            const subGenreExists = await SubGenre.findOne({ name, genre });
            if (subGenreExists) {
                return res.status(409).json({ success: false, error: 'Sub-genre with this name already exists under the selected genre.' });
            }

            const subGenre = new SubGenre({
                name,
                genre,
                description: description || '',
                imageUrl: imageFile ? imageFile.path : ''
            });

            await subGenre.save();
            res.status(201).json(subGenre);
        } catch (error) {
            console.error("Error creating sub-genre:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // @desc    Get all sub-genres
    // @route   GET /api/subgenres
    // @access  Public
    exports.getAllSubGenres = async (req, res) => {
        try {
            const subGenres = await SubGenre.find({})
                .populate('genre', 'name')
                .lean(); // return plain objects (faster, less CPU)
            res.json(subGenres);
        } catch (error) {
            console.error("Error fetching sub-genres:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ADDED: Get sub-genres by parent genre ID
    // @desc    Get sub-genres by parent genre ID
    // @route   GET /api/subgenres/byGenre/:genreId
    // @access  Public
    exports.getSubGenresByGenre = async (req, res) => {
        try {
            const { genreId } = req.params;
            const subGenres = await SubGenre.find({ genre: genreId })
                .populate('genre', 'name')
                .lean(); // faster, no hydration
            res.json(subGenres);
        } catch (error) {
            console.error("Error fetching sub-genres by genre ID:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };


    // @desc    Update a sub-genre by ID
    // @route   PUT /api/subgenres/:id
    // @access  Private (Admin)
    exports.updateSubGenre = async (req, res) => {
        const { id } = req.params;
        const { name, genre, description } = req.body;
        const imageFile = req.files && req.files.subGenreImage && req.files.subGenreImage.length > 0 ? req.files.subGenreImage[0] : null;

        try {
            const existingSubGenre = await SubGenre.findById(id);
            if (!existingSubGenre) {
                return res.status(404).json({ success: false, error: 'Sub-genre not found.' });
            }

            if (genre && genre !== existingSubGenre.genre.toString()) {
                const parentGenre = await Genre.findById(genre);
                if (!parentGenre) {
                    return res.status(404).json({ success: false, error: 'New parent genre not found.' });
                }
            }

            if (name && name !== existingSubGenre.name || (genre && genre !== existingSubGenre.genre.toString())) {
                const nameExists = await SubGenre.findOne({ name: name || existingSubGenre.name, genre: genre || existingSubGenre.genre });
                if (nameExists && nameExists._id.toString() !== id) {
                    return res.status(409).json({ success: false, error: 'Another sub-genre with this name already exists under the selected genre.' });
                }
            }

            let newImageUrl = existingSubGenre.imageUrl;

            if (imageFile) {
                if (existingSubGenre.imageUrl) {
                    const oldPublicId = getPublicIdFromCloudinaryUrl(existingSubGenre.imageUrl);
                    if (oldPublicId) {
                        await cloudinary.uploader.destroy(oldPublicId, (error, result) => {
                            if (error) console.error("Failed to delete old sub-genre image from Cloudinary:", error);
                            else console.log("Cloudinary old sub-genre image deletion result:", result);
                        });
                    }
                }
                newImageUrl = imageFile.path;
            } else if (req.body.clearImage === 'true') {
                if (existingSubGenre.imageUrl) {
                    const oldPublicId = getPublicIdFromCloudinaryUrl(existingSubGenre.imageUrl);
                    if (oldPublicId) {
                        await cloudinary.uploader.destroy(oldPublicId, (error, result) => {
                            if (error) console.error("Failed to delete old sub-genre image from Cloudinary (clear request):", error);
                            else console.log("Cloudinary old sub-genre image deletion result (clear request):", result);
                        });
                    }
                }
                newImageUrl = '';
            }


            const updatedSubGenre = await SubGenre.findByIdAndUpdate(
                id,
                {
                    name: name || existingSubGenre.name,
                    genre: genre || existingSubGenre.genre,
                    description: description !== undefined ? description : existingSubGenre.description,
                    imageUrl: newImageUrl
                },
                { new: true, runValidators: true }
            ).populate('genre', 'name');

            if (!updatedSubGenre) {
                return res.status(404).json({ success: false, error: 'Sub-genre not found after update attempt.' });
            }

            res.status(200).json(updatedSubGenre);
        } catch (error) {
            console.error("Error updating sub-genre:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // @desc    Delete a sub-genre
    // @route   DELETE /api/subgenres/:id
    // @access  Private (Admin)
    exports.deleteSubGenre = async (req, res) => {
        try {
            const { id } = req.params;

            const subGenreToDelete = await SubGenre.findById(id);
            if (!subGenreToDelete) {
                return res.status(404).json({ success: false, error: 'Sub-genre not found.' });
            }

            if (subGenreToDelete.imageUrl) {
                const publicId = getPublicIdFromCloudinaryUrl(subGenreToDelete.imageUrl);
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId, (error, result) => {
                        if (error) console.error("Failed to delete sub-genre image from Cloudinary:", error);
                        else console.log("Cloudinary sub-genre image deletion result:", result);
                    });
                } else {
                    console.warn("Could not extract public ID from sub-genre imageUrl:", subGenreToDelete.imageUrl);
                }
            }

            const deletedSubGenre = await SubGenre.findByIdAndDelete(id);

            if (!deletedSubGenre) {
                return res.status(404).json({ success: false, error: 'Sub-genre not found.' });
            }

            res.status(200).json({ success: true, message: 'Sub-genre and its image deleted successfully.' });
        } catch (error) {
            console.error("Error deleting sub-genre:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    };
