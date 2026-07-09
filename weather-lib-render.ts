// ============================================================
// weather-lib-render.ts — 修复版 (投影修正)
// ============================================================
import sharp from "sharp";
import type { RenderOptions, RenderResult, WindDataComponent, TrackPoint } from "./weather-lib-types";
import { fetchRadarImage, fetchCloudImage, getRadarList, getCloudList, getWindList, getWindData, getTyphoonList, getTyphoonNew, extractTrack } from "./weather-lib-data";

const AMAP_TILE = "https://webrd0{0}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style={1}&x={2}&y={3}&z={4}";
const SUBDOMAINS = ["1", "2", "3", "4"];
const TILE_SIZE = 256;

function mercatorY(lat: number): number {
  const r = lat * Math.PI / 180;
  return Math.log(Math.tan(r) + 1 / Math.cos(r));
}

function inverseMercatorY(y: number): number {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
}

function lngLatToPixel(lng: number, lat: number, zoom: number): { px: number; py: number } {
  const n = Math.pow(2, zoom) * TILE_SIZE;
  const px = (lng + 180) / 360 * n;
  const py = (1 - mercatorY(lat) / Math.PI) / 2 * n;
  return { px, py };
}

function calcZoomFromBounds(
  bounds: { west: number; south: number; east: number; north: number },
  canvasWidth: number,
  canvasHeight: number
): { zoom: number; centerLng: number; centerLat: number } {
  const geoW = bounds.east - bounds.west;
  const mercH = mercatorY(bounds.north) - mercatorY(bounds.south);
  const zW = Math.log2(360 * canvasWidth / (geoW * TILE_SIZE));
  const zH = Math.log2(2 * Math.PI * canvasHeight / (mercH * TILE_SIZE));
  const zoom = Math.round(Math.min(zW, zH));
  const centerLng = (bounds.west + bounds.east) / 2;
  const centerMerc = (mercatorY(bounds.north) + mercatorY(bounds.south)) / 2;
  const centerLat = inverseMercatorY(centerMerc);
  return { zoom, centerLng, centerLat };
}

async function fetchTile(x: number, y: number, z: number, style: number): Promise<Buffer> {
  const sub = SUBDOMAINS[Math.abs(x + y) % 4];
  const url = AMAP_TILE.replace("{0}", sub).replace("{1}", String(style)).replace("{2}", String(x)).replace("{3}", String(y)).replace("{4}", String(z));
  const resp = await fetch(url, { headers: { "User-Agent": "WeatherMapLib/1.0" } });
  return Buffer.from(await resp.arrayBuffer());
}

/**
 * 渲染纯底图（高德 Web Mercator 瓦片拼接）
 * @param options - 渲染选项（画布大小、缩放级别、中心点、地图样式）
 * @returns 包含 PNG buffer 和 dataUrl 的渲染结果
 */
export async function renderBaseMap(options: RenderOptions = {}): Promise<RenderResult> {
  const { width = 800, height = 600, zoom = 5, centerLng = 104, centerLat = 35, mapStyle = 8 } = options;
  const center = lngLatToPixel(centerLng, centerLat, zoom);
  const halfW = width / 2, halfH = height / 2;
  const maxTile = Math.pow(2, zoom);

  const startTX = Math.floor((center.px - halfW) / TILE_SIZE);
  const startTY = Math.floor((center.py - halfH) / TILE_SIZE);
  const endTX = Math.ceil((center.px + halfW) / TILE_SIZE);
  const endTY = Math.ceil((center.py + halfH) / TILE_SIZE);

  const tiles: Array<{ x: number; y: number; buf: Buffer }> = [];
  const promises: Promise<void>[] = [];
  for (let tx = startTX; tx < endTX; tx++) {
    for (let ty = startTY; ty < endTY; ty++) {
      if (tx < 0 || tx >= maxTile || ty < 0 || ty >= maxTile) continue;
      promises.push((async () => {
        tiles.push({ x: tx, y: ty, buf: await fetchTile(tx, ty, zoom, mapStyle) });
      })());
    }
  }
  await Promise.all(promises);

  const offsetX = (startTX * TILE_SIZE) - (center.px - halfW);
  const offsetY = (startTY * TILE_SIZE) - (center.py - halfH);

  const composites = tiles.map(t => ({
    input: t.buf,
    left: Math.round((t.x - startTX) * TILE_SIZE + offsetX),
    top: Math.round((t.y - startTY) * TILE_SIZE + offsetY),
  }));

  const base = await sharp({
    create: { width, height, channels: 4, background: { r: 248, g: 248, b: 248, alpha: 1 } }
  }).composite(composites).png().toBuffer();

  return { buffer: base, dataUrl: "data:image/png;base64," + base.toString("base64"), width, height };
}

function calcOverlay(
  bounds: { west: number; south: number; east: number; north: number },
  options: RenderOptions
) {
  const { width = 800, height = 600, zoom = 5, centerLng = 104, centerLat = 35 } = options;
  const center = lngLatToPixel(centerLng, centerLat, zoom);
  const halfW = width / 2, halfH = height / 2;

  const sw = lngLatToPixel(bounds.west, bounds.south, zoom);
  const ne = lngLatToPixel(bounds.east, bounds.north, zoom);

  let left = Math.round(sw.px - (center.px - halfW));
  let top = Math.round(ne.py - (center.py - halfH));
  let ow = Math.round(ne.px - sw.px);
  let oh = Math.round(sw.py - ne.py);

  if (left < 0) { ow += left; left = 0; }
  if (top < 0) { oh += top; top = 0; }
  if (left + ow > width) ow = width - left;
  if (top + oh > height) oh = height - top;
  if (ow <= 0 || oh <= 0) return null;

  return { left, top, width: ow, height: oh };
}

/**
 * 将雷达图像叠加到底图上
 * @param baseResult - 底图渲染结果
 * @param radarFilename - 雷达图像文件名
 * @param bounds - 雷达图像的地理边界
 * @param options - 渲染选项
 */
export async function renderRadarOverlay(
  baseResult: RenderResult,
  radarFilename: string,
  bounds: { west: number; south: number; east: number; north: number },
  options: RenderOptions
): Promise<RenderResult> {
  const overlay = calcOverlay(bounds, options);
  if (!overlay) {
    console.log("  Overlay outside canvas, returning base map only");
    return baseResult;
  }

  const radarBuf = await fetchRadarImage(radarFilename);
  const resized = await sharp(radarBuf).resize(overlay.width, overlay.height, { fit: "fill" }).png().toBuffer();
  const result = await sharp(baseResult.buffer).composite([{ input: resized, left: overlay.left, top: overlay.top }]).png().toBuffer();
  return { buffer: result, dataUrl: "data:image/png;base64," + result.toString("base64"), width: baseResult.width, height: baseResult.height };
}

/**
 * 将卫星云图叠加到底图上
 * @param baseResult - 底图渲染结果
 * @param cloudFilename - 云图文件名
 * @param bounds - 云图的地理边界
 * @param options - 渲染选项
 */
export async function renderCloudOverlay(
  baseResult: RenderResult,
  cloudFilename: string,
  bounds: { west: number; south: number; east: number; north: number },
  options: RenderOptions
): Promise<RenderResult> {
  const overlay = calcOverlay(bounds, options);
  if (!overlay) {
    console.log("  Overlay outside canvas, returning base map only");
    return baseResult;
  }

  const cloudBuf = await fetchCloudImage(cloudFilename);
  const resized = await sharp(cloudBuf).resize(overlay.width, overlay.height, { fit: "fill" }).png().toBuffer();
  const result = await sharp(baseResult.buffer).composite([{ input: resized, left: overlay.left, top: overlay.top }]).png().toBuffer();
  return { buffer: result, dataUrl: "data:image/png;base64," + result.toString("base64"), width: baseResult.width, height: baseResult.height };
}

const CHINA_BOUNDS = { west: 73, south: 12.2, east: 135, north: 54.2 };

/** 一键渲染全国雷达图（底图+最新雷达叠加） */
  const opts = { zoom, centerLng, centerLat, width: 800, height: 600, ...options };
  console.log("Rendering radar map...");
  const base = await renderBaseMap(opts);
  const radarList = await getRadarList();
  const latest = radarList.datas[radarList.datas.length - 1];
  return renderRadarOverlay(base, latest.fn, CHINA_BOUNDS, opts);
}

export async function renderChinaCloud(options: RenderOptions = {}): Promise<RenderResult> {
  const { zoom, centerLng, centerLat } = calcZoomFromBounds(CHINA_BOUNDS, options.width ?? 800, options.height ?? 600);
  const opts = { zoom, centerLng, centerLat, width: 800, height: 600, ...options };
  console.log("Rendering cloud map...");
  const base = await renderBaseMap(opts);
  const cloudList = await getCloudList();
  const latestGroup = cloudList.time[0];
  const latest = latestGroup.picPath[latestGroup.picPath.length - 1];
  return renderCloudOverlay(base, latest, CHINA_BOUNDS, opts);
}

function pixelToLngLat(worldX: number, worldY: number, zoom: number): { lng: number; lat: number } {
  const n = Math.pow(2, zoom) * TILE_SIZE;
  const lng = worldX / n * 360 - 180;
  const mercY = Math.PI * (1 - 2 * worldY / n);
  const lat = inverseMercatorY(mercY);
  return { lng, lat };
}

function interpolateWind(
  lon: number, lat: number,
  uData: number[], vData: number[],
  hdr: { nx: number; ny: number; lo1: number; la1: number; dx: number; dy: number }
): { u: number; v: number } {
  const { nx, ny, lo1, la1, dx, dy } = hdr;
  const gx = (lon - lo1) / dx;
  const gy = (la1 - lat) / dy;
  const i0 = Math.floor(gx);
  const j0 = Math.floor(gy);
  if (i0 < 0 || i0 >= nx - 1 || j0 < 0 || j0 >= ny - 1) return { u: 0, v: 0 };
  const i1 = i0 + 1, j1 = j0 + 1;
  const fx = gx - i0, fy = gy - j0;
  const idx = (j: number, i: number) => j * nx + i;
  const bilerp = (d: number[]) => {
    const v00 = d[idx(j0, i0)] ?? 0, v10 = d[idx(j0, i1)] ?? 0;
    const v01 = d[idx(j1, i0)] ?? 0, v11 = d[idx(j1, i1)] ?? 0;
    return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
  };
  return { u: bilerp(uData), v: bilerp(vData) };
}

function traceStreamline(
  canvasX: number, canvasY: number,
  offsetX: number, offsetY: number,
  uData: number[], vData: number[],
  hdr: { nx: number; ny: number; lo1: number; la1: number; dx: number; dy: number },
  zoom: number, forward: boolean,
  stepSize: number, maxSteps: number,
  w: number, h: number
): Array<{ x: number; y: number; speed: number }> {
  const pts: Array<{ x: number; y: number; speed: number }> = [];
  let cx = canvasX, cy = canvasY;

  for (let s = 0; s < maxSteps; s++) {
    if (cx < -60 || cx > w + 60 || cy < -60 || cy > h + 60) break;

    const worldX = cx + offsetX;
    const worldY = cy + offsetY;
    const geo = pixelToLngLat(worldX, worldY, zoom);
    const wind = interpolateWind(geo.lng, geo.lat, uData, vData, hdr);
    const speed = Math.sqrt(wind.u * wind.u + wind.v * wind.v);
    if (speed < 0.5) break;

    pts.push({ x: cx, y: cy, speed });

    const dir = forward ? 1 : -1;
    cx += dir * (wind.u / speed) * stepSize;
    cy -= dir * (wind.v / speed) * stepSize;
  }

  return pts;
}

function windColor(speed: number, alpha: number): string {
  const a = alpha.toFixed(2);
  if (speed < 5) return `rgba(100,200,255,${a})`;
  if (speed < 10) return `rgba(80,255,80,${a})`;
  if (speed < 15) return `rgba(255,255,50,${a})`;
  if (speed < 20) return `rgba(255,150,30,${a})`;
  if (speed < 25) return `rgba(255,50,50,${a})`;
  return `rgba(255,50,200,${a})`;
}

function buildWindSVG(
  windData: WindDataComponent[],
  opts: { width: number; height: number; zoom: number; centerLng: number; centerLat: number }
): string {
  const { width, height, zoom, centerLng, centerLat } = opts;
  const center = lngLatToPixel(centerLng, centerLat, zoom);
  const halfW = width / 2, halfH = height / 2;
  const offsetX = center.px - halfW;
  const offsetY = center.py - halfH;

  const uComp = windData.find(c => c.header.parameterNumber === 2);
  const vComp = windData.find(c => c.header.parameterNumber === 3);
  if (!uComp || !vComp) return `<svg width="${width}" height="${height}"></svg>`;

  const hdr = uComp.header;
  const uData = uComp.data;
  const vData = vComp.data;

  const SEED = 28, STEP = 3, MAX = 100, ARROW = 50;

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

  for (let sx = SEED / 2; sx < width; sx += SEED) {
    for (let sy = SEED / 2; sy < height; sy += SEED) {
      const fwd = traceStreamline(sx, sy, offsetX, offsetY, uData, vData, hdr, zoom, true, STEP, MAX, width, height);
      const bwd = traceStreamline(sx, sy, offsetX, offsetY, uData, vData, hdr, zoom, false, STEP, MAX, width, height);
      const all = [...bwd.reverse(), ...fwd.slice(1)];
      if (all.length < 8) continue;

      const maxSpeed = all.reduce((s, p) => Math.max(s, p.speed), 0);
      const color = windColor(maxSpeed, 0.75);
      const ptsStr = all.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      svg += `<polyline points="${ptsStr}" stroke="${color}" stroke-width="1.3" fill="none" opacity="0.8" />`;

      for (let a = Math.floor(ARROW / 2); a < all.length - 1; a += ARROW) {
        const p0 = all[a];
        const p1 = all[Math.min(a + 1, all.length - 1)];
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        const hl = 5;
        const ax1 = p1.x - hl * Math.cos(angle - 0.5);
        const ay1 = p1.y - hl * Math.sin(angle - 0.5);
        const ax2 = p1.x - hl * Math.cos(angle + 0.5);
        const ay2 = p1.y - hl * Math.sin(angle + 0.5);
        svg += `<polygon points="${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${ax1.toFixed(1)},${ay1.toFixed(1)} ${ax2.toFixed(1)},${ay2.toFixed(1)}" fill="${color}" />`;
      }
    }
  }

  const lx = 10, ly = 10, lw = 130, lh = 22;
  const items = [
    { label: "0-5 m/s", color: windColor(2.5, 0.8) },
    { label: "5-10", color: windColor(7.5, 0.8) },
    { label: "10-15", color: windColor(12.5, 0.8) },
    { label: "15-20", color: windColor(17.5, 0.8) },
    { label: "20-25", color: windColor(22.5, 0.8) },
    { label: "25+", color: windColor(28, 0.8) },
  ];
  svg += `<g transform="translate(${lx},${ly})">`;
  svg += `<rect x="0" y="0" width="${lw}" height="${items.length * lh + 10}" fill="rgba(0,0,0,0.65)" rx="4" />`;
  svg += `<text x="${lw / 2}" y="16" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">风速 m/s</text>`;
  for (let i = 0; i < items.length; i++) {
    const iy = 24 + i * lh;
    svg += `<rect x="8" y="${iy}" width="18" height="14" fill="${items[i].color}" />`;
    svg += `<text x="32" y="${iy + 12}" fill="#fff" font-size="10">${items[i].label}</text>`;
  }
  svg += `</g>`;

  svg += `</svg>`;
  return svg;
}

function buildTyphoonSVG(
  track: TrackPoint[],
  forecast: Array<{ lng: number; lat: number; time: string; intensity: string }>,
  name: string,
  opts: { width: number; height: number; zoom: number; centerLng: number; centerLat: number }
): string {
  const { width, height, zoom, centerLng, centerLat } = opts;
  const center = lngLatToPixel(centerLng, centerLat, zoom);
  const halfW = width / 2, halfH = height / 2;

  const toCanvas = (lng: number, lat: number) => {
    const p = lngLatToPixel(lng, lat, zoom);
    return { x: p.px - (center.px - halfW), y: p.py - (center.py - halfH) };
  };

  const pts = track.map(t => ({ ...toCanvas(t.lng, t.lat), ...t }));
  const visible = pts.filter(p => p.x >= -50 && p.x <= width + 50 && p.y >= -50 && p.y <= height + 50);
  if (visible.length < 2) return `<svg width="${width}" height="${height}"></svg>`;

  const fpts = forecast.map(f => ({ ...toCanvas(f.lng, f.lat), ...f }));
  const fvisible = fpts.filter(p => p.x >= -50 && p.x <= width + 50 && p.y >= -50 && p.y <= height + 50);

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

  const latest = track[track.length - 1];
  const lp = toCanvas(latest.lng, latest.lat);

  const kmPerPx = (360 / (256 * Math.pow(2, zoom))) * 111.32 * Math.cos(latest.lat * Math.PI / 180);

  if (lp.x >= -50 && lp.x <= width + 50 && lp.y >= -50 && lp.y <= height + 50) {
    const circles = latest.windCircles;
    if (circles) {
      const levels = [
        { r: circles.lv7, label: "7级", stroke: "rgba(255,200,0,0.7)", fill: "rgba(255,200,0,0.1)" },
        { r: circles.lv10, label: "10级", stroke: "rgba(255,120,0,0.7)", fill: "rgba(255,120,0,0.1)" },
        { r: circles.lv12, label: "12级", stroke: "rgba(255,40,0,0.7)", fill: "rgba(255,40,0,0.1)" },
      ];
      for (let i = levels.length - 1; i >= 0; i--) {
        const lv = levels[i];
        if (lv.r > 0) {
          const r = lv.r / kmPerPx;
          svg += `<ellipse cx="${lp.x.toFixed(1)}" cy="${lp.y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${r.toFixed(1)}" stroke="${lv.stroke}" fill="${lv.fill}" stroke-width="2" />`;
          svg += `<text x="${(lp.x + r * 0.7).toFixed(1)}" y="${(lp.y - 6).toFixed(1)}" fill="${lv.stroke}" font-size="10" stroke="#000" stroke-width="2.5" paint-order="stroke">${lv.label} ${lv.r}km</text>`;
        }
      }
    }
  }

  const dots = visible.map((p, i) => {
    const isLast = i === visible.length - 1;
    const fill = isLast ? "#ff0000" : "#ffcc00";
    const r = isLast ? 5 : 3;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="1" />`;
  }).join("");
  svg += dots;

  const polyline = visible.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  svg += `<polyline points="${polyline}" stroke="#ff6600" stroke-width="2.5" fill="none" opacity="0.9" />`;

  if (fvisible.length >= 1) {
    const fAll = [toCanvas(latest.lng, latest.lat), ...fvisible];
    const fptsStr = fAll.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    svg += `<polyline points="${fptsStr}" stroke="#ffcc00" stroke-width="2.5" stroke-dasharray="8,5" fill="none" opacity="0.9" />`;
    for (const fp of fvisible) {
      svg += `<circle cx="${fp.x.toFixed(1)}" cy="${fp.y.toFixed(1)}" r="4" fill="none" stroke="#ffcc00" stroke-width="2.5" />`;
      svg += `<text x="${(fp.x + 8).toFixed(1)}" y="${(fp.y - 6).toFixed(1)}" fill="#ffcc00" font-size="10" font-weight="bold" stroke="#000" stroke-width="2.5" paint-order="stroke">${fp.intensity || ""}</text>`;
    }
  }

  const LABEL_EVERY = 5;
  for (let i = 0; i < visible.length; i += LABEL_EVERY) {
    const p = visible[i];
    const t = (p.time || "").replace("2026-", "").replace(" ", "\n");
    const lines = t.split("\n");
    for (let li = 0; li < lines.length; li++) {
      svg += `<text x="${(p.x + 8).toFixed(1)}" y="${(p.y - 6 + li * 11).toFixed(1)}" fill="#fff" font-size="9" stroke="#000" stroke-width="2.5" paint-order="stroke">${lines[li]}</text>`;
    }
  }

  if (lp.x >= -50 && lp.x <= width + 50 && lp.y >= -50 && lp.y <= height + 50) {
    svg += `<circle cx="${lp.x.toFixed(1)}" cy="${lp.y.toFixed(1)}" r="24" fill="none" stroke="#fff" stroke-width="2" opacity="0.4" />`;
    svg += `<circle cx="${lp.x.toFixed(1)}" cy="${lp.y.toFixed(1)}" r="12" fill="rgba(255,0,0,0.85)" stroke="#fff" stroke-width="2.5" />`;

    const infoLines = [
      name,
      `${latest.intensity}  ${latest.windSpeed}m/s  ${latest.pressure}hPa`,
      `${latest.lng}°E  ${latest.lat}°N`,
      latest.direction && latest.moveSpeed ? `移动 ${latest.direction}  ${latest.moveSpeed}km/h` : "",
      latest.time || "",
    ].filter(Boolean);

    const boxX = lp.x + 26, boxY = lp.y - 22;
    const boxH = infoLines.length * 14 + 8;
    svg += `<rect x="${boxX.toFixed(1)}" y="${(boxY - 8).toFixed(1)}" width="155" height="${boxH}" fill="rgba(0,0,0,0.75)" rx="4" />`;
    for (let li = 0; li < infoLines.length; li++) {
      svg += `<text x="${(boxX + 6).toFixed(1)}" y="${(boxY + li * 14).toFixed(1)}" fill="${li === 0 ? "#ff4444" : "#ccc"}" font-size="${li === 0 ? 13 : 10}" font-weight="${li === 0 ? "bold" : "normal"}" stroke="#000" stroke-width="2" paint-order="stroke">${infoLines[li]}</text>`;
    }
  }

  const lx = width - 175, ly = 10;
  svg += `<g transform="translate(${lx},${ly})">`;
  svg += `<rect x="0" y="0" width="165" height="125" fill="rgba(0,0,0,0.7)" rx="4" />`;
  svg += `<text x="82" y="16" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">图例</text>`;
  const legendItems = [
    { type: "circle", r: 5, fill: "#ff0000", stroke: "#fff", label: "当前位置" },
    { type: "circle", r: 3, fill: "#ffcc00", stroke: "#fff", label: "历史路径点" },
    { type: "line", stroke: "#ff6600", sw: 2.5, label: "历史路径" },
    { type: "line", stroke: "#ffcc00", sw: 2.5, dash: "8,5", label: "预测路径" },
    { type: "ellipse", stroke: "rgba(255,200,0,0.7)", fill: "rgba(255,200,0,0.1)", label: "7/10/12级风圈" },
  ];
  for (let i = 0; i < legendItems.length; i++) {
    const item = legendItems[i];
    const iy = 26 + i * 18;
    if (item.type === "circle") {
      svg += `<circle cx="12" cy="${iy}" r="${item.r}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="1" />`;
    } else if (item.type === "line") {
      svg += `<line x1="2" y1="${iy}" x2="22" y2="${iy}" stroke="${item.stroke}" stroke-width="${item.sw}" ${item.dash ? `stroke-dasharray="${item.dash}"` : ""} />`;
    } else if (item.type === "ellipse") {
      svg += `<ellipse cx="12" cy="${iy}" rx="10" ry="5" stroke="${item.stroke}" fill="${item.fill}" stroke-width="1.5" />`;
    }
    svg += `<text x="28" y="${iy + 4}" fill="#ccc" font-size="10">${item.label}</text>`;
  }
  svg += `</g>`;

  svg += `</svg>`;
  return svg;
}

export async function renderWindOverlay(
  baseResult: RenderResult,
  windData: WindDataComponent[],
  options: RenderOptions
): Promise<RenderResult> {
  const { width = 800, height = 600, zoom = 4, centerLng = 104, centerLat = 35.91 } = options;
  const svg = buildWindSVG(windData, { width, height, zoom, centerLng, centerLat });
  const result = await sharp(baseResult.buffer)
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
    .png()
    .toBuffer();
  return { buffer: result, dataUrl: "data:image/png;base64," + result.toString("base64"), width, height };
}

export async function renderTyphoonOverlay(
  baseResult: RenderResult,
  track: TrackPoint[],
  forecast: Array<{ lng: number; lat: number; time: string; intensity: string }>,
  name: string,
  options: RenderOptions
): Promise<RenderResult> {
  const { width = 800, height = 600, zoom = 4, centerLng = 104, centerLat = 35.91 } = options;
  const svg = buildTyphoonSVG(track, forecast, name, { width, height, zoom, centerLng, centerLat });
  const result = await sharp(baseResult.buffer)
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
    .png()
    .toBuffer();
  return { buffer: result, dataUrl: "data:image/png;base64," + result.toString("base64"), width, height };
}

export async function renderChinaWind(options: RenderOptions = {}): Promise<RenderResult> {
  const { zoom, centerLng, centerLat } = calcZoomFromBounds(CHINA_BOUNDS, options.width ?? 800, options.height ?? 600);
  const opts = { zoom, centerLng, centerLat, width: 800, height: 600, ...options };
  console.log("Rendering wind map...");
  const baseResult = await renderBaseMap(opts);
  const darkBuf = await sharp(baseResult.buffer)
    .negate({ alpha: false })
    .modulate({ saturation: 0.3, brightness: 0.85 })
    .png()
    .toBuffer();
  const darkResult: RenderResult = { buffer: darkBuf, dataUrl: "data:image/png;base64," + darkBuf.toString("base64"), width: baseResult.width, height: baseResult.height };
  const windList = await getWindList();
  const windData = await getWindData(windList[0].url);
  return renderWindOverlay(darkResult, windData, opts);
}

export async function renderChinaTyphoon(options: RenderOptions = {}): Promise<RenderResult> {
  console.log("Rendering typhoon map...");
  const typhoonList = await getTyphoonList();
  if (typhoonList.length === 0) {
    const { zoom, centerLng, centerLat } = calcZoomFromBounds(CHINA_BOUNDS, options.width ?? 800, options.height ?? 600);
    return renderBaseMap({ zoom, centerLng, centerLat, width: 800, height: 600, ...options });
  }
  const latestTyphoon = typhoonList[0];
  const tf = await getTyphoonNew(latestTyphoon.code);
  const track = extractTrack(tf);
  const latest = track[track.length - 1];

  const forecast: Array<{ lng: number; lat: number; time: string; intensity: string }> = [];
  const rawTrack = tf.typhoon[8] as any[];
  if (rawTrack && rawTrack.length > 0) {
    const lastPoint = rawTrack[rawTrack.length - 1];
    const agencies = lastPoint[11] as Record<string, any[]> | undefined;
    if (agencies) {
      const babj = agencies["BABJ"] || Object.values(agencies)[0];
      if (babj) {
        for (const fp of babj) {
          forecast.push({ time: fp[1] || "", lng: parseFloat(fp[2]), lat: parseFloat(fp[3]), intensity: fp[4] || "" });
        }
      }
    }
  }

  const opts = { zoom: 5, centerLng: latest.lng, centerLat: latest.lat, width: 800, height: 600, ...options };
  console.log(`  Typhoon: ${latestTyphoon.title} ${latest.intensity} ${latest.lng}E ${latest.lat}N`);
  const base = await renderBaseMap(opts);
  return renderTyphoonOverlay(base, track, forecast, latestTyphoon.title, opts);
}

export async function renderTyphoonOverview(options: RenderOptions = {}): Promise<RenderResult> {
  console.log("Rendering typhoon overview...");
  const typhoonList = await getTyphoonList();
  if (typhoonList.length === 0) return renderBaseMap(options);
  const latestTyphoon = typhoonList[0];
  const tf = await getTyphoonNew(latestTyphoon.code);
  const track = extractTrack(tf);

  const forecast: Array<{ lng: number; lat: number; time: string; intensity: string }> = [];
  const rawTrack = tf.typhoon[8] as any[];
  if (rawTrack && rawTrack.length > 0) {
    const lastPoint = rawTrack[rawTrack.length - 1];
    const agencies = lastPoint[11] as Record<string, any[]> | undefined;
    if (agencies) {
      const babj = agencies["BABJ"] || Object.values(agencies)[0];
      if (babj) {
        for (const fp of babj) {
          forecast.push({ time: fp[1] || "", lng: parseFloat(fp[2]), lat: parseFloat(fp[3]), intensity: fp[4] || "" });
        }
      }
    }
  }

  let west = 180, east = -180, south = 90, north = -90;
  for (const p of track) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }
  for (const p of forecast) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }

  const padLon = Math.max((east - west) * 0.25, 2);
  const padLat = Math.max((north - south) * 0.25, 2);
  const bounds = { west: west - padLon, east: east + padLon, south: south - padLat, north: north + padLat };

  const canvasW = options.width ?? 800;
  const canvasH = options.height ?? 600;
  const { zoom, centerLng, centerLat } = calcZoomFromBounds(bounds, canvasW, canvasH);

  const opts = { zoom, centerLng, centerLat, width: canvasW, height: canvasH, ...options };
  console.log(`  Overview: zoom=${zoom} center=${centerLng.toFixed(1)}E,${centerLat.toFixed(1)}N`);

  const base = await renderBaseMap(opts);
  return renderTyphoonOverlay(base, track, forecast, latestTyphoon.title, opts);
}

export async function saveToFile(result: RenderResult, filepath: string): Promise<string> {
  const fs = await import("node:fs");
  fs.writeFileSync(filepath, result.buffer);
  return filepath;
}

export function toDataUrl(result: RenderResult): string {
  return result.dataUrl;
}