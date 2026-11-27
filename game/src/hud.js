// Valley Rings — the HUD: the figures in the corners and the
// little instrument panel along the bottom.
//
// The instruments are drawn on a 2D canvas every frame: an
// artificial horizon that rolls and pitches with the plane,
// and an engine gauge whose needle follows the throttle. They
// are lit, live, and honest — the same numbers the flight
// model is flying by.

const $ = (id) => document.getElementById(id);

export function createHud() {
  const hud = $("hud");
  const alt = $("hud-alt");
  const spd = $("hud-spd");
  const hdg = $("hud-hdg");
  const ringN = $("hud-ring-n");
  const score = $("hud-score");
  const msg = $("hud-msg");
  const gauges = $("gauges").getContext("2d");
  let msgUntil = 0;

  function drawGauges(state) {
    const g = gauges;
    const W = 300;
    const H = 104;
    g.clearRect(0, 0, W, H);

    // --- artificial horizon (left) ---
    const cx = 48;
    const cy = 46;
    const r = 38;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    g.translate(cx, cy);
    g.rotate(-state.roll);
    const pitchPx = state.pitch * 90;
    g.fillStyle = "#3d7ac2";
    g.fillRect(-r - 4, -r - 4 + pitchPx, (r + 4) * 2, r + 4);
    g.fillStyle = "#7a5a34";
    g.fillRect(-r - 4, pitchPx, (r + 4) * 2, r + 4);
    g.strokeStyle = "#f5f2e6";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-r - 4, pitchPx);
    g.lineTo(r + 4, pitchPx);
    g.stroke();
    g.restore();
    g.strokeStyle = "rgba(220,240,220,0.8)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    // the fixed aircraft mark
    g.strokeStyle = "#ffd97a";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 16, cy);
    g.lineTo(cx - 5, cy);
    g.lineTo(cx, cy + 4);
    g.lineTo(cx + 5, cy);
    g.lineTo(cx + 16, cy);
    g.stroke();
    g.fillStyle = "#a9cbb2";
    g.font = "700 9px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("HORIZON", cx, cy + r + 11);

    // --- engine gauge (middle): throttle as a sweeping needle ---
    const ex = 138;
    g.strokeStyle = "rgba(220,240,220,0.8)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(ex, cy, r, 0, Math.PI * 2);
    g.stroke();
    const frac = state.targetSpeed / 78;
    const ang = Math.PI * 0.75 + frac * Math.PI * 1.5;
    g.strokeStyle = "#ff9d5c";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(ex, cy);
    g.lineTo(ex + Math.cos(ang) * (r - 7), cy + Math.sin(ang) * (r - 7));
    g.stroke();
    g.fillStyle = "#f2f7ee";
    g.font = "800 13px system-ui, sans-serif";
    g.fillText(`${Math.round(frac * 100)}%`, ex, cy + 22);
    g.fillStyle = "#a9cbb2";
    g.font = "700 9px system-ui, sans-serif";
    g.fillText("THROTTLE", ex, cy + r + 11);

    // --- vertical speed (right): a simple tape ---
    const tx = 218;
    g.fillStyle = "#a9cbb2";
    g.font = "700 9px system-ui, sans-serif";
    g.fillText("CLIMB", tx + 30, 12);
    const vs = -state.sinkRate; // m/s, positive climbing
    const clamped = Math.max(-12, Math.min(12, vs));
    const midY = 48;
    g.strokeStyle = "rgba(220,240,220,0.5)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(tx + 30, 16);
    g.lineTo(tx + 30, 80);
    g.stroke();
    g.fillStyle = vs >= 0 ? "#53d769" : "#ff9d5c";
    g.beginPath();
    g.arc(tx + 30, midY - clamped * 2.6, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2f7ee";
    g.font = "800 13px system-ui, sans-serif";
    g.fillText(`${vs >= 0 ? "+" : ""}${vs.toFixed(0)}`, tx + 30, 90);
  }

  return {
    show() {
      hud.classList.remove("hidden");
    },
    hide() {
      hud.classList.add("hidden");
    },
    /** Flash a centre-screen message for a few seconds. */
    announce(text, seconds = 2.6) {
      msg.textContent = text;
      msgUntil = performance.now() + seconds * 1000;
    },
    update(state, ringsDone, scoreNow) {
      alt.textContent = Math.max(0, Math.round(state.pos.y * 3.281)).toString();
      spd.textContent = Math.round(state.speed * 1.944).toString();
      const heading = ((180 + (state.yaw * 180) / Math.PI) % 360 + 360) % 360;
      hdg.textContent = Math.round(heading).toString().padStart(3, "0");
      ringN.textContent = ringsDone.toString();
      score.textContent = scoreNow.toString();
      if (performance.now() > msgUntil) msg.textContent = "";
      drawGauges(state);
    },
  };
}
