const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for videos and images
const fileFilter = (req, file, cb) => {
  // Allowed video formats
  const videoTypes = /mp4|avi|mov|wmv|flv|webm|mkv/;
  // Allowed image formats
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  
  const extname = videoTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  imageTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/');
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only video and image files are allowed!'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: fileFilter
});

// Middleware for single video upload
const uploadVideo = upload.single('video');

// Middleware for single image upload
const uploadImage = upload.single('coverImage');

// Middleware for multiple file upload
const uploadMultiple = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]);

// Error handling middleware
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large. Maximum size is 100MB.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Unexpected field name in file upload.'
      });
    }
  }
  
  if (error.message === 'Only video and image files are allowed!') {
    return res.status(400).json({
      message: 'Invalid file type. Only video and image files are allowed.'
    });
  }
  
  return res.status(500).json({
    message: 'File upload error.',
    error: error.message
  });
};

// Clean up temporary files
const cleanupTempFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

module.exports = {
  upload,
  uploadVideo,
  uploadImage,
  uploadMultiple,
  handleUploadError,
  cleanupTempFile
};
