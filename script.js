(() => {
  const MAX = 90;
  const STORAGE_KEY = "julebanko-trukne";
  const SPEAK_KEY = "julebanko-laes-hojt";

  const $ = (id) => document.getElementById(id);
  const numberEl = $("number");
  const baubleEl = $("bauble");
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
  const prizeEl = $("prize");
  const dialog = $("checkDialog");
  const checkInput = $("checkInput");
  const checkChips = $("checkChips");
  const checkResult = $("checkResult");
  const approveBtn = $("approveBtn");

  // Gevinster: antal tal der skal kontrolleres (5 pr. række på en plade)
  const PRIZES = [
    { name: "1 række", need: 5 },
    { name: "2 rækker", need: 10 },
    { name: "Fuld plade", need: 15 },
  ];
  const PRIZE_KEY = "julebanko-gevinst";

  let drawn = load();
  let busy = false;
  let prizeIdx = loadPrize();
  let checkOk = false;

  // ---------- Storage (fails quietly if blocked) ----------
  function load() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(drawn)); } catch (e) {}
  }
  function loadPrize() {
    try {
      const n = parseInt(localStorage.getItem(PRIZE_KEY), 10);
      return n >= 0 && n <= PRIZES.length ? n : 0;
    } catch (e) {
      return 0;
    }
  }
  function savePrize() {
    try { localStorage.setItem(PRIZE_KEY, String(prizeIdx)); } catch (e) {}
  }

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

    recentEl.innerHTML = "";
    const last5 = drawn.slice(-5).reverse();
    for (let i = 0; i < 5; i++) {
      const li = document.createElement("li");
      if (last5[i] !== undefined) li.textContent = last5[i];
      else li.className = "empty";
      recentEl.appendChild(li);
    }

    prizeEl.textContent = PRIZES[prizeIdx] ? PRIZES[prizeIdx].name : "Alle gevinster er uddelt";

    const done = drawn.length >= MAX;
    drawBtn.disabled = busy || done;
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
    if (n === 24) return "Juleaften! Nummer 24";
    if (n === 11 || n === 22 || n === 33 || n === 44 || n === 55 || n === 66 || n === 77 || n === 88)
      return "Dobbeltnummer: " + n;
    return "Nummer " + n + " – " + (MAX - count) + " tilbage";
  }

  // ---------- Drawing ----------
  function draw() {
    if (busy || drawn.length >= MAX) return;
    busy = true;
    render();

    const remaining = [];
    for (let n = 1; n <= MAX; n++) if (!drawn.includes(n)) remaining.push(n);
    const pick = remaining[Math.floor(Math.random() * remaining.length)];

    statusEl.textContent = "Trækker…";
    baubleEl.classList.remove("landed");
    baubleEl.classList.add("shuffling");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 300 : 1600;
    const tick = setInterval(() => {
      numberEl.textContent = 1 + Math.floor(Math.random() * MAX);
    }, 70);

    setTimeout(() => {
      clearInterval(tick);
      baubleEl.classList.remove("shuffling");
      void baubleEl.offsetWidth; // restart animation
      baubleEl.classList.add("landed");

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
    prizeIdx = 0;
    save();
    savePrize();
    statusEl.textContent = "Tryk for at trække det første nummer";
    render();
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
    const prize = PRIZES[prizeIdx] || PRIZES[PRIZES.length - 1];
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
    } else if (nums.length < prize.need) {
      checkResult.textContent = "Alle tal er trukket, men " + prize.name.toLowerCase() + " kræver " + prize.need + " tal. Du har skrevet " + nums.length + ".";
    } else {
      checkOk = true;
      checkResult.classList.replace("bad", "good");
      checkResult.textContent = "Kontrol bestået – nemmere end en lønkørsel.";
      approveBtn.hidden = !PRIZES[prizeIdx];
    }
  }

  function openCheck() {
    if (busy || !drawn.length) return;
    const prize = PRIZES[prizeIdx];
    $("checkHint").textContent = prize
      ? "Der spilles om " + prize.name.toLowerCase() + " (" + prize.need + " tal). Skriv tallene, adskilt af mellemrum eller komma."
      : "Alle gevinster er uddelt, men du kan stadig kontrollere tal.";
    checkInput.value = "";
    runCheck();
    dialog.showModal();
    checkInput.focus();
  }

  function approve() {
    if (!checkOk || !PRIZES[prizeIdx]) return;
    const won = PRIZES[prizeIdx].name;
    prizeIdx++;
    savePrize();
    dialog.close();
    statusEl.textContent = "BANKO! " + won + " er godkendt" +
      (PRIZES[prizeIdx] ? " – nu spilles der om " + PRIZES[prizeIdx].name.toLowerCase() : " – tillykke, spillet er slut!");
    render();
    confetti();
  }

  // ---------- Konfetti ----------
  const confettiCanvas = $("confetti");
  const cctx = confettiCanvas.getContext("2d");

  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    confettiCanvas.width = innerWidth;
    confettiCanvas.height = innerHeight;
    const colors = ["#f0b94a", "#ffe19a", "#f7f3ec", "#e2475a", "#3fa37a"];
    const pieces = Array.from({ length: 180 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.55,
      vx: (Math.random() - 0.5) * 16,
      vy: -8 - Math.random() * 12,
      w: 6 + Math.random() * 7,
      h: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;
      for (const p of pieces) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y < confettiCanvas.height + 20) alive = true;
        cctx.save();
        cctx.translate(p.x, p.y);
        cctx.rotate(p.rot);
        cctx.fillStyle = p.color;
        cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cctx.restore();
      }
      if (alive && elapsed < 6000) requestAnimationFrame(frame);
      else cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
    requestAnimationFrame(frame);
  }

  // ---------- Sparkles ----------
  function sparkle() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#f0b94a", "#ffe19a", "#f7f3ec", "#e2475a"];
    for (let i = 0; i < 22; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 110;
      s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      s.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      s.style.background = colors[i % colors.length];
      burstEl.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }

  // ---------- Read aloud (Danish) ----------
  function speak(n) {
    if (!speakToggle.checked || !("speechSynthesis" in window)) return;
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
  if (!("speechSynthesis" in window)) speakToggle.closest("label").hidden = true;

  // ---------- Events ----------
  drawBtn.addEventListener("click", draw);
  undoBtn.addEventListener("click", undo);
  resetBtn.addEventListener("click", reset);
  bankoBtn.addEventListener("click", openCheck);
  checkInput.addEventListener("input", runCheck);
  approveBtn.addEventListener("click", approve);
  document.addEventListener("keydown", (e) => {
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
  }

  function snow() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const f of flakes) {
      f.y += f.v;
      f.p += 0.01;
      f.x += Math.sin(f.p) * 0.4;
      if (f.y > canvas.height + 5) { f.y = -5; f.x = Math.random() * canvas.width; }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(snow);
  }

  sizeCanvas();
  addEventListener("resize", sizeCanvas);
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) snow();

  // ---------- Start ----------
  if (drawn.length) statusEl.textContent = statusFor(drawn.length, drawn[drawn.length - 1]);
  render();
})();
