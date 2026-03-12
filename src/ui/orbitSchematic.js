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

export function createOrbitSchematic({ root = document } = {}) {
  const wrap = root.getElementById("orbitSchematic");
  const canvas = root.getElementById("orbitSchematicCanvas");
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
      return;
    }

    const cx = w * 0.5;
    const cy = h * 0.54;
    const mapR = Math.min(w, h) * 0.36;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(5, 12, 30, 0.78)";
    ctx.fillRect(0, 0, w, h);

    const starA = data.starA;
    const starB = data.starB;
    const planet = data.planet;
    const spinDir = data.spinDir;
    const viewerDir = data.viewerDir;
    const combinedStarDir = data.combinedStarDir;
    const viewerLightDot = Number(data.viewerLightDot) || 0;
    const primaryAltitudeDeg = Number(data.primaryAltitudeDeg) || 0;
    const secondaryAltitudeDeg = Number(data.secondaryAltitudeDeg) || 0;
    const resonanceLabel = data.resonanceLabel || "13:2";
    const resonanceStrength = Math.max(0, Math.min(1, Number(data.resonanceStrength) || 0));
    const resonanceWindow = Math.max(0, Math.min(1, Number(data.resonanceWindow) || 0));
    const orbitalR = Math.max(0.001, Number(data.orbitRadius) || 1);
    const dynamicR = Math.max(
      orbitalR,
      Math.hypot(starA[0], starA[1]),
      Math.hypot(starB[0], starB[1]),
      Math.hypot(planet[0], planet[1]),
    ) + 2;
    const scale = mapR / dynamicR;

    function p(v) {
      return [cx + v[0] * scale, cy - v[1] * scale];
    }

    ctx.strokeStyle = "rgba(110, 170, 255, 0.28)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, (mapR * i) / 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(130, 205, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(cx, cy, orbitalR * scale, 0, Math.PI * 2);
    ctx.stroke();
    if (resonanceWindow > 0.001) {
      ctx.strokeStyle = `rgba(255, 220, 120, ${0.14 + resonanceWindow * 0.5})`;
      ctx.lineWidth = 1.5 + resonanceWindow * 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, orbitalR * scale + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    const [sxA, syA] = p(starA);
    const [sxB, syB] = p(starB);
    const [px0, py0] = p(planet);

    function body(x, y, r, core, glow) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.1);
      g.addColorStop(0, core);
      g.addColorStop(0.45, glow);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    body(sxA, syA, 6.8, "#fff3c6", "rgba(255, 194, 86, 0.7)");
    body(sxB, syB, 5.8, "#dbe8ff", "rgba(121, 168, 255, 0.75)");
    body(px0, py0, 4.2, "#8cc2ff", "rgba(62, 122, 255, 0.6)");
    ctx.fillStyle = "rgba(255, 211, 125, 0.95)";
    ctx.font = "10px 'Trebuchet MS', sans-serif";
    ctx.fillText("A", sxA + 9, syA - 8);
    ctx.fillStyle = "rgba(177, 207, 255, 0.95)";
    ctx.fillText("B", sxB + 9, syB - 8);
    ctx.fillStyle = "rgba(160, 214, 255, 0.95)";
    ctx.fillText("P", px0 + 8, py0 - 8);

    const siteOffset = 9.5;
    const siteX = px0 + spinDir[0] * siteOffset;
    const siteY = py0 - spinDir[1] * siteOffset;
    const spinLen = 22;
    const viewLen = 34;
    drawArrow(
      ctx,
      siteX,
      siteY,
      siteX + combinedStarDir[0] * 26,
      siteY - combinedStarDir[1] * 26,
      "rgba(255, 186, 92, 0.9)",
      1.4,
    );
    drawArrow(
      ctx,
      px0,
      py0,
      px0 + spinDir[0] * spinLen,
      py0 - spinDir[1] * spinLen,
      "rgba(120, 220, 255, 0.95)",
      1.5,
    );
    ctx.fillStyle = "rgba(255, 244, 110, 0.98)";
    ctx.beginPath();
    ctx.arc(siteX, siteY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    drawArrow(
      ctx,
      siteX,
      siteY,
      siteX + viewerDir[0] * viewLen,
      siteY - viewerDir[1] * viewLen,
      "rgba(255, 244, 110, 0.95)",
      2.2,
    );

    ctx.fillStyle = "rgba(220, 238, 255, 0.92)";
    ctx.font = "11px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ORBITAL SCHEMATIC", 10, 16);
    ctx.fillStyle = viewerLightDot > 0 ? "rgba(255, 238, 130, 0.95)" : "rgba(142, 188, 255, 0.95)";
    ctx.fillText(viewerLightDot > 0 ? "viewer: day" : "viewer: night", 10, 31);
    ctx.fillStyle = "rgba(200, 225, 255, 0.85)";
    ctx.fillText(`sun A alt ${primaryAltitudeDeg.toFixed(1)}°`, 10, 46);
    ctx.fillText(`sun B alt ${secondaryAltitudeDeg.toFixed(1)}°`, 10, 60);
    ctx.fillStyle = "rgba(185, 225, 255, 0.85)";
    ctx.fillText("site", 12, h - 20);
    ctx.fillStyle = "rgba(255, 186, 92, 0.9)";
    ctx.fillText("sun", 44, h - 20);
    ctx.fillStyle = "rgba(255, 244, 110, 0.95)";
    ctx.fillText("viewer", 76, h - 20);

    const meterW = 74;
    const meterH = 8;
    const meterX = w - meterW - 16;
    const meterY = 14;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(214, 233, 255, 0.88)";
    ctx.fillText(`${resonanceLabel} near-res`, w - 16, 16);
    ctx.fillStyle = "rgba(14, 24, 48, 0.88)";
    ctx.fillRect(meterX, meterY + 7, meterW, meterH);
    ctx.strokeStyle = "rgba(120, 170, 255, 0.42)";
    ctx.strokeRect(meterX, meterY + 7, meterW, meterH);
    ctx.fillStyle = `rgba(255, 218, 119, ${0.5 + resonanceStrength * 0.4})`;
    ctx.fillRect(meterX, meterY + 7, meterW * resonanceStrength, meterH);
    ctx.textAlign = "left";
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  return {
    setVisible,
    render,
    resize: resizeCanvas,
  };
}
