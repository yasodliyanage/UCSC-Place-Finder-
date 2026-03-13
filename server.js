import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API route to get places data
app.get('/api/places', (req, res) => {
  try {
    // Read the places.json file
    const placesData = fs.readFileSync(path.join(__dirname, 'places.json'), 'utf-8');
    const places = JSON.parse(placesData);
    
    // Send the parsed JSON data as the response
    res.json(places);
  } catch (error) {
    console.error('Error reading places.json:', error);
    res.status(500).json({ error: 'Failed to load places data' });
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
