(() => {
  'use strict';

  /* ---------------------------------------------------------
     State & storage
  --------------------------------------------------------- */
  const STORAGE_KEY_HISTORY = 'vocaly_history';
  const STORAGE_KEY_VOICES  = 'vocaly_custom_voices';
  const STORAGE_KEY_CREDITS = 'vocaly_credits';

  // UPDATE THIS ARRAY with your Fish Audio Voice ID
  const DEFAULT_AGENTS = [
    { label: 'Ethan', referenceUrl: '536d3a5e000945adb7038665781a4aca' },
    { label: 'E-Girl', referenceUrl: '98655a12fa944e26b274c535e5e03842' }
   
  ];
  let history = loadJSON(STORAGE_KEY_HISTORY, []);
  let customVoices = loadJSON(STORAGE_KEY_VOICES, []); 
  let credits = loadJSON(STORAGE_KEY_CREDITS, 12);
  let engineVoices = [];
  let currentUtterance = null;
  let currentAudio = null;
  let currentlyPlayingId = null;

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  /* ---------------------------------------------------------
     Elements
  --------------------------------------------------------- */
  const form           = document.getElementById('generator-form');
  const scriptInput    = document.getElementById('script-input');
  const charCountEl    = document.getElementById('char-count');
  const voiceSelect    = document.getElementById('voice-select');
  const generateBtn    = document.getElementById('generate-btn');
  const deleteVoiceBtn = document.getElementById('delete-voice-btn');
  const waveform       = document.getElementById('waveform');
  const creditsCountEl = document.getElementById('credits-count');

  const newVoiceBtn    = document.getElementById('new-voice-btn');
  const modalOverlay   = document.getElementById('modal-overlay');
  const modalClose     = document.getElementById('modal-close');
  const newVoiceName   = document.getElementById('new-voice-name');
  const newVoiceBase   = document.getElementById('new-voice-base');
  const referenceAudio = document.getElementById('reference-audio');
  const referenceText  = document.getElementById('reference-text');
  const saveVoiceBtn   = document.getElementById('save-voice-btn');

  const historyList    = document.getElementById('history-list');
  const emptyState     = document.getElementById('empty-state');
  const clearHistoryBtn= document.getElementById('clear-history-btn');
  const toastEl        = document.getElementById('toast');

  /* ---------------------------------------------------------
     Toast helper
  --------------------------------------------------------- */
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 2400);
  }

  scriptInput.addEventListener('input', () => {
    charCountEl.textContent = scriptInput.value.length;
  });

  /* ---------------------------------------------------------
     Voice list & Deletion
  --------------------------------------------------------- */
  function populateEngineVoiceOptions(selectEl, voices) {
    selectEl.innerHTML = '';
    voices.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${v.name} (${v.lang})`;
      selectEl.appendChild(opt);
    });
  }

  function refreshVoiceSelect() {
    voiceSelect.innerHTML = '';

    DEFAULT_AGENTS.forEach((agent, i) => {
      const opt = document.createElement('option');
      opt.value = `default:${i}`;
      opt.textContent = `Voice : ${agent.label}`;
      voiceSelect.appendChild(opt);
    });

    customVoices.forEach((cv, i) => {
      const opt = document.createElement('option');
      opt.value = `custom:${i}`;
      opt.textContent = `Voice : ${cv.label}`;
      voiceSelect.appendChild(opt);
    });
    
    updateDeleteButtonVisibility();
  }

  function updateDeleteButtonVisibility() {
    if (voiceSelect.value && voiceSelect.value.startsWith('custom:')) {
      deleteVoiceBtn.style.display = 'flex';
    } else {
      deleteVoiceBtn.style.display = 'none';
    }
  }
  
  voiceSelect.addEventListener('change', updateDeleteButtonVisibility);

  deleteVoiceBtn.addEventListener('click', async () => {
    const val = voiceSelect.value;
    if (!val.startsWith('custom:')) return;

    const idx = Number(val.split(':')[1]);
    const cv = customVoices[idx];
    
    if (!confirm(`Are you sure you want to delete "${cv.label}"?`)) return;

    deleteVoiceBtn.style.opacity = '0.5';
    deleteVoiceBtn.style.pointerEvents = 'none';

    try {
      if (cv.referenceUrl && cv.referenceUrl.length > 8) {
        await fetch(`/api/voices/${cv.referenceUrl}`, { method: 'DELETE' });
      }
      
      customVoices.splice(idx, 1);
      saveJSON(STORAGE_KEY_VOICES, customVoices);
      refreshVoiceSelect();
      toast('Voice deleted.');
    } catch (e) {
      toast('Could not fully delete voice.');
    } finally {
      deleteVoiceBtn.style.opacity = '1';
      deleteVoiceBtn.style.pointerEvents = 'auto';
    }
  });

  function loadEngineVoices() {
    engineVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    if (newVoiceBase) populateEngineVoiceOptions(newVoiceBase, engineVoices);
  }

  if ('speechSynthesis' in window) {
    loadEngineVoices();
    window.speechSynthesis.onvoiceschanged = loadEngineVoices;
  }

  refreshVoiceSelect();

  function resolveEngineVoiceForSelection(value) {
    if (!engineVoices.length) return null;
    if (value.startsWith('custom:')) {
      const idx = Number(value.split(':')[1]);
      const cv = customVoices[idx];
      if (cv) {
        const match = engineVoices.find(v => v.voiceURI === cv.engineVoiceURI);
        if (match) return match;
      }
    }
    if (value.startsWith('default:')) {
      const idx = Number(value.split(':')[1]);
      return engineVoices[idx % engineVoices.length] || engineVoices[0];
    }
    return engineVoices[0];
  }

  function currentVoiceLabel() {
    const opt = voiceSelect.options[voiceSelect.selectedIndex];
    return opt ? opt.textContent.replace(/^Voice\s*:\s*/, '') : 'Agent 1';
  }

  function estimateDuration(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round((words / 150) * 60));
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
  }

  function timeAgoLabel(ts) {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
  }

  /* ---------------------------------------------------------
     Generate via Local Server API
  --------------------------------------------------------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = scriptInput.value.trim();
    if (!text) { toast("Write something first — the mic's waiting."); return; }
    if (credits <= 0) { toast('Out of credits for today.'); return; }

    const voiceValue = voiceSelect.value;
    const voiceLabel = currentVoiceLabel();
    
    // Find the actual config for the selected voice
    let selectedVoice = null;
    if (voiceValue.startsWith('custom:')) {
      selectedVoice = customVoices[Number(voiceValue.split(':')[1])];
    } else if (voiceValue.startsWith('default:')) {
      selectedVoice = DEFAULT_AGENTS[Number(voiceValue.split(':')[1])];
    }

    generateBtn.disabled = true;
    generateBtn.querySelector('.btn-label').textContent = 'Generating…';
    waveform.classList.add('active');

    try {
      // If the voice has a Fish Audio referenceUrl, send it to the backend
      if (selectedVoice && selectedVoice.referenceUrl) {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text, 
            reference_url: selectedVoice.referenceUrl,
            reference_text: selectedVoice.referenceText || ""
          }),
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Backend generation failed.');

        const entry = {
          id: `gen_${Date.now()}`,
          text,
          voiceLabel,
          voiceValue,
          duration: estimateDuration(text),
          createdAt: Date.now(),
          audioUrl: data.audio_url,
        };
        saveGeneration(entry);
        toast('Voiceover generated successfully.');
      } else {
        // Fallback to offline browser speech
        const entry = {
          id: `gen_${Date.now()}`,
          text,
          voiceLabel,
          voiceValue,
          duration: estimateDuration(text),
          createdAt: Date.now(),
          audioUrl: null,
        };
        saveGeneration(entry);
        toast('Voiceover ready in browser speech.');
      }
    } catch (error) {
      toast(error.message || 'Could not generate the voiceover.');
    } finally {
      generateBtn.disabled = false;
      generateBtn.querySelector('.btn-label').textContent = 'Generate';
      waveform.classList.remove('active');
    }
  });

  function saveGeneration(entry) {
    history.unshift(entry);
    history = history.slice(0, 50);
    saveJSON(STORAGE_KEY_HISTORY, history);
    renderHistory();

    credits = Math.max(0, credits - 1);
    saveJSON(STORAGE_KEY_CREDITS, credits);
    creditsCountEl.textContent = credits;
    speakEntry(entry);
  }

  /* ---------------------------------------------------------
     Speech playback
  --------------------------------------------------------- */
  function speakEntry(entry) {
    stopSpeaking();
    if (entry.audioUrl) {
      currentAudio = new Audio(entry.audioUrl);
      currentlyPlayingId = entry.id;
      setPlayingUI(entry.id, true);
      currentAudio.onended = () => {
        setPlayingUI(entry.id, false);
        currentlyPlayingId = null;
        currentAudio = null;
      };
      currentAudio.onerror = () => {
        setPlayingUI(entry.id, false);
        currentlyPlayingId = null;
        currentAudio = null;
        toast('The audio could not be played.');
      };
      currentAudio.play().catch(() => toast('Playback blocked.'));
      return;
    }
    
    if (!('speechSynthesis' in window)) return;
    
    const utter = new SpeechSynthesisUtterance(entry.text);
    const voice = resolveEngineVoiceForSelection(entry.voiceValue);
    if (voice) utter.voice = voice;

    currentUtterance = utter;
    currentlyPlayingId = entry.id;
    setPlayingUI(entry.id, true);

    utter.onend = () => { setPlayingUI(entry.id, false); currentlyPlayingId = null; };
    utter.onerror = () => { setPlayingUI(entry.id, false); currentlyPlayingId = null; };

    window.speechSynthesis.speak(utter);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (currentlyPlayingId) setPlayingUI(currentlyPlayingId, false);
    currentlyPlayingId = null;
  }

  function setPlayingUI(id, isPlaying) {
    const btn = historyList.querySelector(`[data-id="${id}"] .play-btn`);
    if (!btn) return;
    btn.classList.toggle('playing', isPlaying);
    btn.innerHTML = isPlaying ? iconPause() : iconPlay();
  }

  /* ---------------------------------------------------------
     Icons
  --------------------------------------------------------- */
  function iconPlay() { return `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`; }
  function iconPause() { return `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>`; }
  function iconTrash() { return `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
  function iconCopy() { return `<svg viewBox="0 0 24 24" width="16" height="16"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`; }

  /* ---------------------------------------------------------
     Render history
  --------------------------------------------------------- */
  function renderHistory() {
    historyList.innerHTML = '';
    if (!history.length) { emptyState.classList.add('visible'); return; }
    emptyState.classList.remove('visible');

    history.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.dataset.id = entry.id;

      item.innerHTML = `
        <button class="play-btn" aria-label="Play">${iconPlay()}</button>
        <div class="item-body">
          <div class="item-top-row">
            <span class="voice-tag">${escapeHTML(entry.voiceLabel)}</span>
            <span class="item-meta">${formatDuration(entry.duration)} · ${timeAgoLabel(entry.createdAt)}</span>
          </div>
          <p class="item-text">${escapeHTML(entry.text)}</p>
        </div>
        <div class="item-actions">
          <button class="icon-btn copy-btn" aria-label="Copy text">${iconCopy()}</button>
          <button class="icon-btn delete-btn" aria-label="Delete">${iconTrash()}</button>
        </div>
      `;

      item.querySelector('.play-btn').addEventListener('click', () => {
        if (currentlyPlayingId === entry.id) stopSpeaking();
        else speakEntry(entry);
      });

      item.querySelector('.copy-btn').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(entry.text);
          toast('Text copied to clipboard.');
        } catch { toast('Could not copy.'); }
      });

      item.querySelector('.delete-btn').addEventListener('click', () => {
        if (currentlyPlayingId === entry.id) stopSpeaking();
        history = history.filter(h => h.id !== entry.id);
        saveJSON(STORAGE_KEY_HISTORY, history);
        renderHistory();
      });

      historyList.appendChild(item);
    });
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  clearHistoryBtn.addEventListener('click', () => {
    if (!history.length) return;
    stopSpeaking();
    history = [];
    saveJSON(STORAGE_KEY_HISTORY, history);
    renderHistory();
    toast('History cleared.');
  });

  /* ---------------------------------------------------------
     Create-a-new-voice modal
  --------------------------------------------------------- */
  function openModal() {
    loadEngineVoices();
    modalOverlay.classList.add('visible');
    newVoiceName.focus();
  }
  function closeModal() {
    modalOverlay.classList.remove('visible');
    newVoiceName.value = '';
    referenceAudio.value = '';
    referenceText.value = '';
  }

  newVoiceBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  saveVoiceBtn.addEventListener('click', async () => {
    const label = newVoiceName.value.trim();
    if (!label) { toast('Give your voice a name first.'); return; }
    if (!referenceAudio.files.length) { toast('Choose a reference audio file first.'); return; }

    const baseIdx = Number(newVoiceBase.value || 0);
    const baseVoice = engineVoices[baseIdx];

    saveVoiceBtn.disabled = true;
    try {
      const formData = new FormData();
      formData.append('name', label);
      formData.append('audio', referenceAudio.files[0]);
      formData.append('reference_text', referenceText.value.trim());

      const response = await fetch('/api/voices', { 
        method: 'POST', 
        body: formData 
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save voice.');

      const newCustomVoice = {
        id: `voice_${Date.now()}`,
        label: label,
        engineVoiceURI: baseVoice ? baseVoice.voiceURI : null,
        referenceUrl: data.referenceUrl,
        referenceText: data.referenceText
      };
      
      customVoices.push(newCustomVoice);
      saveJSON(STORAGE_KEY_VOICES, customVoices);
      refreshVoiceSelect();
      voiceSelect.value = `custom:${customVoices.length - 1}`;
      updateDeleteButtonVisibility();
      
      closeModal();
      toast(`"${label}" added to your voices.`);
    } catch (error) {
      toast(error.message || 'Could not save voice.');
    } finally {
      saveVoiceBtn.disabled = false;
    }
  });

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  creditsCountEl.textContent = credits;
  renderHistory();
})();