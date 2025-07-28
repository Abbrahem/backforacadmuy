const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload image to Cloudinary
const uploadImage = async (file, folder = 'areeb/images') => {
  try {
    console.log('Uploading image to Cloudinary...');
    console.log('File:', file);
    console.log('Folder:', folder);
    
    // Handle different file formats
    let uploadOptions = {
      folder: folder,
      resource_type: 'image'
    };

    // If file is a buffer, convert to base64
    if (file.buffer) {
      const base64Data = file.buffer.toString('base64');
      const dataURI = `data:${file.mimetype};base64,${base64Data}`;
      
      const result = await cloudinary.uploader.upload(dataURI, uploadOptions);
      
      return {
        secure_url: result.secure_url,
        public_id: result.public_id
      };
    }
    
    // If file is a path or stream
    const filePath = file.path || file;
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    
    return {
      secure_url: result.secure_url,
      public_id: result.public_id
    };
  } catch (error) {
    console.error('Image upload error:', error);
    console.error('Error details:', error.message);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

// Upload video to Cloudinary
const uploadVideo = async (file, folder = 'areeb/videos') => {
  try {
    console.log('Uploading video to Cloudinary...');
    
    let uploadOptions = {
      folder: folder,
      resource_type: 'video'
    };

    // If file is a buffer, convert to base64
    if (file.buffer) {
      const base64Data = file.buffer.toString('base64');
      const dataURI = `data:${file.mimetype};base64,${base64Data}`;
      
      const result = await cloudinary.uploader.upload(dataURI, uploadOptions);
      
      return {
        secure_url: result.secure_url,
        public_id: result.public_id,
        duration: result.duration,
        thumbnail_url: result.thumbnail_url
      };
    }
    
    // If file is a path or stream
    const filePath = file.path || file;
    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
      duration: result.duration,
      thumbnail_url: result.thumbnail_url
    };
  } catch (error) {
    console.error('Video upload error:', error);
    console.error('Error details:', error.message);
    throw new Error(`Failed to upload video: ${error.message}`);
  }
};

// Delete file from Cloudinary
const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    
    return result.result === 'ok';
  } catch (error) {
    console.error('Delete file error:', error);
    throw new Error('Failed to delete file');
  }
};

// Get video info from Cloudinary
const getVideoInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: 'video'
    });
    
    return {
      duration: result.duration,
      format: result.format,
      size: result.bytes,
      url: result.secure_url,
      thumbnail: result.thumbnail_url
    };
  } catch (error) {
    console.error('Get video info error:', error);
    throw new Error('Failed to get video info');
  }
};

module.exports = {
  uploadImage,
  uploadVideo,
  deleteFile,
  getVideoInfo
};
