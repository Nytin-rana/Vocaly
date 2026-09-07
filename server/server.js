require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const refDir = path.join(__dirname, '../public/uploads/references');
const genDir = path.join(__dirname, '../public/uploads/generations');
if (!fs.existsSync(refDir)) fs.mkdirSync(refDir, { recursive: true });
if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, refDir),
  filename: (req, file, cb) => cb(null, `ref_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// Endpoint 1: Programmatically create a Voice ID via Fish Audio API
app.post('/api/voices', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
  
  try {
    const formData = new FormData();
    formData.append('title', req.body.name || "Vocaly Agent");
    formData.append('type', 'tts');
    formData.append('visibility', 'private');
    formData.append('train_mode', 'fast');
    formData.append('texts', req.body.reference_text || "");

    const audioBuffer = fs.readFileSync(req.file.path);
    const fileName = req.file.originalname || 'reference.wav';
    const mimeType = req.file.mimetype || 'audio/wav';
    const audioFile = new File([audioBuffer], fileName, { type: mimeType });
    formData.append('voices', audioFile);

    const response = await fetch("https://api.fish.audio/model", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.FISH_API_KEY}` },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create Voice ID: ${errorText}`);
    }

    const data = await response.json();
    res.json({ 
      referenceUrl: data._id, 
      label: req.body.name, 
      referenceText: req.body.reference_text 
    });

  } catch (error) {
    console.error('Create Voice Error:', error);
    res.status(500).json({ error: 'Failed to create voice model on Fish Audio.' });
  }
});

// Endpoint 2: Delete a Voice ID from Fish Audio
app.delete('/api/voices/:id', async (req, res) => {
  try {
    const response = await fetch(`https://api.fish.audio/model/${req.params.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${process.env.FISH_API_KEY}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete Voice ID: ${errorText}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete Voice Error:', error);
    res.status(500).json({ error: 'Failed to delete voice model on Fish Audio.' });
  }
});

// Endpoint 3: Generate TTS
app.post('/api/generate', async (req, res) => {
  const { text, reference_url } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text.' });

  try {
    const payload = { text: text, format: "mp3" };
    if (reference_url && reference_url.length > 8) {
      payload.reference_id = reference_url;
    }

    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.FISH_API_KEY}`,
        "Content-Type": "application/json",
        "model": "s2.1-pro-free" 
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fish Audio API Error: ${response.status} ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const genFileName = `gen_${Date.now()}.mp3`;
    const genFilePath = path.join(genDir, genFileName);
    fs.writeFileSync(genFilePath, Buffer.from(arrayBuffer));

    res.json({ audio_url: `/uploads/generations/${genFileName}` });
  } catch (error) {
    console.error('Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate TTS audio.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Vocaly server running on http://localhost:${PORT}`);
});