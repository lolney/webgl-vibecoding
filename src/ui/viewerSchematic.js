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

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function projectPoint(p, basis) {
  const x = dot(p, basis.right);
  const y = dot(p, basis.up);
  const z = dot(p, basis.forward);
  return { x, y, z };
}

function projectToTangent(v, normal) {
  return normalize3(sub(v, scale(normal, dot(v, normal))));
}

function signedAngle(a, b, axis) {
  const c = cross(a, b);
  return Math.atan2(dot(c, axis), dot(a, b));
}

function quaternionFromAxisAngle(axis, angle) {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

function quaternionMultiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function quaternionFromUnitVectors(from, to) {
  const r = dot(from, to) + 1;
  if (r < 1e-6) {
    const axis = normalize3(Math.abs(from[0]) < 0.8 ? cross(from, [1, 0, 0]) : cross(from, [0, 1, 0]));
    return [axis[0], axis[1], axis[2], 0];
  }
  const c = cross(from, to);
  return normalizeQuat([c[0], c[1], c[2], r]);
}

function normalizeQuat(q) {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (len < 1e-8) return [0, 0, 0, 1];
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

function rotateVec(v, q) {
  const u = [q[0], q[1], q[2]];
  const uv = cross(u, v);
  const uuv = cross(u, uv);
  return add(v, add(scale(uv, 2 * q[3]), scale(uuv, 2)));
}

function buildPlanetAxes(spinAxis) {
  const helper = Math.abs(dot(spinAxis, [0, 1, 0])) < 0.94 ? [0, 1, 0] : [1, 0, 0];
  const equatorX = normalize3(cross(helper, spinAxis));
  const equatorZ = normalize3(cross(spinAxis, equatorX));
  return { equatorX, equatorZ, north: spinAxis };
}

function planetPoint(axes, latitudeDeg, longitudeRad) {
  const lat = (latitudeDeg * Math.PI) / 180;
  const cosLat = Math.cos(lat);
  return normalize3(
    add(
      add(
        scale(axes.equatorX, Math.cos(longitudeRad) * cosLat),
        scale(axes.equatorZ, Math.sin(longitudeRad) * cosLat),
      ),
      scale(axes.north, Math.sin(lat)),
    ),
  );
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

export function createViewerSchematic({ root = document, onLatitudeAdjust = null } = {}) {
  const wrap = root.getElementById("viewerSchematic");
  const canvas = root.getElementById("viewerSchematicCanvas");
  const latitudeLabel = root.getElementById("viewerLatitude");
  const ctx = canvas ? canvas.getContext("2d") : null;
  let visible = false;
  let dragging = false;
  let pointerId = null;
  let lastClientY = 0;
  let lastRenderData = null;

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

  function setVisible(nextVisible) {
    visible = Boolean(nextVisible);
    if (!wrap) return;
    wrap.classList.toggle("hidden", !visible);
  }

  function buildDisplayState(data) {
    const observerNormal = normalize3(data.observerNormal || [0, 0, 1]);
    const viewerTangent = normalize3(data.viewerTangent || [0, 0, 1]);
    const primaryDir = normalize3(data.primaryDir || [1, 0, 0]);
    const secondaryDir = normalize3(data.secondaryDir || [0, 0, 1]);
    const spinAxis = normalize3(data.spinAxis || [0, 1, 0]);
    const latitudeDeg = Number(data.latitudeDeg) || 0;
    const planetAxes = buildPlanetAxes(spinAxis);

    const forward = normalize3([0.72, 0.54, 0.92]);
    const right = normalize3(cross([0, 1, 0], forward));
    const up = normalize3(cross(forward, right));
    const basis = { forward, right, up };

    const anchorVec = normalize3(add(add(scale(right, 0.48), scale(up, -0.5)), scale(forward, 0.72)));
    const anchorNorth = projectToTangent(add(scale(up, 0.9), scale(right, -0.08)), anchorVec);
    const localNorth = projectToTangent(spinAxis, observerNormal);
    const qAlign = quaternionFromUnitVectors(observerNormal, anchorVec);
    const rotatedNorth = projectToTangent(rotateVec(localNorth, qAlign), anchorVec);
    const twist = signedAngle(rotatedNorth, anchorNorth, anchorVec);
    const qTwist = quaternionFromAxisAngle(anchorVec, twist);
    const q = normalizeQuat(quaternionMultiply(qTwist, qAlign));

    return {
      basis,
      q,
      latitudeDeg,
      observerNormal,
      viewerTangent,
      primaryDir,
      secondaryDir,
      anchorVec,
      planetAxes,
    };
  }

  function projectRotated(point, state) {
    return projectPoint(rotateVec(point, state.q), state.basis);
  }

  function drawLatitudeRing(state, latDeg, cx, cy, r, color, width = 1, alphaLimit = 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    let penDown = false;
    for (let i = 0; i <= 96; i += 1) {
      const lon = (i / 96) * Math.PI * 2;
      const p = planetPoint(state.planetAxes, latDeg, lon);
      const pr = projectRotated(p, state);
      const x = cx + pr.x * r;
      const y = cy - pr.y * r;
      if (pr.z > alphaLimit) {
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

  function drawLatitudeLabel(state, latDeg, label, cx, cy, r) {
    let best = null;
    for (let i = 0; i <= 128; i += 1) {
      const lon = (i / 128) * Math.PI * 2;
      const p = planetPoint(state.planetAxes, latDeg, lon);
      const pr = projectRotated(p, state);
      if (pr.z <= 0.02) continue;
      if (!best || pr.x < best.x) {
        best = pr;
      }
    }
    if (!best) {
      const pole = latDeg >= 0 ? state.planetAxes.north : scale(state.planetAxes.north, -1);
      best = projectRotated(pole, state);
    }
    ctx.fillStyle = "rgba(220, 236, 255, 0.82)";
    ctx.font = "10px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, cx + best.x * r + 6, cy - best.y * r + 3);
  }

  function render(data) {
    if (!canvas || !ctx) return;
    resizeCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    lastRenderData = data || null;
    if (!data) {
      ctx.clearRect(0, 0, w, h);
      if (latitudeLabel) latitudeLabel.textContent = "LATITUDE --.-°";
      return;
    }

    const state = buildDisplayState(data);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = Math.min(w, h) * 0.32;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(4, 10, 26, 0.78)";
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(cx - r * 0.22, cy - r * 0.3, r * 0.08, cx, cy, r * 1.45);
    g.addColorStop(0, "rgba(184, 218, 255, 0.98)");
    g.addColorStop(0.36, "rgba(86, 152, 235, 0.95)");
    g.addColorStop(1, "rgba(20, 48, 98, 0.96)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    for (let lat = -60; lat <= 60; lat += 30) {
      drawLatitudeRing(state, lat, cx, cy, r, "rgba(164, 210, 255, 0.35)");
    }
    drawLatitudeRing(state, 0, cx, cy, r, "rgba(255, 238, 160, 0.5)", 1.15);
    drawLatitudeRing(
      state,
      clamp(state.latitudeDeg, -90, 90),
      cx,
      cy,
      r,
      "rgba(255, 245, 124, 0.82)",
      1.7,
    );

    const labelMap = [
      { lat: 90, text: "90N" },
      { lat: 60, text: "60N" },
      { lat: 30, text: "30N" },
      { lat: 0, text: "0" },
      { lat: -30, text: "30S" },
      { lat: -60, text: "60S" },
      { lat: -90, text: "90S" },
    ];
    for (const entry of labelMap) {
      drawLatitudeLabel(state, entry.lat, entry.text, cx, cy, r);
    }

    const site = projectRotated(state.observerNormal, state);
    const siteX = cx + site.x * r;
    const siteY = cy - site.y * r;

    ctx.fillStyle = "rgba(255, 245, 124, 0.98)";
    ctx.beginPath();
    ctx.arc(siteX, siteY, 4.8, 0, Math.PI * 2);
    ctx.fill();

    const viewHead = add(state.observerNormal, scale(state.viewerTangent, 0.46));
    const viewProj = projectRotated(viewHead, state);
    drawArrow(
      ctx,
      siteX,
      siteY,
      cx + viewProj.x * r,
      cy - viewProj.y * r,
      "rgba(255, 245, 124, 0.98)",
      2.2,
    );

    const sunHead = add(state.observerNormal, scale(state.primaryDir, 0.38));
    const sunProj = projectRotated(sunHead, state);
    drawArrow(
      ctx,
      siteX,
      siteY,
      cx + sunProj.x * r,
      cy - sunProj.y * r,
      "rgba(255, 188, 96, 0.95)",
      1.6,
    );

    const sun2Head = add(state.observerNormal, scale(state.secondaryDir, 0.3));
    const sun2Proj = projectRotated(sun2Head, state);
    drawArrow(
      ctx,
      siteX,
      siteY,
      cx + sun2Proj.x * r,
      cy - sun2Proj.y * r,
      "rgba(140, 184, 255, 0.92)",
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
      latitudeLabel.textContent = `LATITUDE ${clamp(state.latitudeDeg, -90, 90).toFixed(1)}\u00B0`;
    }
  }

  function handlePointerDown(e) {
    if (!visible || !canvas) return;
    dragging = true;
    pointerId = e.pointerId;
    lastClientY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function handlePointerMove(e) {
    if (!dragging || pointerId !== e.pointerId || typeof onLatitudeAdjust !== "function") return;
    const dy = e.clientY - lastClientY;
    lastClientY = e.clientY;
    if (Math.abs(dy) < 0.001) return;
    onLatitudeAdjust(dy * 0.56);
    e.preventDefault();
  }

  function handlePointerUp(e) {
    if (pointerId !== e.pointerId || !canvas) return;
    dragging = false;
    pointerId = null;
    canvas.releasePointerCapture(e.pointerId);
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  if (canvas) {
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
  }

  return {
    setVisible,
    render,
    resize: resizeCanvas,
    getLastRenderData: () => lastRenderData,
  };
}
