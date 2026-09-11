# Vocaly

Vocaly is a lightweight text-to-speech web app for generating voiceovers from text using custom voice cloning and browser-based speech fallback. It combines a simple frontend interface with a Node.js backend that integrates with the Fish Audio API for voice generation and custom voice creation.

## Overview

Vocaly lets users:

- Type or paste a script
- Choose from built-in or custom voice profiles
- Generate a voiceover in seconds
- Listen to previous generations from a history panel
- Create new custom voices by uploading a reference audio sample
- Save and reuse generated scripts in the browser

The app is designed to feel fast and simple: a single textarea, a voice picker, a generation button, and a history area for recent results.

## Features

- Text-to-speech generation from a browser UI
- Fish Audio integration for custom voice creation and TTS generation
- Built-in default voices such as Ethan and E-Girl
- Custom voice creation flow with:
  - voice name
  - reference audio upload
  - optional transcript text
- Voice deletion support for custom profiles
- History tracking for generated scripts
- Credits-based generation counter
- Local fallback to browser speech synthesis when no custom voice is available

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js + Express
- Media upload handling: Multer
- API integration: Fish Audio
- Storage: browser localStorage for history, voice profiles, and credits

## Project Structure

- `public/` — frontend UI and static assets
  - `index.html` — main app interface
  - `script.js` — app logic, voice selection, history, generation flow
  - `style.css` — styling and layout
  - `uploads/` — generated audio and reference files
- `server/` — backend API server
  - `server.js` — Express routes for voice creation, deletion, and TTS generation
  - `package.json` — Node dependencies and scripts

## Setup

1. Open the server folder:
   
   ```bash
   cd server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the `server` folder with your Fish Audio API key:

   ```env
   FISH_API_KEY=your_api_key_here
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open the app in your browser at:

   ```text
   http://localhost:3000
   ```

## How It Works

1. The frontend collects the script text and selected voice.
2. If a custom voice is selected, the frontend requests TTS generation from the backend.
3. The backend sends the request to Fish Audio using the configured API key.
4. The generated MP3 is saved in the uploads directory and returned as a URL.
5. The UI stores the generation in local history and plays the generated audio back in-browser.

## Notes

- The app uses a small credits system to limit generations.
- Default voices are configured in the frontend script and can be updated as needed.
- Custom voice models are created by uploading a reference sample and optional transcript.
- If a voice is not available from Fish Audio, the app falls back to the browser's built-in speech synthesis.

## License

This project is a prototype/demo app for voice generation experiments and can be adapted for personal or commercial use depending on your chosen API and deployment setup.

