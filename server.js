import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const type = req.body.type || 'others';
    const dir = path.join(__dirname, 'uploads', type);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route for admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API route to handle image uploads
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const type = req.body.type || 'others';
  const fileUrl = `/uploads/${type}/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// API route to delete files
app.post('/api/delete-file', (req, res) => {
  const { filePath } = req.body;
  
  if (!filePath || !filePath.startsWith('/uploads/')) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  // Security: prevent path traversal
  const relativePath = filePath.replace(/^\/uploads\//, '');
  const fullPath = path.join(__dirname, 'uploads', relativePath);

  // Check if file exists and is within uploads directory
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      console.log(`File deleted: ${fullPath}`);
      res.json({ success: true });
    } catch (err) {
      console.error(`Error deleting file ${fullPath}:`, err);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// API route to get places data
app.get('/api/places', (req, res) => {
  try {
    const placesData = fs.readFileSync(path.join(__dirname, 'places.json'), 'utf-8');
    const places = JSON.parse(placesData);
    res.json(places);
  } catch (error) {
    console.error('Error reading places.json:', error);
    res.status(500).json({ error: 'Failed to load places data' });
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  const dirs = ['uploads/locations', 'uploads/floorplans', 'uploads/others'];
  dirs.forEach(d => {
    const dirPath = path.join(__dirname, d);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
  console.log(`Server running on http://localhost:${PORT}`);
});
