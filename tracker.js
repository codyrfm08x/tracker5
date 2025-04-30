
(function () {
  'use strict';

  const multipliers = [
    { mult: 25, entry: 50, exit: 75, reentry: 125 },
    { mult: 50, entry: 80, exit: 120, reentry: 200 },
    { mult: 100, entry: 150, exit: 200, reentry: 400 },
    { mult: 250, entry: 400, exit: 600, reentry: 850 },
    { mult: 500, entry: 750, exit: 1000, reentry: 1300 },
    { mult: 1000, entry: 1400, exit: 2000, reentry: 2300 }
  ];

  const storageKey = "limboMobileSession";
  let sessionSpin = 0;
  let lastHits = {};

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "fixed",
    bottom: "10px",
    left: "10px",
    background: "#000c",
    color: "#fff",
    padding: "10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontFamily: "Arial, sans-serif",
    zIndex: 99999,
    maxWidth: "94vw",
    boxShadow: "0 0 8px #0ff",
    lineHeight: "1.4em",
    backdropFilter: "blur(4px)",
  });

  const controls = document.createElement("div");
  controls.style = "margin-bottom:6px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center";

  const info = document.createElement("div");
  info.id = "tracker-info";
  info.style = "text-align:center;margin:4px 0;font-size:11px;color:#0ff;font-weight:bold;";

  const content = document.createElement("div");
  content.id = "tracker-content";

  panel.appendChild(controls);
  panel.appendChild(info);
  panel.appendChild(content);
  document.body.appendChild(panel);

  function getNextTarget() {
    const upcoming = multipliers.filter(m => sessionSpin < (lastHits[m.mult] || 0) + m.entry)
      .sort((a, b) => ((lastHits[a.mult] || 0) + a.entry) - ((lastHits[b.mult] || 0) + b.entry))[0];
    if (!upcoming) return "Next: —";
    const spinsAway = ((lastHits[upcoming.mult] || 0) + upcoming.entry) - sessionSpin;
    return `Next: ${upcoming.mult}x in ${spinsAway} spins`;
  }

  function render() {
    info.textContent = `Spin: ${sessionSpin} | ${getNextTarget()}`;
    content.innerHTML = multipliers.map(m => {
      const last = lastHits[m.mult] || 0;
      const entry = last + m.entry;
      const exit = last + m.exit;
      const reentry = last + m.reentry;
      const inRange = sessionSpin >= entry && sessionSpin <= exit;
      const desperation = sessionSpin >= reentry && sessionSpin > exit;
      const badge = sessionSpin < entry ? "🟡" : inRange ? "🟢" : "🔴";
      const left = inRange ? exit - sessionSpin : "";
      const rewatch = desperation ? ` 🔮+${Math.floor((sessionSpin - reentry) / 100) * 5}%` : "";
      return `<div style="background:#2228;padding:6px;margin:4px 0;border-radius:10px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span>${badge}${rewatch} <b>${m.mult}x</b></span>
          <button class="mini-hit-btn" data-mult="${m.mult}">Hit</button>
        </div>
        <div style="text-align:right;min-width:108px;">
          <span>| Entry: ${entry}</span>
          <span>| Left: ${left}</span>
        </div>
      </div>`;
    }).join("");
    document.querySelectorAll(".mini-hit-btn").forEach(btn => {
      btn.onclick = () => manualHit(parseInt(btn.dataset.mult));
    });
  }

  function manualHit(hitMult) {
    multipliers.forEach(m => {
      if (m.mult <= hitMult) lastHits[m.mult] = sessionSpin;
    });
    saveSession();
    render();
  }

  function saveSession() {
    localStorage.setItem(storageKey, JSON.stringify({ sessionSpin, lastHits }));
  }

  function loadSession() {
    const data = localStorage.getItem(storageKey);
    if (data) {
      try {
        const obj = JSON.parse(data);
        sessionSpin = obj.sessionSpin || 0;
        lastHits = obj.lastHits || {};
      } catch {}
    }
  }

  function makeBtn(label, action) {
    const b = document.createElement("button");
    b.textContent = label;
    b.style = "background:#000;border:1px solid #0ff;color:#0ff;padding:4px 6px;border-radius:8px;font-size:10px;cursor:pointer";
    b.onclick = action;
    controls.appendChild(b);
  }

  makeBtn("Set", () => {
    const n = prompt("Set spin:");
    if (n !== null) {
      sessionSpin = parseInt(n, 10) || 0;
      saveSession();
      render();
    }
  });

  makeBtn("Seed", () => {
    if (confirm("Reset seed?")) {
      sessionSpin = 0;
      lastHits = {};
      saveSession();
      render();
    }
  });

  makeBtn("Out", () => {
    prompt("Copy your session JSON:", JSON.stringify({ sessionSpin, lastHits }));
  });

  makeBtn("In", () => {
    const s = prompt("Paste session JSON:");
    try {
      const j = JSON.parse(s);
      if (typeof j.sessionSpin === "number" && typeof j.lastHits === "object") {
        sessionSpin = j.sessionSpin;
        lastHits = j.lastHits;
        saveSession();
        render();
        alert("✅ Imported!");
      } else alert("❌ Invalid format");
    } catch {
      alert("❌ Failed to import");
    }
  });

  let lastStableText = "", lastStableNum = 0, lastSpinTime = 0;
  const STABLE_DELAY = 100, SPIN_COOLDOWN = 200;
  let lastSeenText = "", stableTimer = null;

  function getMultiplierText() {
    const candidates = Array.from(document.querySelectorAll("span, div")).filter(el => {
      const txt = el.textContent.trim();
      return /^\d+(\.\d+)?×$/.test(txt) && getComputedStyle(el).fontSize.replace("px", "") > 30;
    });
    if (candidates.length > 0) {
      const biggest = candidates.sort((a, b) =>
        parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize)
      )[0];
      return biggest.textContent.trim();
    }
    return null;
  }

  function detectHybridLoop() {
    const now = Date.now();
    const txt = getMultiplierText();
    if (txt) {
      const parsed = parseFloat(txt.replace("×", ""));
      const timeSinceLastSpin = now - lastSpinTime;

      if (txt !== lastSeenText) {
        lastSeenText = txt;
        if (stableTimer) clearTimeout(stableTimer);
        stableTimer = setTimeout(() => {
          if (txt === getMultiplierText()) {
            const newText = txt !== lastStableText;
            const newNum = parsed !== lastStableNum;
            const passedDelay = timeSinceLastSpin >= SPIN_COOLDOWN;
            if ((newText || newNum) && passedDelay) {
              lastStableText = txt;
              lastStableNum = parsed;
              lastSpinTime = Date.now();
              sessionSpin++;
              multipliers.forEach(m => {
                if (parsed >= m.mult) lastHits[m.mult] = sessionSpin;
              });
              saveSession();
              render();
            }
          }
        }, STABLE_DELAY);
      }
    }
    requestAnimationFrame(detectHybridLoop);
    setTimeout(detectHybridLoop, 200);
  }

  loadSession();
  render();
  detectHybridLoop();
})();
