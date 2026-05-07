import multer from "multer";

// Memory storage for temporary file handling (files get uploaded to S3)
const storage = multer.memoryStorage();

import path from "path";

// File filter - only accept images and handle edge cases
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.tiff', '.tif', '.bmp', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();

  // Check if it's explicitly an image mimetype, OR if the file extension is a known image type 
  // (handles edge cases like iOS HEIC files uploading as application/octet-stream)
  if (file.mimetype.startsWith("image/") || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed. Please upload a valid image format."));
  }
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per file
  }
});

export default upload;