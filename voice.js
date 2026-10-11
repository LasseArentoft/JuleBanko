/*
 * Stemme til Julebanko
 * - vælg og tun computerstemmen
 * - optag din egen stemme (1-90 + "Banko!"). Optagelserne gemmes kun i denne browser
 *   (IndexedDB) og sendes aldrig nogen steder hen.
 * Eksponerer window.JuleVoice.say(n) og window.JuleVoice.sayBanko(gevinst).
 */
(() => {
  "use strict";

  const MAX = 90;
  const KEYS = Array.from({ length: MAX }, (_, i) => "n" + (i + 1)).concat(["banko"]);
  const labelOf = (k) => (k === "banko" ? "Banko!" : k.slice(1));

  const PREF = { voice: "julebanko-stemme-valg", rate: "julebanko-stemme-tempo", own: "julebanko-egen-stemme" };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  const $ = (id) => document.getElementById(id);
  const dialog = $("voiceDialog");
  if (!dialog) return;

  const voiceBtn = $("voiceBtn");
  const voiceSelect = $("voiceSelect");
  const voiceNote = $("voiceNote");
  const rateRange = $("rateRange");
  const voiceTest = $("voiceTest");
  const ownToggle = $("ownToggle");
  const recCount = $("recCount");
  const recPrompt = $("recPrompt");
  const recLevel = $("recLevel");
  const recStatus = $("recStatus");
  const recStart = $("recStart");
  const recStop = $("recStop");
  const recSkip = $("recSkip");
  const recGrid = $("recGrid");
  const recExport = $("recExport");
  const recImport = $("recImport");
  const recImportFile = $("recImportFile");
  const recDelete = $("recDelete");

  // ---------------------------------------------------------------- IndexedDB
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) return reject(new Error("Ingen IndexedDB"));
        let req;
        try { req = indexedDB.open("julebanko-stemme", 1); } catch (e) { return reject(e); }
        req.onupgradeneeded = () => req.result.createObjectStore("clips");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }
  function withStore(mode, fn) {
    return db().then((d) => new Promise((resolve, reject) => {
      const t = d.transaction("clips", mode);
      const result = fn(t.objectStore("clips"));
      t.oncomplete = () => resolve(result && result.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }
  const idbPut = (key, buf) => withStore("readwrite", (s) => s.put(buf, key));
  const idbClear = () => withStore("readwrite", (s) => s.clear());
  function idbAll() {
    return db().then((d) => new Promise((resolve, reject) => {
      const out = {};
      const c = d.transaction("clips").objectStore("clips").openCursor();
      c.onsuccess = () => {
        const cur = c.result;
        if (cur) { out[cur.key] = cur.value; cur.continue(); } else resolve(out);
      };
      c.onerror = () => reject(c.error);
    }));
  }

  // ------------------------------------------------------------- Lydklip i RAM
  const clips = new Map(); // key -> { url, buf }
  function setClip(key, buf) {
    const old = clips.get(key);
    if (old) URL.revokeObjectURL(old.url);
    clips.set(key, { buf, url: URL.createObjectURL(new Blob([buf], { type: "audio/wav" })) });
  }

  let currentAudio = null;
  function stopAudio() {
    if (currentAudio) { try { currentAudio.pause(); } catch (e) {} currentAudio = null; }
  }
  function playClip(key) {
    const c = clips.get(key);
    if (!c) return Promise.resolve(false);
    stopAudio();
    const a = new Audio(c.url);
    currentAudio = a;
    return a.play().then(() => true).catch(() => false);
  }

  // -------------------------------------------------------------- Computerstemme
  const hasTts = "speechSynthesis" in window;
  let voices = [];

  function pickVoice() {
    const uri = store.get(PREF.voice, "");
    return (
      voices.find((v) => v.voiceURI === uri) ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("da")) ||
      null
    );
  }

  function tts(text) {
    if (!hasTts) return;
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "da-DK"; }
    u.rate = parseFloat(store.get(PREF.rate, "0.9")) || 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  function populateVoices() {
    if (!hasTts) {
      voiceSelect.disabled = true;
      voiceTest.disabled = true;
      voiceNote.textContent = "Din browser har ingen computerstemme. Optag din egen stemme herunder.";
      return;
    }
    voices = speechSynthesis.getVoices();
    const saved = store.get(PREF.voice, "");
    const da = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("da"));
    const other = voices.filter((v) => !da.includes(v));

    voiceSelect.innerHTML = "";
    const auto = new Option("Automatisk (dansk, hvis den findes)", "");
    voiceSelect.add(auto);
    const addGroup = (label, list) => {
      if (!list.length) return;
      const g = document.createElement("optgroup");
      g.label = label;
      list.forEach((v) => g.appendChild(new Option(v.name + " (" + v.lang + ")", v.voiceURI)));
      voiceSelect.appendChild(g);
    };
    addGroup("Dansk", da);
    addGroup("Andre sprog", other);
    voiceSelect.value = voices.some((v) => v.voiceURI === saved) ? saved : "";

    voiceNote.textContent = da.length
      ? ""
      : "Din enhed har ingen dansk computerstemme. Optag din egen stemme herunder, eller prøv en anden enhed.";
  }

  if (hasTts) {
    populateVoices();
    speechSynthesis.addEventListener("voiceschanged", populateVoices);
  } else {
    populateVoices();
  }

  voiceSelect.addEventListener("change", () => store.set(PREF.voice, voiceSelect.value));
  rateRange.value = store.get(PREF.rate, "0.9");
  rateRange.addEventListener("input", () => store.set(PREF.rate, rateRange.value));
  voiceTest.addEventListener("click", () => tts(String(1 + Math.floor(Math.random() * MAX))));

  // ---------------------------------------------------------------- Offentligt API
  const ownOn = () => store.get(PREF.own, "1") === "1";

  function say(n) {
    const key = "n" + n;
    stopAudio();
    if (ownOn() && clips.has(key)) {
      playClip(key).then((ok) => { if (!ok) tts(String(n)); });
    } else {
      tts(String(n));
    }
  }

  function sayBanko(prize) {
    stopAudio();
    const text = "Banko på " + String(prize).toLowerCase();
    if (ownOn() && clips.has("banko")) {
      playClip("banko").then((ok) => { if (!ok) tts(text); });
    } else {
      tts(text);
    }
  }

  window.JuleVoice = { say, sayBanko };

  // ------------------------------------------------------------------ Dialog / UI
  voiceBtn.addEventListener("click", () => {
    refreshGrid();
    dialog.showModal();
  });
  dialog.addEventListener("close", () => { stopRecording(); stopAudio(); });

  ownToggle.checked = ownOn();
  ownToggle.addEventListener("change", () => store.set(PREF.own, ownToggle.checked ? "1" : "0"));

  const chipEls = {};
  KEYS.forEach((key) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = labelOf(key);
    b.className = key === "banko" ? "banko-chip" : "";
    b.setAttribute("aria-label", key === "banko" ? "Banko" : "Nummer " + labelOf(key));
    b.addEventListener("click", () => {
      target = key;
      updatePrompt();
      if (clips.has(key)) playClip(key);
      if (recording) { setStatus("Sig: " + labelOf(key)); }
    });
    recGrid.appendChild(b);
    chipEls[key] = b;
  });

  function refreshGrid() {
    let done = 0;
    KEYS.forEach((key) => {
      const has = clips.has(key);
      chipEls[key].classList.toggle("done", has);
      chipEls[key].classList.toggle("active", key === target);
      if (has) done++;
    });
    recCount.textContent = done + " af " + KEYS.length + " optaget";
    recDelete.disabled = done === 0;
    recExport.disabled = done === 0;
  }

  function setStatus(text) { recStatus.textContent = text; }

  function updatePrompt() {
    recPrompt.textContent = target ? labelOf(target) : "–";
    refreshGrid();
  }

  function nextTarget(from) {
    const start = from ? KEYS.indexOf(from) : -1;
    for (let i = 1; i <= KEYS.length; i++) {
      const k = KEYS[(start + i) % KEYS.length];
      if (!clips.has(k)) return k;
    }
    return null;
  }

  // ------------------------------------------------------------------- Optagelse
  let target = null;
  let recording = false;
  let stream = null;
  let ctx = null;
  let source = null;
  let proc = null;
  let sink = null;

  // VAD-tilstand
  let state = "calibrating"; // calibrating | idle | speaking | cooldown
  let calSum = 0;
  let calMs = 0;
  let threshold = 0.03;
  let preroll = [];
  let clipChunks = [];
  let silenceMs = 0;
  let loudChunks = 0;
  let cooldownUntil = 0;

  async function startRecording() {
    if (recording) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("Browseren giver ikke adgang til mikrofonen her. Brug en nyere browser, og åbn siden via https.");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      setStatus("Jeg fik ikke adgang til mikrofonen. Tillad mikrofon i browseren, og prøv igen.");
      return;
    }
    try {
      await db();
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("Browseren tillader ikke, at optagelserne gemmes her (måske privat vindue). Brug et almindeligt vindue.");
      return;
    }

    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    if (ctx.state === "suspended") await ctx.resume();
    source = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(2048, 1, 1);
    sink = ctx.createGain();
    sink.gain.value = 0; // intet lyd i højttalerne (undgår rundgang)
    source.connect(proc);
    proc.connect(sink);
    sink.connect(ctx.destination);
    proc.onaudioprocess = (e) => handleChunk(new Float32Array(e.inputBuffer.getChannelData(0)));

    state = "calibrating";
    calSum = 0; calMs = 0; preroll = []; clipChunks = []; silenceMs = 0; loudChunks = 0;
    recording = true;
    if (!target) target = nextTarget(null) || KEYS[0];
    updatePrompt();
    recStart.hidden = true;
    recStop.hidden = false;
    setStatus("Et øjeblik … vær helt stille, mens jeg måler baggrundsstøjen.");
  }

  function stopRecording() {
    if (!recording && !stream) return;
    recording = false;
    try { if (proc) { proc.onaudioprocess = null; proc.disconnect(); } } catch (e) {}
    try { if (source) source.disconnect(); } catch (e) {}
    try { if (sink) sink.disconnect(); } catch (e) {}
    try { if (ctx) ctx.close(); } catch (e) {}
    if (stream) stream.getTracks().forEach((t) => t.stop());
    proc = source = sink = ctx = stream = null;
    recLevel.style.transform = "scaleX(0)";
    recStart.hidden = false;
    recStop.hidden = true;
  }

  function rmsOf(f) {
    let s = 0;
    for (let i = 0; i < f.length; i++) s += f[i] * f[i];
    return Math.sqrt(s / f.length);
  }

  function handleChunk(f) {
    if (!recording || !ctx) return;
    const chunkMs = (f.length / ctx.sampleRate) * 1000;
    const rms = rmsOf(f);
    recLevel.style.transform = "scaleX(" + Math.min(1, rms * 9) + ")";
    const now = performance.now();

    if (state === "calibrating") {
      calSum += rms; calMs += chunkMs;
      if (calMs >= 700) {
        const noise = calSum / Math.max(1, calMs / chunkMs);
        threshold = Math.max(0.02, noise * 4);
        state = "idle";
        setStatus("Sig: " + labelOf(target));
      }
      return;
    }

    if (state === "cooldown") {
      preroll.push(f);
      if (preroll.length > Math.ceil(350 / chunkMs)) preroll.shift();
      if (now >= cooldownUntil) state = "idle";
      return;
    }

    if (state === "idle") {
      preroll.push(f);
      const keep = Math.ceil(350 / chunkMs);
      if (preroll.length > keep) preroll.shift();
      if (rms > threshold) {
        loudChunks++;
        if (loudChunks >= 2) {
          state = "speaking";
          clipChunks = preroll.slice();
          preroll = [];
          silenceMs = 0;
        }
      } else {
        loudChunks = 0;
      }
      return;
    }

    if (state === "speaking") {
      clipChunks.push(f);
      if (rms > threshold * 0.7) { silenceMs = 0; loudChunks++; } else { silenceMs += chunkMs; }
      const total = clipChunks.length * chunkMs;
      if (silenceMs >= 650 || total >= 3500) finishClip(ctx.sampleRate, chunkMs);
    }
  }

  function finishClip(rate, chunkMs) {
    const chunks = clipChunks;
    clipChunks = [];
    const spoken = loudChunks * chunkMs;
    loudChunks = 0;
    silenceMs = 0;

    if (spoken < 160) {
      // klik eller hoste – smid væk
      state = "idle";
      return;
    }

    const key = target;
    let samples = concat(chunks);
    samples = trimAndClean(samples, rate, threshold);
    let outRate = rate;
    if (rate >= 40000) { samples = halve(samples); outRate = Math.round(rate / 2); }
    const wav = encodeWav(samples, outRate);

    state = "cooldown";
    preroll = [];
    cooldownUntil = performance.now() + 150;
    setStatus("Gemmer " + labelOf(key) + " …");

    idbPut(key, wav).then(() => {
      setClip(key, wav);
      const nxt = nextTarget(key);
      if (!nxt) {
        refreshGrid();
        target = key;
        stopRecording();
        setStatus("Færdig! Alle numre er optaget. Tryk på et tal for at høre det eller optage det igen.");
        return;
      }
      target = nxt;
      updatePrompt();
      setStatus("✓ " + labelOf(key) + " gemt. Næste: " + labelOf(nxt));
    }).catch(() => {
      setStatus("Kunne ikke gemme optagelsen i browseren.");
    });
  }

  function concat(chunks) {
    let n = 0;
    chunks.forEach((c) => { n += c.length; });
    const out = new Float32Array(n);
    let o = 0;
    chunks.forEach((c) => { out.set(c, o); o += c.length; });
    return out;
  }

  // Beskær stilhed, lad lidt luft stå, normalisér lydstyrken og lav bløde kanter
  function trimAndClean(s, rate, thr) {
    const win = Math.round(rate * 0.01);
    const level = thr * 0.6;
    let first = 0;
    let last = s.length - 1;
    const loud = (i) => {
      let sum = 0;
      const end = Math.min(s.length, i + win);
      for (let k = i; k < end; k++) sum += s[k] * s[k];
      return Math.sqrt(sum / (end - i)) > level;
    };
    while (first < s.length - win && !loud(first)) first += win;
    while (last > win && !loud(last - win)) last -= win;
    first = Math.max(0, first - Math.round(rate * 0.08));
    last = Math.min(s.length, last + Math.round(rate * 0.15));
    const out = s.slice(first, last);

    let peak = 0;
    for (let i = 0; i < out.length; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; }
    const gain = peak > 0.001 ? Math.min(0.9 / peak, 12) : 1;
    const fade = Math.round(rate * 0.01);
    for (let i = 0; i < out.length; i++) {
      let g = gain;
      if (i < fade) g *= i / fade;
      if (out.length - 1 - i < fade) g *= (out.length - 1 - i) / fade;
      out[i] *= g;
    }
    return out;
  }

  function halve(s) {
    const out = new Float32Array(Math.floor(s.length / 2));
    for (let i = 0; i < out.length; i++) out[i] = (s[2 * i] + s[2 * i + 1]) / 2;
    return out;
  }

  function encodeWav(samples, rate) {
    const buf = new ArrayBuffer(44 + samples.length * 2);
    const v = new DataView(buf);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true);
    str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const x = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    }
    return buf;
  }

  recStart.addEventListener("click", startRecording);
  recStop.addEventListener("click", () => { stopRecording(); setStatus("Optagelsen er stoppet. Tryk på Start for at fortsætte."); });
  recSkip.addEventListener("click", () => {
    if (!target) return;
    const nxt = nextTarget(target);
    if (nxt) { target = nxt; updatePrompt(); if (recording) setStatus("Sig: " + labelOf(target)); }
  });

  // ---------------------------------------------------- Gem / hent / slet optagelser
  function toBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromBase64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  recExport.addEventListener("click", async () => {
    try {
      const all = await idbAll();
      const out = { version: 1, clips: {} };
      Object.keys(all).forEach((k) => { out.clips[k] = toBase64(all[k]); });
      const url = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "julebanko-stemme.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus("Optagelserne er gemt i filen julebanko-stemme.json.");
    } catch (e) {
      setStatus("Kunne ikke gemme optagelserne til en fil.");
    }
  });

  recImport.addEventListener("click", () => recImportFile.click());
  recImportFile.addEventListener("change", async () => {
    const file = recImportFile.files && recImportFile.files[0];
    recImportFile.value = "";
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) { setStatus("Filen er for stor."); return; }
    try {
      const data = JSON.parse(await file.text());
      let n = 0;
      for (const key of Object.keys(data.clips || {})) {
        if (!KEYS.includes(key) || typeof data.clips[key] !== "string") continue;
        const buf = fromBase64(data.clips[key]);
        const head = new Uint8Array(buf, 0, 4);
        if (String.fromCharCode(head[0], head[1], head[2], head[3]) !== "RIFF") continue;
        await idbPut(key, buf);
        setClip(key, buf);
        n++;
      }
      refreshGrid();
      setStatus(n + " optagelser er hentet fra filen.");
    } catch (e) {
      setStatus("Filen kunne ikke læses som optagelser fra Julebanko.");
    }
  });

  recDelete.addEventListener("click", async () => {
    if (!confirm("Slet alle dine optagelser fra denne browser?")) return;
    try {
      await idbClear();
      clips.forEach((c) => URL.revokeObjectURL(c.url));
      clips.clear();
      target = null;
      updatePrompt();
      setStatus("Alle optagelser er slettet.");
    } catch (e) {
      setStatus("Kunne ikke slette optagelserne.");
    }
  });

  // ------------------------------------------------------------------ Start
  db().then(idbAll).then((all) => {
    Object.keys(all).forEach((k) => { if (KEYS.includes(k)) setClip(k, all[k]); });
    refreshGrid();
  }).catch(() => {
    refreshGrid();
  });
  refreshGrid();
})();
