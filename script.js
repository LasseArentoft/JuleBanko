(() => {
  const MAX = 90;
  const STORAGE_KEY = "julebanko-trukne";
  const SPEAK_KEY = "julebanko-laes-hojt";

  const $ = (id) => document.getElementById(id);
  const numberEl = $("number");
  const revealEl = $("reveal");
  const hangerEl = $("hanger");
  const shakeBtn = $("shakeBtn");
  const nickBtn = $("nickBtn");
  const nickText = $("nickText");
  const NICKS = window.JULE_NICKS || {};
  const SHAKE_MS = 1100; // hvor længe posen ryster
  const PULL_MS = 900; // hvor længe tallet er om at komme op af posen
  const statusEl = $("status");
  const drawBtn = $("drawBtn");
  const undoBtn = $("undoBtn");
  const resetBtn = $("resetBtn");
  const speakToggle = $("speakToggle");
  const boardEl = $("board");
  const recentEl = $("recent");
  const countEl = $("count");
  const burstEl = $("burst");
  const bankoBtn = $("bankoBtn");
  const prizeInputs = document.querySelectorAll('input[name="prize"]');
  const dialog = $("checkDialog");
  const checkInput = $("checkInput");
  const checkChips = $("checkChips");
  const checkResult = $("checkResult");
  const approveBtn = $("approveBtn");

  // Gevinst vælges manuelt af værten
  const PRIZES = ["1 række", "Fuld plade"];
  const PRIZE_KEY = "julebanko-gevinst";

  let drawn = load();
  let busy = false;
  let checkOk = false;

  // ---------- Storage (fails quietly if blocked) ----------
  function load() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(list)) return [];
      // kun hele tal mellem 1 og MAX, og hvert tal højst én gang
      return list.filter((n, i) => Number.isInteger(n) && n >= 1 && n <= MAX && list.indexOf(n) === i);
    } catch (e) {
      return [];
    }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(drawn)); } catch (e) {}
  }
  function currentPrize() {
    const sel = document.querySelector('input[name="prize"]:checked');
    return sel ? sel.value : PRIZES[0];
  }
  try {
    const saved = localStorage.getItem(PRIZE_KEY);
    prizeInputs.forEach((i) => { i.checked = i.value === saved || (!PRIZES.includes(saved) && i.value === PRIZES[0]); });
  } catch (e) {}
  prizeInputs.forEach((i) => i.addEventListener("change", () => {
    try { localStorage.setItem(PRIZE_KEY, currentPrize()); } catch (e) {}
  }));

  // ---------- Board ----------
  const cells = [];
  for (let n = 1; n <= MAX; n++) {
    const c = document.createElement("div");
    c.className = "cell";
    c.textContent = n;
    boardEl.appendChild(c);
    cells[n] = c;
  }

  function render() {
    const latest = drawn[drawn.length - 1];
    cells.forEach((c, n) => {
      if (!c) return;
      c.classList.toggle("drawn", drawn.includes(n));
      c.classList.toggle("latest", n === latest);
    });

    countEl.textContent = drawn.length;
    numberEl.textContent = latest ?? "?";

    // udtrykket til det seneste nummer – først når tallet er landet
    const nick = !busy && latest !== undefined ? NICKS[latest] : null;
    nickBtn.hidden = !nick;
    if (nick) {
      nickText.textContent = nick;
      nickBtn.setAttribute("aria-label", "Sig udtrykket: " + nick);
    }

    recentEl.innerHTML = "";
    const last5 = drawn.slice(-5).reverse();
    for (let i = 0; i < 5; i++) {
      const li = document.createElement("li");
      if (last5[i] !== undefined) li.textContent = last5[i];
      else li.className = "empty";
      recentEl.appendChild(li);
    }

    const done = drawn.length >= MAX;
    drawBtn.disabled = busy || done;
    shakeBtn.disabled = busy || done;
    bankoBtn.disabled = busy || drawn.length === 0;
    undoBtn.disabled = busy || drawn.length === 0;
    resetBtn.disabled = busy || drawn.length === 0;
  }

  // ---------- Status messages ----------
  function statusFor(count, n) {
    if (count === MAX) return "Alle 90 numre er trukket. God jul!";
    if (count === 1) return "Første nummer er " + n;
    if (count === 45) return "Halvvejs – 45 numre er trukket";
    if (count === 80) return "Kun ti numre tilbage";
    if (!NICKS[n] && (n === 11 || n === 22 || n === 33 || n === 44 || n === 55 || n === 66 || n === 77 || n === 88))
      return "Dobbeltnummer: " + n;
    return "Nummer " + n + " – " + (MAX - count) + " tilbage";
  }

  // ---------- Posen: ryst og træk ----------
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function shake() {
    if (busy || drawn.length >= MAX) return;
    busy = true;
    render();
    statusEl.textContent = "Ryst, ryst, ryst…";
    hangerEl.classList.add("shaking");
    const duration = reduceMotion() ? 300 : SHAKE_MS;
    playShake(duration);

    setTimeout(() => {
      hangerEl.classList.remove("shaking");
      busy = false;
      statusEl.textContent = "Posen er rystet – træk et nummer";
      render();
    }, duration);
  }

  // Regel: et nummer kan kun trækkes én gang, indtil der trykkes "Start forfra".
  // Listen hentes friskt, hver gang der trækkes, så to åbne faner ikke kan trække det samme tal.
  function syncDrawn() {
    drawn = load();
    return drawn;
  }

  function draw() {
    if (busy) return;
    syncDrawn();
    if (drawn.length >= MAX) { render(); return; }
    busy = true;
    render();

    const remaining = [];
    for (let n = 1; n <= MAX; n++) if (!drawn.includes(n)) remaining.push(n);
    const pick = remaining[Math.floor(Math.random() * remaining.length)];

    statusEl.textContent = "Her kommer det…";
    numberEl.textContent = pick; // tallet er skjult bag posen, mens det stiger op
    revealEl.style.setProperty("--tilt", (Math.random() * 8 - 4).toFixed(1) + "deg");
    hangerEl.classList.add("pulling");
    revealEl.classList.remove("emerge");
    void revealEl.offsetWidth; // genstart animationen
    revealEl.classList.add("emerge");
    sparkleAt(105, 18); // glimt fra posens åbning

    const duration = reduceMotion() ? 200 : PULL_MS;
    setTimeout(playPlop, duration * 0.45);

    setTimeout(() => {
      hangerEl.classList.remove("pulling");
      revealEl.classList.remove("emerge");
      syncDrawn();
      if (drawn.includes(pick)) {
        // et andet vindue nåede at trække det samme tal – det tæller ikke to gange
        busy = false;
        statusEl.textContent = "Det nummer var allerede trukket – træk igen";
        render();
        return;
      }
      drawn.push(pick);
      save();
      busy = false;
      statusEl.textContent = statusFor(drawn.length, pick);
      render();
      sparkle();
      speak(pick);
    }, duration);
  }

  function undo() {
    if (busy || !drawn.length) return;
    const removed = drawn.pop();
    save();
    statusEl.textContent = "Nummer " + removed + " er lagt tilbage";
    render();
  }

  function reset() {
    if (busy || !drawn.length) return;
    if (!confirm("Start forfra? Alle trukne numre bliver nulstillet.")) return;
    drawn = [];
    save();
    statusEl.textContent = "Ryst posen og træk det første nummer";
    render();
  }

  // ---------- Lyd til posen ----------
  // Blød rystelyd – kun når der trykkes "Ryst posen!"
  function playShake(ms) {
    const ac = getAudio();
    if (!ac) return;
    const t0 = ac.currentTime + 0.02;
    const clicks = Math.round(ms / 70);
    for (let i = 0; i < clicks; i++) {
      const t = t0 + (i / clicks) * (ms / 1000) + rand(0, 0.03);
      const len = Math.floor(ac.sampleRate * 0.05);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 3);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = rand(900, 2400);
      f.Q.value = 1.2;
      const g = ac.createGain();
      g.gain.value = rand(0.12, 0.3);
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t);
    }
  }

  function playPlop() {
    const ac = getAudio();
    if (!ac) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.12);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.25);
  }

  // ---------- Banko-kontrol ----------
  function parseNumbers(text) {
    const tokens = text.split(/[^0-9]+/).filter(Boolean).map(Number);
    return [...new Set(tokens)];
  }

  function danskListe(list) {
    if (list.length <= 1) return list.join("");
    return list.slice(0, -1).join(", ") + " og " + list[list.length - 1];
  }

  function runCheck() {
    const nums = parseNumbers(checkInput.value);
    checkChips.innerHTML = "";
    checkOk = false;
    approveBtn.hidden = true;
    checkResult.className = "result";

    if (!nums.length) {
      checkResult.textContent = "";
      return;
    }

    const invalid = [];
    const missing = [];
    for (const n of nums) {
      const li = document.createElement("li");
      if (n < 1 || n > MAX) {
        li.className = "invalid";
        li.textContent = "? " + n;
        invalid.push(n);
      } else if (drawn.includes(n)) {
        li.className = "ok";
        li.textContent = "✓ " + n;
      } else {
        li.className = "missing";
        li.textContent = "✗ " + n;
        missing.push(n);
      }
      checkChips.appendChild(li);
    }

    checkResult.classList.add("bad");
    if (invalid.length) {
      checkResult.textContent = danskListe(invalid) + " er ikke et banko-nummer (1–" + MAX + ").";
    } else if (missing.length) {
      checkResult.textContent = "Ikke banko endnu – " + danskListe(missing) + " er ikke trukket.";
    } else {
      checkOk = true;
      checkResult.classList.replace("bad", "good");
      checkResult.textContent = (nums.length === 1 ? "Tallet er trukket" : "Alle " + nums.length + " tal er trukket") +
        " – nemmere end en lønkørsel.";
      approveBtn.hidden = false;
    }
  }

  function openCheck() {
    if (busy || !drawn.length) return;
    $("checkTitle").textContent = "Banko på " + currentPrize().toLowerCase() + "?";
    checkInput.value = "";
    runCheck();
    dialog.showModal();
    checkInput.focus();
  }

  function approve() {
    if (!checkOk) return;
    dialog.close();
    statusEl.textContent = "BANKO! " + currentPrize() + " er godkendt";
    celebrate(currentPrize());
  }

  // ---------- Banko-fest: konfetti, fyrværkeri og fanfare ----------
  const celebEl = $("celebration");
  const celebPrize = $("celebPrize");
  const confettiCanvas = $("confetti");
  const cctx = confettiCanvas.getContext("2d");
  const soundToggle = $("soundToggle");
  const SOUND_KEY = "julebanko-festlyd";
  const CONFETTI_COLORS = ["#f0b94a", "#ffe19a", "#f7f3ec", "#e2475a", "#3fa37a", "#7fd6ff"];
  const CELEBRATION_MS = 15000;

  let celebActive = false;
  let celebTimer = 0;
  let celebRAF = 0;
  let fx = null;
  let audioCtx = null;

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);

  try { soundToggle.checked = localStorage.getItem(SOUND_KEY) !== "0"; } catch (e) {}
  soundToggle.addEventListener("change", () => {
    try { localStorage.setItem(SOUND_KEY, soundToggle.checked ? "1" : "0"); } catch (e) {}
  });

  // --- Lyd (syntetiseret, ingen lydfiler) ---
  function getAudio() {
    if (!soundToggle.checked) return null;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  function tone(ac, freq, start, dur, type, vol) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(ac.destination);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  function playFanfare() {
    const ac = getAudio();
    if (!ac) return;
    const t = ac.currentTime + 0.03;
    // "ta-ta-ta-TAAA" + afsluttende akkord
    [[392, 0, 0.13], [392, 0.16, 0.13], [392, 0.32, 0.13], [523.25, 0.48, 0.3], [659.25, 0.82, 0.3]]
      .forEach(([f, d, len]) => tone(ac, f, t + d, len, "square", 0.1));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(ac, f, t + 1.16, 1.3, "sawtooth", 0.07));
    [1046.5, 1318.5, 1568].forEach((f, i) => tone(ac, f, t + 1.2 + i * 0.1, 1.1, "triangle", 0.06));
  }

  function playPop(big) {
    const ac = getAudio();
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * 0.35);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = big ? 1800 : 2800;
    const g = ac.createGain();
    g.gain.value = big ? 0.5 : 0.28;
    src.connect(filter).connect(g).connect(ac.destination);
    src.start();
  }

  // --- Grafik ---
  function sizeFx() {
    confettiCanvas.width = innerWidth;
    confettiCanvas.height = innerHeight;
  }

  function confettiPiece(x, y, vx, vy) {
    return {
      kind: "confetti", x, y, vx, vy,
      w: rand(6, 13), h: rand(4, 9),
      rot: rand(0, Math.PI), vr: rand(-0.35, 0.35),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    };
  }

  function cannon(side) {
    const W = confettiCanvas.width, H = confettiCanvas.height;
    for (let i = 0; i < 110; i++) {
      const a = side < 0 ? rand(-80, -35) : rand(-145, -100);
      const rad = (a * Math.PI) / 180;
      const sp = rand(14, 30) * (H / 900 + 0.5) / 1.5;
      fx.parts.push(confettiPiece(side < 0 ? 0 : W, H, Math.cos(rad) * sp, Math.sin(rad) * sp));
    }
  }

  function launchRocket() {
    const W = confettiCanvas.width, H = confettiCanvas.height;
    const targetY = rand(H * 0.12, H * 0.42);
    fx.parts.push({
      kind: "rocket", x: rand(W * 0.12, W * 0.88), y: H + 10,
      vx: rand(-1.2, 1.2), vy: -Math.sqrt(2 * 0.25 * (H - targetY)),
      hue: Math.floor(rand(0, 360)),
    });
  }

  function explode(r) {
    const n = 110;
    const hue2 = (r.hue + 40) % 360;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = Math.sqrt(Math.random()) * 9.5;
      fx.parts.push({
        kind: "spark", x: r.x, y: r.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, decay: rand(0.009, 0.019),
        hue: i % 3 === 0 ? hue2 : r.hue, size: rand(1.5, 3.2),
      });
    }
    // lille guldregn ovenpå
    for (let i = 0; i < 18; i++) {
      fx.parts.push({
        kind: "spark", x: r.x, y: r.y,
        vx: rand(-3, 3), vy: rand(-3, 3),
        life: 1, decay: rand(0.006, 0.01), hue: 42, size: 2.4,
      });
    }
    playPop(false);
  }

  function frame(now) {
    if (!celebActive) return;
    const W = confettiCanvas.width, H = confettiCanvas.height;
    const t = now - fx.start;

    if (t - fx.lastCannon > 1800) { cannon(-1); cannon(1); fx.lastCannon = t; }
    if (t - fx.lastRocket > 380 && t < CELEBRATION_MS - 2500) { launchRocket(); fx.lastRocket = t; }
    if (t < CELEBRATION_MS - 2500) {
      for (let i = 0; i < 3; i++) fx.parts.push(confettiPiece(rand(0, W), -12, rand(-1.5, 1.5), rand(2, 5)));
    }

    cctx.clearRect(0, 0, W, H);
    const next = [];
    for (const p of fx.parts) {
      if (p.kind === "confetti") {
        p.vy += 0.35;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > H + 30) continue;
        cctx.save();
        cctx.translate(p.x, p.y);
        cctx.rotate(p.rot);
        cctx.fillStyle = p.color;
        cctx.fillRect(-p.w / 2, (-p.h / 2) * Math.cos(p.rot * 2), p.w, p.h);
        cctx.restore();
        next.push(p);
      } else if (p.kind === "rocket") {
        p.vy += 0.25;
        p.x += p.vx;
        p.y += p.vy;
        if (p.vy >= -0.5) { explode(p); continue; }
        cctx.fillStyle = "hsl(" + p.hue + ",100%,80%)";
        cctx.beginPath();
        cctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        cctx.fill();
        fx.parts.push({ kind: "spark", x: p.x, y: p.y, vx: rand(-0.3, 0.3), vy: rand(0.5, 1.5), life: 0.55, decay: 0.03, hue: 40, size: 1.6 });
        next.push(p);
      } else {
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.07;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) continue;
        cctx.globalAlpha = Math.max(p.life, 0);
        cctx.fillStyle = "hsl(" + p.hue + ",100%," + (55 + p.life * 25) + "%)";
        cctx.beginPath();
        cctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        cctx.fill();
        cctx.globalAlpha = 1;
        next.push(p);
      }
    }
    fx.parts = next;
    celebRAF = requestAnimationFrame(frame);
  }

  function celebrate(prize) {
    clearTimeout(celebTimer);
    cancelAnimationFrame(celebRAF);
    celebPrize.textContent = prize;
    celebEl.hidden = false;
    celebActive = true;
    celebEl.focus();
    playFanfare();
    speakBanko(prize);
    celebTimer = setTimeout(stopCelebration, CELEBRATION_MS);

    if (!reducedMotion()) {
      sizeFx();
      fx = { parts: [], start: performance.now(), lastCannon: 0, lastRocket: 0 };
      cannon(-1);
      cannon(1);
      celebRAF = requestAnimationFrame(frame);
    }
  }

  function stopCelebration() {
    if (!celebActive) return;
    celebActive = false;
    clearTimeout(celebTimer);
    cancelAnimationFrame(celebRAF);
    cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    fx = null;
    celebEl.hidden = true;
    bankoBtn.focus();
  }

  celebEl.addEventListener("click", stopCelebration);
  addEventListener("resize", () => { if (celebActive) sizeFx(); });

  // ---------- Sparkles ----------
  function sparkle() {
    sparkleAt(0, 22);
  }

  // Gnister fra et punkt (yOffset = pixels under tallets midte)
  function sparkleAt(yOffset, count) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#f0b94a", "#ffe19a", "#f7f3ec", "#e2475a"];
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      const angle = yOffset ? rand(-Math.PI * 0.85, -Math.PI * 0.15) : Math.random() * Math.PI * 2;
      const dist = yOffset ? rand(60, 170) : 90 + Math.random() * 110;
      s.style.top = yOffset + "px";
      s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      s.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      s.style.background = colors[i % colors.length];
      burstEl.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }

  // ---------- Read aloud (Danish) ----------
  function speakBanko(prize) {
    if (!speakToggle.checked) return;
    if (window.JuleVoice) { window.JuleVoice.sayBanko(prize); return; }
    speak("Banko på " + prize.toLowerCase());
  }

  function speak(n) {
    if (!speakToggle.checked) return;
    if (window.JuleVoice) { window.JuleVoice.say(n); return; }
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(String(n));
    u.lang = "da-DK";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  try { speakToggle.checked = localStorage.getItem(SPEAK_KEY) === "1"; } catch (e) {}
  speakToggle.addEventListener("change", () => {
    try { localStorage.setItem(SPEAK_KEY, speakToggle.checked ? "1" : "0"); } catch (e) {}
    if (speakToggle.checked && drawn.length) speak(drawn[drawn.length - 1]);
  });

  // Hold flere åbne faner ens: når et andet vindue trækker, fortryder eller nulstiller
  addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || busy) return;
    syncDrawn();
    if (drawn.length) statusEl.textContent = statusFor(drawn.length, drawn[drawn.length - 1]);
    else statusEl.textContent = "Ryst posen og træk det første nummer";
    render();
  });

  // ---------- Events ----------
  drawBtn.addEventListener("click", draw);
  shakeBtn.addEventListener("click", shake);
  nickBtn.addEventListener("click", () => {
    const latest = drawn[drawn.length - 1];
    if (latest === undefined || !NICKS[latest]) return;
    if (window.JuleVoice) { window.JuleVoice.sayNick(latest); return; }
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(NICKS[latest]);
    u.lang = "da-DK";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
  undoBtn.addEventListener("click", undo);
  resetBtn.addEventListener("click", reset);
  bankoBtn.addEventListener("click", openCheck);
  checkInput.addEventListener("input", runCheck);
  approveBtn.addEventListener("click", approve);
  document.addEventListener("keydown", (e) => {
    if (celebActive) {
      if (e.code === "Escape" || e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        stopCelebration();
      }
      return;
    }
    if (dialog.open) return;
    if (e.code === "Space" && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      draw();
    }
  });

  // ---------- Snow ----------
  const canvas = $("snow");
  const ctx = canvas.getContext("2d");
  let flakes = [];

  // Sne der lægger sig i bunden af siden
  const STEP = 4;          // bredde pr. søjle i px
  const BASE = 5;          // snedybde fra start
  const MAXH = 46;         // højeste snedrive
  let ground = [];

  function sizeCanvas() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const count = Math.min(120, Math.floor(innerWidth / 12));
    flakes = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 1 + Math.random() * 2.6,
      v: 0.3 + Math.random() * 0.9,
      p: Math.random() * Math.PI * 2,
    }));
    const cols = Math.ceil(canvas.width / STEP) + 1;
    ground = Array.from({ length: cols }, (_, i) => BASE + 2 * Math.sin(i / 9) + 1.5 * Math.sin(i / 3.7));
  }

  function land(x, r) {
    const c = Math.max(0, Math.min(ground.length - 1, Math.round(x / STEP)));
    const add = 0.25 + r * 0.12;
    // læg sneen i søjlen og lidt i naboerne, så den danner bløde driver
    for (let k = -3; k <= 3; k++) {
      const i = c + k;
      if (i < 0 || i >= ground.length) continue;
      ground[i] = Math.min(MAXH, ground[i] + add * (1 - Math.abs(k) / 4));
    }
    // jævn ud mod lavere naboer, så toppen ikke bliver takket
    for (let k = -4; k <= 4; k++) {
      const i = c + k;
      if (i < 1 || i >= ground.length - 1) continue;
      ground[i] += ((ground[i - 1] + ground[i + 1]) / 2 - ground[i]) * 0.3;
    }
  }

  function drawGround() {
    const H = canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < ground.length; i++) ctx.lineTo(i * STEP, H - ground[i]);
    ctx.lineTo(canvas.width + STEP, H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, H - MAXH, 0, H);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(214,228,236,0.95)");
    ctx.fillStyle = g;
    ctx.fill();
  }

  function snow() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const f of flakes) {
      f.y += f.v;
      f.p += 0.01;
      f.x += Math.sin(f.p) * 0.4;
      const col = Math.max(0, Math.min(ground.length - 1, Math.round(f.x / STEP)));
      if (f.y + f.r >= canvas.height - ground[col]) {
        land(f.x, f.r);
        f.y = -5; f.x = Math.random() * canvas.width;
      } else if (f.y > canvas.height + 5) { f.y = -5; f.x = Math.random() * canvas.width; }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    drawGround();
    requestAnimationFrame(snow);
  }

  sizeCanvas();
  addEventListener("resize", sizeCanvas);
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) snow();
  else drawGround();

  // ---------- Julelys i toppen ----------
  (function lights() {
    const wrap = document.querySelector(".lights");
    if (!wrap) return;
    const cols = ["#e2475a", "#f0b94a", "#4fbf7f", "#5aa9e6"];
    const n = Math.max(10, Math.floor(innerWidth / 55));
    for (let i = 0; i < n; i++) {
      const b = document.createElement("i");
      b.style.setProperty("--c", cols[i % cols.length]);
      b.style.setProperty("--d", (i * 0.37 % 2.4).toFixed(2) + "s");
      wrap.appendChild(b);
    }
  })();

  // ---------- Storskærm ----------
  const bigBtn = $("bigBtn");
  function fitBig() {
    if (!document.body.classList.contains("big")) return;
    const s = Math.max(0.8, Math.min(1.9, (innerHeight - 400) / 410, 540 / 260));
    document.body.style.setProperty("--bs", s.toFixed(2));
  }
  function setBig(on) {
    document.body.classList.toggle("big", on);
    bigBtn.setAttribute("aria-pressed", on ? "true" : "false");
    bigBtn.textContent = on ? "Luk storskærm" : "Storskærm";
    fitBig();
    if (on) window.scrollTo(0, 0);
  }
  function toggleBig() {
    const on = !document.body.classList.contains("big");
    setBig(on);
    try {
      if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      else if (!on && document.fullscreenElement) document.exitFullscreen();
    } catch (e) {}
  }
  bigBtn.addEventListener("click", toggleBig);
  addEventListener("resize", fitBig);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && document.body.classList.contains("big")) setBig(false);
  });
  addEventListener("keydown", (e) => {
    if (e.key !== "f" && e.key !== "F") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (dialog.open || $("voiceDialog")?.open || !celebEl.hidden) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    toggleBig();
  });

  // ---------- Start ----------
  if (drawn.length) statusEl.textContent = statusFor(drawn.length, drawn[drawn.length - 1]);
  render();
})();
