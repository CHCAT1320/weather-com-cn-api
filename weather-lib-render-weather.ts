// ============================================================
// weather-lib-render-weather.ts — 我的天气可视化
// ============================================================
import sharp from "sharp";
import type { WeatherRenderOptions, RenderResult, WeatherSK, WeatherZS, WeatherFC, WeatherAlarm, HourWeatherItem } from "./weather-lib-types";
import { getWeatherIndex, getHourlyWeather } from "./weather-lib-data";

const WEATHER_ICON: Record<string, string> = {
  "00": "☀", "01": "⛅", "02": "☁", "03": "🌦", "04": "⛈",
  "05": "⛈", "06": "🌨", "07": "🌧", "08": "🌧", "09": "🌧",
  "10": "🌧", "11": "🌧", "12": "🌧", "13": "🌨", "14": "❄",
  "15": "❄", "16": "❄", "17": "❄", "18": "🌫", "19": "🌧",
  "20": "🌪", "21": "🌧", "22": "🌧", "23": "🌧", "24": "🌧",
  "25": "🌧", "26": "🌨", "27": "🌨", "28": "🌨", "29": "🌪",
  "30": "🌪", "31": "🌪", "301": "🌧", "302": "❄",
};

function weatherEmoji(code: string): string {
  return WEATHER_ICON[code.replace(/^[dn]/, "")] || "🌤";
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function aqiColor(aqi: number): string {
  if (aqi <= 50) return "#00e400";
  if (aqi <= 100) return "#ff0";
  if (aqi <= 150) return "#ff7e00";
  if (aqi <= 200) return "#f00";
  if (aqi <= 300) return "#99004c";
  return "#7e0023";
}

function aqiLabel(aqi: number): string {
  if (aqi <= 50) return "优";
  if (aqi <= 100) return "良";
  if (aqi <= 150) return "轻度";
  if (aqi <= 200) return "中度";
  if (aqi <= 300) return "重度";
  return "严重";
}

function formatHourTime(raw: string): string[] {
  const m = raw.match(/^(\d+)月(\d+)日(\d+)时$/);
  if (m) return [m[2] + "日", m[3] + ":00"];
  return [raw, ""];
}

// ==================== Card ====================

function buildCard(sk: WeatherSK, zs: WeatherZS, alarms: WeatherAlarm[], fc: WeatherFC[], opts: Required<WeatherRenderOptions>): string {
  const { bg, fg, accent, secondary } = opts;
  const W = 580;
  const P = 28;
  const R = 16;
  const aqi = parseInt(sk.aqi) || 0;
  const aqiC = aqiColor(aqi);

  const lines: string[] = [];
  const add = (s: string) => lines.push(s);

  add(`<rect width="${W}" height="100%" fill="${bg}" rx="${R}"/>`);

  // 标题行
  const titleY = 44;
  const now = new Date();
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const nowStr = `${String(now.getMonth() + 1).padStart(2, "0")}月${String(now.getDate()).padStart(2, "0")}日(星期${weekDays[now.getDay()]}) ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  add(`<text x="${P}" y="${titleY}" fill="${fg}" font-size="30" font-weight="bold">${esc(sk.cityname)}</text>`);
  add(`<text x="${W - P}" y="${titleY - 4}" fill="${fg}" opacity="0.45" font-size="14" text-anchor="end">${esc(sk.date)} ${esc(sk.time)} 发布</text>`);
  add(`<text x="${W - P}" y="${titleY + 14}" fill="${fg}" opacity="0.3" font-size="11" text-anchor="end">${nowStr}</text>`);

  // 分隔线
  const sep1 = titleY + 22;
  add(`<line x1="${P}" y1="${sep1}" x2="${W - P}" y2="${sep1}" stroke="${secondary}" stroke-opacity="0.15"/>`);

  // 天气主区域 — 左右分栏
  const heroY = sep1 + 20;
  const heroH = 120;
  const centerY = heroY + heroH / 2;
  const colLeft = P;

  // 左侧: 温度大字 (80px 字体，vertical center ≈ baseline - 28)
  const tempStr = esc(sk.temp);
  const tempDigits = tempStr.replace(/[^0-9]/g, "").length || 1;
  const tempW = tempDigits * 48;
  add(`<text x="${colLeft}" y="${centerY + 28}" fill="${fg}" font-size="80" font-weight="bold">${tempStr}</text>`);
  add(`<text x="${colLeft + tempW + 4}" y="${centerY - 22}" fill="${fg}" font-size="36">°</text>`);

  // 中间: 天气描述 — 在温度右侧和AQI之间居中
  const tempRight = colLeft + tempW + 30;
  const badgeLeft = W - P - 76;
  const descX = (tempRight + badgeLeft) / 2;
  add(`<text x="${descX}" y="${heroY + 35}" fill="${fg}" font-size="28" text-anchor="middle">${esc(sk.weather)}  <tspan font-size="42">${weatherEmoji(sk.weathercode)}</tspan></text>`);
  add(`<text x="${descX}" y="${heroY + 69}" fill="${secondary}" font-size="15" text-anchor="middle">${esc(sk.WD)} ${esc(sk.WS)}</text>`);
  add(`<text x="${descX}" y="${heroY + 93}" fill="${secondary}" font-size="14" text-anchor="middle">湿度 ${esc(sk.SD)}  降水 ${esc(sk.rain)}mm  气压 ${esc(sk.qy)}hPa</text>`);
  const rain24h = sk.rain24h !== "0" ? `24h ${esc(sk.rain24h)}mm` : "";
  const rainProb = fc.length > 0 && fc[0].fn !== "0" ? `概率 ${esc(fc[0].fn)}%` : "";
  const rainExtra = [rain24h, rainProb].filter(Boolean).join("  ");
  if (rainExtra) {
    add(`<text x="${descX}" y="${heroY + 115}" fill="${secondary}" font-size="12" text-anchor="middle">${rainExtra}</text>`);
  }

  // 右侧: AQI 徽章
  const badgeX = W - P - 76;
  const badgeY = centerY - 43;
  add(`<rect x="${badgeX}" y="${badgeY}" width="72" height="86" fill="${aqiC}" opacity="0.12" rx="10" stroke="${aqiC}" stroke-width="1.5"/>`);
  add(`<text x="${badgeX + 36}" y="${badgeY + 30}" fill="${aqiC}" font-size="32" font-weight="bold" text-anchor="middle">${sk.aqi}</text>`);
  add(`<text x="${badgeX + 36}" y="${badgeY + 52}" fill="${aqiC}" font-size="13" text-anchor="middle">AQI ${aqiLabel(aqi)}</text>`);
  add(`<text x="${badgeX + 36}" y="${badgeY + 70}" fill="${secondary}" font-size="12" text-anchor="middle">PM2.5 ${sk.aqi_pm25}</text>`);

  // 分隔线 2
  const sep2 = heroY + heroH + 14;
  add(`<line x1="${P}" y1="${sep2}" x2="${W - P}" y2="${sep2}" stroke="${secondary}" stroke-opacity="0.15"/>`);

  // 预警
  let alarmH = 0;
  if (alarms.length > 0) {
    alarmH = 50;
    const aY = sep2 + 14;
    add(`<rect x="${P}" y="${aY}" width="${W - P * 2}" height="${alarmH}" fill="${accent}" opacity="0.1" rx="8"/>`);
    for (let i = 0; i < Math.min(alarms.length, 3); i++) {
      const a = alarms[i];
      const ax = P + 20 + i * 178;
      const lvl = a.w7;
      const lvlColor = lvl.includes("红") ? "#f00" : lvl.includes("橙") ? "#ff7e00" : lvl.includes("黄") ? "#ff0" : "#4fc3f7";
      add(`<circle cx="${ax}" cy="${aY + 25}" r="6" fill="${lvlColor}"/>`);
      add(`<text x="${ax + 16}" y="${aY + 29}" fill="${fg}" font-size="14">${esc(a.w5)}${esc(lvl)}预警</text>`);
    }
  }

  // 生活指数 — 3列2行
  const idxTitleY = sep2 + (alarmH > 0 ? alarmH + 38 : 18);
  add(`<text x="${P}" y="${idxTitleY}" fill="${fg}" font-size="16" font-weight="bold">生活指数</text>`);

  const indices = [
    { z: zs.ct, icon: "👔" },
    { z: zs.uv, icon: "☀" },
    { z: zs.xc, icon: "🚗" },
    { z: zs.gm, icon: "🤧" },
    { z: zs.yd, icon: "🏃" },
    { z: zs.ys, icon: "☂" },
  ];
  const cols = 3;
  const icW = (W - P * 2) / cols;
  const rowH = 150;
  const icY0 = idxTitleY + 50;
  for (let i = 0; i < indices.length; i++) {
    const { z, icon } = indices[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = P + col * icW + icW / 2;
    const cy = icY0 + row * rowH;
    add(`<text x="${cx}" y="${cy + 10}" fill="${fg}" font-size="56" text-anchor="middle">${icon}</text>`);
    add(`<text x="${cx}" y="${cy + 56}" fill="${fg}" font-size="20" font-weight="bold" text-anchor="middle">${esc(z.hint)}</text>`);
    add(`<text x="${cx}" y="${cy + 90}" fill="${secondary}" font-size="16" text-anchor="middle">${esc(z.name)}</text>`);
  }

  const totalH = icY0 + rowH + 110;
  return `<svg width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}" xmlns="http://www.w3.org/2000/svg">${lines.join("")}</svg>`;
}

// ==================== 7天预报 ====================

function buildForecastChart(fc: WeatherFC[], opts: Required<WeatherRenderOptions>): string {
  const { bg, fg, accent, secondary } = opts;
  const W = 700;
  const H = 360;
  const P = 28;
  const R = 16;

  const titleH = 34;
  const dateH = 42;
  const iconH = 30;
  const bottomPad = 16;
  const chartTop = titleH + dateH + P;
  const chartBottom = H - iconH - bottomPad - 8;
  const chartH = chartBottom - chartTop;
  const chartLeft = P + 48;
  const chartRight = W - P;
  const chartW = chartRight - chartLeft;

  const highs = fc.map(f => parseInt(f.fc));
  const lows = fc.map(f => parseInt(f.fd));
  const allTemps = highs.concat(lows);
  const tMin = Math.min(...allTemps) - 3;
  const tMax = Math.max(...allTemps) + 3;
  const tRange = tMax - tMin || 1;
  const toY = (t: number) => chartBottom - ((t - tMin) / tRange) * chartH;

  const lines: string[] = [];
  const add = (s: string) => lines.push(s);

  add(`<rect width="${W}" height="${H}" fill="${bg}" rx="${R}"/>`);
  add(`<text x="${P}" y="${titleH}" fill="${fg}" font-size="17" font-weight="bold">7天预报</text>`);

  for (let t = Math.ceil(tMin); t <= tMax; t += 2) {
    const gy = toY(t);
    add(`<line x1="${P}" y1="${gy}" x2="${chartRight}" y2="${gy}" stroke="${secondary}" stroke-opacity="0.15" stroke-dasharray="4,4"/>`);
    add(`<text x="${chartLeft - 6}" y="${gy + 4}" fill="${secondary}" font-size="11" text-anchor="end">${t}°</text>`);
  }

  const n = fc.length;
  const barW = Math.max(14, Math.min(40, chartW / n - 12));
  const step = chartW / n;

  for (let i = 0; i < n; i++) {
    const cx = chartLeft + i * step + step / 2;
    const hi = toY(highs[i]);
    const lo = toY(lows[i]);

    add(`<text x="${cx}" y="${titleH + 18}" fill="${secondary}" font-size="13" text-anchor="middle">${esc(fc[i].fj)}</text>`);
    add(`<text x="${cx}" y="${titleH + 34}" fill="${secondary}" font-size="11" text-anchor="middle">${esc(fc[i].fi)}</text>`);

    add(`<rect x="${cx - barW / 2}" y="${hi}" width="${barW}" height="${Math.max(2, lo - hi)}" fill="${accent}" opacity="0.25" rx="4"/>`);

    add(`<circle cx="${cx}" cy="${hi}" r="4" fill="${accent}"/>`);
    add(`<text x="${cx}" y="${hi - 10}" fill="${accent}" font-size="13" text-anchor="middle" font-weight="bold">${highs[i]}°</text>`);

    add(`<circle cx="${cx}" cy="${lo}" r="4" fill="${secondary}"/>`);
    add(`<text x="${cx}" y="${lo + 20}" fill="${secondary}" font-size="13" text-anchor="middle">${lows[i]}°</text>`);

    add(`<text x="${cx}" y="${H - bottomPad}" fill="${fg}" font-size="${iconH}" text-anchor="middle">${weatherEmoji(fc[i].fa)}</text>`);
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${lines.join("")}</svg>`;
}

// ==================== 逐小时 ====================

function buildHourlyTimeline(hourly: Record<string, HourWeatherItem[]>, _fc: WeatherFC[], opts: Required<WeatherRenderOptions>): string {
  const key = "1d";
  const items = hourly[key];
  if (!items || items.length === 0) {
    const otherKey = Object.keys(hourly)[0];
    if (otherKey) return buildHourlyTimelineSimple(hourly[otherKey].flat(), opts);
    return buildHourlyTimelineSimple([], opts);
  }
  return buildHourlyTimelineSimple(items, opts);
}

function buildHourlyTimelineSimple(items: HourWeatherItem[], opts: Required<WeatherRenderOptions>): string {
  const { bg, fg, accent, secondary } = opts;
  const W = 700;
  const H = 320;
  const P = 28;
  const R = 16;

  if (items.length === 0) {
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="${bg}" rx="${R}"/><text x="${W/2}" y="${H/2}" fill="${secondary}" font-size="14" text-anchor="middle">暂无逐小时数据</text></svg>`;
  }

  const titleH = 34;
  const timeH = 32;
  const iconH = 24;
  const bottomPad = 12;
  const chartTop = titleH + P + 8;
  const chartBottom = H - timeH - iconH - bottomPad - 8;
  const chartH = chartBottom - chartTop;
  const chartLeft = P + 48;
  const chartRight = W - P;
  const chartW = chartRight - chartLeft;

  const temps = items.map(i => parseFloat(i.temp.replace("℃", "")));
  const tMin = Math.min(...temps) - 4;
  const tMax = Math.max(...temps) + 2;
  const tRange = tMax - tMin || 1;
  const toY = (t: number) => chartBottom - ((t - tMin) / tRange) * chartH;

  const maxShow = Math.min(items.length, 16);
  const step = Math.max(1, Math.floor(items.length / maxShow));
  const showItems: HourWeatherItem[] = [];
  const showIndices: number[] = [];
  for (let i = 0; i < items.length; i += step) {
    if (showItems.length >= maxShow) break;
    showItems.push(items[i]);
    showIndices.push(i);
  }
  if (showIndices[showIndices.length - 1] !== items.length - 1 && showItems.length > 1) {
    showItems[showItems.length - 1] = items[items.length - 1];
    showIndices[showIndices.length - 1] = items.length - 1;
  }

  const lines: string[] = [];
  const add = (s: string) => lines.push(s);

  add(`<rect width="${W}" height="${H}" fill="${bg}" rx="${R}"/>`);
  add(`<text x="${P}" y="${titleH}" fill="${fg}" font-size="17" font-weight="bold">逐小时预报</text>`);

  for (let t = Math.ceil(tMin); t <= tMax; t += 2) {
    const gy = toY(t);
    add(`<line x1="${P}" y1="${gy}" x2="${chartRight}" y2="${gy}" stroke="${secondary}" stroke-opacity="0.15" stroke-dasharray="4,4"/>`);
    add(`<text x="${chartLeft - 6}" y="${gy + 4}" fill="${secondary}" font-size="11" text-anchor="end">${t}°</text>`);
  }

  const padX = 24;
  const gap = showItems.length > 1 ? (chartW - padX * 2) / (showItems.length - 1) : chartW / 2;

  let areaD = "";
  for (let i = 0; i < showItems.length; i++) {
    const cx = chartLeft + padX + i * gap;
    const cy = toY(temps[showIndices[i]]);
    if (i === 0) areaD += `M${cx},${chartBottom} L${cx},${cy} `;
    else areaD += `L${cx},${cy} `;
  }
  areaD += `L${chartLeft + padX + (showItems.length - 1) * gap},${chartBottom} Z`;
  add(`<path d="${areaD}" fill="${accent}" opacity="0.12"/>`);

  let pathD = "";
  for (let i = 0; i < showItems.length; i++) {
    const cx = chartLeft + padX + i * gap;
    const cy = toY(temps[showIndices[i]]);
    pathD += `${i === 0 ? "M" : "L"}${cx},${cy} `;
  }
  add(`<path d="${pathD}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`);

  for (let i = 0; i < showItems.length; i++) {
    const item = showItems[i];
    const cx = chartLeft + padX + i * gap;
    const cy = toY(temps[showIndices[i]]);

    add(`<circle cx="${cx}" cy="${cy}" r="4.5" fill="${bg}" stroke="${accent}" stroke-width="2.5"/>`);
    add(`<text x="${cx}" y="${cy - 14}" fill="${fg}" font-size="13" text-anchor="middle" font-weight="bold">${esc(item.temp)}</text>`);

    add(`<text x="${cx}" y="${chartBottom + 20}" fill="${fg}" font-size="${iconH}" text-anchor="middle">${weatherEmoji(item.weatherCode)}</text>`);

    const [datePart, timePart] = formatHourTime(item.time);
    add(`<text x="${cx}" y="${chartBottom + iconH + 14}" fill="${secondary}" font-size="11" text-anchor="middle">${esc(datePart)}</text>`);
    add(`<text x="${cx}" y="${chartBottom + iconH + 28}" fill="${fg}" font-size="12" text-anchor="middle">${esc(timePart)}</text>`);
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${lines.join("")}</svg>`;
}

// ==================== 渲染函数 ====================

function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 288 }).png().toBuffer();
}

export async function renderWeatherCard(
  sk: WeatherSK,
  zs: WeatherZS,
  alarms: WeatherAlarm[],
  fc: WeatherFC[],
  options: WeatherRenderOptions = {}
): Promise<RenderResult> {
  const opts = {
    width: 580,
    bg: "#1a1a2e",
    fg: "#e0e0e0",
    accent: "#ff6b35",
    secondary: "#8888aa",
    ...options,
  };
  const svg = buildCard(sk, zs, alarms, fc, opts);
  const buffer = await svgToPng(svg);
  return { buffer, dataUrl: "data:image/png;base64," + buffer.toString("base64"), width: opts.width, height: 0 };
}

export async function renderForecastChart(
  fc: WeatherFC[],
  options: WeatherRenderOptions = {}
): Promise<RenderResult> {
  const opts = {
    width: 700,
    bg: "#1a1a2e",
    fg: "#e0e0e0",
    accent: "#ff6b35",
    secondary: "#8888aa",
    ...options,
  };
  const svg = buildForecastChart(fc, opts);
  const buffer = await svgToPng(svg);
  return { buffer, dataUrl: "data:image/png;base64," + buffer.toString("base64"), width: opts.width, height: 0 };
}

export async function renderHourlyTimeline(
  hourly: Record<string, HourWeatherItem[]>,
  fc: WeatherFC[],
  options: WeatherRenderOptions = {}
): Promise<RenderResult> {
  const opts = {
    width: 700,
    bg: "#1a1a2e",
    fg: "#e0e0e0",
    accent: "#ff6b35",
    secondary: "#8888aa",
    ...options,
  };
  const svg = buildHourlyTimeline(hourly, fc, opts);
  const buffer = await svgToPng(svg);
  return { buffer, dataUrl: "data:image/png;base64," + buffer.toString("base64"), width: opts.width, height: 0 };
}

export async function renderWeatherDashboard(
  cityCode: string,
  options: WeatherRenderOptions = {}
): Promise<RenderResult> {
  const opts = {
    bg: "#1a1a2e",
    fg: "#e0e0e0",
    accent: "#ff6b35",
    secondary: "#8888aa",
    ...options,
  };

  const [wx, hourly] = await Promise.all([
    getWeatherIndex(cityCode),
    getHourlyWeather(cityCode),
  ]);

  const cardSVG = buildCard(wx.dataSK, wx.dataZS, wx.alarmDZ.w, wx.fc.f, opts);
  const fcSVG = buildForecastChart(wx.fc.f, opts);
  const hourlySVG = buildHourlyTimeline(hourly, wx.fc.f, opts);

  const [cardBuf, fcBuf, hourlyBuf] = await Promise.all([
    svgToPng(cardSVG),
    svgToPng(fcSVG),
    svgToPng(hourlySVG),
  ]);

  const totalW = 700;
  const cardResized = await sharp(cardBuf).resize({ width: totalW }).png().toBuffer();
  const fcResized = await sharp(fcBuf).resize({ width: totalW }).png().toBuffer();
  const hourlyResized = await sharp(hourlyBuf).resize({ width: totalW }).png().toBuffer();

  const [cardMeta, fcMeta, hourlyMeta] = await Promise.all([
    sharp(cardResized).metadata(),
    sharp(fcResized).metadata(),
    sharp(hourlyResized).metadata(),
  ]);

  const cardH = cardMeta.height || 0;
  const fcH = fcMeta.height || 0;
  const hourlyH = hourlyMeta.height || 0;
  const gap = 24;

  const totalH = cardH + gap + hourlyH + gap + fcH;

  const buffer = await sharp({
    create: { width: totalW, height: totalH, channels: 4, background: { r: 26, g: 26, b: 46, alpha: 1 } }
  }).composite([
    { input: cardResized, left: 0, top: 0 },
    { input: hourlyResized, left: 0, top: cardH + gap },
    { input: fcResized, left: 0, top: cardH + gap + hourlyH + gap },
  ]).png().toBuffer();

  return { buffer, dataUrl: "data:image/png;base64," + buffer.toString("base64"), width: totalW, height: totalH };
}