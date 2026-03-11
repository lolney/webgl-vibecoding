function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < 1e-8) return [0, 0, 1];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function projectPoint(p, basis) {
  const x = dot(p, basis.right);
  const y = dot(p, basis.up);
  const z = dot(p, basis.forward);
  return { x, y, z };
}

function drawArrow(ctx, x0, y0, x1, y1, color, width = 2) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return;
  const ux = dx / len;
  const uy = dy / len;
  const hx = x1 - ux * 10;
  const hy = y1 - uy * 10;
  const px = -uy;
  const py = ux;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(hx + px * 4, hy + py * 4);
  ctx.lineTo(hx - px * 4, hy - py * 4);
  ctx.closePath();
  ctx.fill();
}

export function createViewerSchematic({ root = document } = {}) {
  const wrap = root.getElementById("viewerSchematic");
  const canvas = root.getElementById("viewerSchematicCanvas");
  const latitudeLabel = root.getElementById("viewerLatitude");
  const ctx = canvas ? canvas.getContext("2d") : null;

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const rw = Math.max(1, Math.floor(w * dpr));
    const rh = Math.max(1, Math.floor(h * dpr));
    if (canvas.width === rw && canvas.height === rh) return;
    canvas.width = rw;
    canvas.height = rh;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setVisible(visible) {
    if (!wrap) return;
    wrap.classList.toggle("hidden", !visible);
  }

  function render(data) {
    if (!canvas || !ctx) return;
    resizeCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!data) {
      ctx.clearRect(0, 0, w, h);
      if (latitudeLabel) latitudeLabel.textContent = "LATITUDE --.-°";
      return;
    }

    const observerNormal = normalize3(data.observerNormal || [0, 0, 1]);
    const viewerTangent = normalize3(data.viewerTangent || [0, 0, 1]);
    const primaryDir = normalize3(data.primaryDir || [1, 0, 0]);
    const secondaryDir = normalize3(data.secondaryDir || [0, 0, 1]);
    const latitudeDeg = Number(data.latitudeDeg) || 0;

    // Keep the inset camera fixed so latitude and heading changes remain easy to read.
    const forward = normalize3([0.72, 0.54, 0.92]);
    const right = normalize3(cross([0, 1, 0], forward));
    const up = normalize3(cross(forward, right));
    const basis = { forward, right, up };

    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = Math.min(w, h) * 0.32;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(4, 10, 26, 0.78)";
    ctx.fillRect(0, 0, w, h);

    // Planet disc with soft radial falloff.
    const g = ctx.createRadialGradient(cx - r * 0.22, cy - r * 0.3, r * 0.08, cx, cy, r * 1.45);
    g.addColorStop(0, "rgba(184, 218, 255, 0.98)");
    g.addColorStop(0.36, "rgba(86, 152, 235, 0.95)");
    g.addColorStop(1, "rgba(20, 48, 98, 0.96)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Latitude rings (sparser near poles).
    ctx.strokeStyle = "rgba(164, 210, 255, 0.35)";
    ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
      const latR = Math.cos((lat * Math.PI) / 180);
      const y0 = Math.sin((lat * Math.PI) / 180);
      ctx.beginPath();
      let penDown = false;
      for (let i = 0; i <= 72; i += 1) {
        const lon = (i / 72) * Math.PI * 2;
        const p = [Math.cos(lon) * latR, y0, Math.sin(lon) * latR];
        const pr = projectPoint(p, basis);
        const x = cx + pr.x * r;
        const y = cy - pr.y * r;
        if (pr.z > 0) {
          if (!penDown) {
            ctx.moveTo(x, y);
            penDown = true;
          } else {
            ctx.lineTo(x, y);
          }
        } else {
          penDown = false;
        }
      }
      ctx.stroke();
    }

    // Equator emphasis.
    ctx.strokeStyle = "rgba(255, 238, 160, 0.5)";
    ctx.beginPath();
    let eqDown = false;
    for (let i = 0; i <= 96; i += 1) {
      const lon = (i / 96) * Math.PI * 2;
      const pr = projectPoint([Math.cos(lon), 0, Math.sin(lon)], basis);
      const x = cx + pr.x * r;
      const y = cy - pr.y * r;
      if (pr.z > 0) {
        if (!eqDown) {
          ctx.moveTo(x, y);
          eqDown = true;
        } else {
          ctx.lineTo(x, y);
        }
      } else {
        eqDown = false;
      }
    }
    ctx.stroke();

    const site = projectPoint(observerNormal, basis);
    const siteX = cx + site.x * r;
    const siteY = cy - site.y * r;
    const siteFront = site.z >= 0;
    const markerColor = siteFront ? "rgba(255, 245, 124, 0.98)" : "rgba(255, 245, 124, 0.6)";

    // Viewer site marker.
    ctx.fillStyle = markerColor;
    ctx.beginPath();
    ctx.arc(siteX, siteY, 4.8, 0, Math.PI * 2);
    ctx.fill();

    // View direction (tangent to local surface).
    const viewHead = add(observerNormal, scale(viewerTangent, 0.46));
    const viewProj = projectPoint(viewHead, basis);
    drawArrow(
      ctx,
      siteX,
      siteY,
      cx + viewProj.x * r,
      cy - viewProj.y * r,
      siteFront ? "rgba(255, 245, 124, 0.98)" : "rgba(255, 245, 124, 0.65)",
      2.2,
    );

    // Primary sun direction at site.
    const sunHead = add(observerNormal, scale(primaryDir, 0.38));
    const sunProj = projectPoint(sunHead, basis);
    drawArrow(
      ctx,
      siteX,
      siteY,
      cx + sunProj.x * r,
      cy - sunProj.y * r,
      siteFront ? "rgba(255, 188, 96, 0.95)" : "rgba(255, 188, 96, 0.58)",
      1.6,
    );

    const sun2Head = add(observerNormal, scale(secondaryDir, 0.3));
    const sun2Proj = projectPoint(sun2Head, basis);
    drawArrow(
      ctx,
      siteX,
      siteY,
      cx + sun2Proj.x * r,
      cy - sun2Proj.y * r,
      siteFront ? "rgba(140, 184, 255, 0.92)" : "rgba(140, 184, 255, 0.52)",
      1.2,
    );

    ctx.strokeStyle = "rgba(178, 220, 255, 0.65)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(222, 239, 255, 0.95)";
    ctx.font = "11px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("PLANET VIEW", 10, 16);
    ctx.fillStyle = "rgba(255, 244, 110, 0.95)";
    ctx.fillText("viewer", 10, h - 10);
    ctx.fillStyle = "rgba(255, 188, 96, 0.9)";
    ctx.fillText("sun A", 56, h - 10);
    ctx.fillStyle = "rgba(140, 184, 255, 0.85)";
    ctx.fillText("sun B", 98, h - 10);

    if (latitudeLabel) {
      const latText = clamp(latitudeDeg, -90, 90).toFixed(1);
      latitudeLabel.textContent = `LATITUDE ${latText}\u00B0`;
    }
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  return {
    setVisible,
    render,
    resize: resizeCanvas,
  };
}
