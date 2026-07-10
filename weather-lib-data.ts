// ============================================================
// weather-lib-data.ts — 数据 API
// 封装所有 weather.com.cn 数据接口
// ============================================================
import type { TyphoonItem, CloudTime, RadarTime, WindTimeItem, WindDataComponent, WeatherSK, WeatherCityDZ, WeatherAlarm, WeatherZS, WeatherFC, WeatherIndexResponse, WeatherFC40, HourWeatherItem, CitySearchItem } from "./weather-lib-types";

const D1 = "https://d1.weather.com.cn";
const TY = "https://typhoon.weather.com.cn";
const TY_H = { "Referer": "https://typhoon.weather.com.cn/" };
const WX_H = { "Referer": "https://www.weather.com.cn/" };

function parseJsonp(text: string, isAssign = false): any {
  if (isAssign) {
    const eq = text.indexOf("=");
    if (eq >= 0) return JSON.parse(text.substring(eq + 1));
  }
  const ps = text.indexOf("(");
  const pe = text.lastIndexOf(")");
  if (ps >= 0 && pe > ps) return JSON.parse(text.substring(ps + 1, pe));
  throw new Error("Cannot parse JSONP: " + text.substring(0, 80));
}

function parseJsonpMulti(text: string): Record<string, any> {
  const result: Record<string, any> = {};
  const segments = text.split(/;(?=\s*var\s)/);
  for (const seg of segments) {
    const m = seg.match(/var\s+(\w+)\s*=\s*(.+)/s);
    if (m) {
      const json = m[2].trim().replace(/;$/, "");
      result[m[1]] = JSON.parse(json);
    }
  }
  return result;
}

// ==================== 台风 ====================

/** 获取所有台风列表，按编号降序排列（最新在前） */
export async function getTyphoonList(): Promise<TyphoonItem[]> {
  const resp = await fetch(TY + "/data/typhoonFlash/taifeng1.xml");
  const text = await resp.text();
  const re = /<tfProps\s+code="(\d+)"\s+title="([^"]+)"/g;
  const list: TyphoonItem[] = [];
  let m;
  while ((m = re.exec(text)) !== null) list.push({ code: m[1], title: m[2] });
  return list;
}

export async function getTyphoonNew(code: string, year = "2026"): Promise<{ update: string; typhoon: any[] }> {
  const resp = await fetch(D1 + "/typhoon/typhoon_data/" + year + "/" + code + ".json", { headers: TY_H });
  const text = await resp.text();
  return parseJsonp(text);
}

/**
 * 从台风详情中提取路径点数组
 * @param typhoonNew - getTyphoonNew() 的返回值
 * @returns 路径点数组，含时间、坐标、气压、风速、风圈等
 */
export function extractTrack(typhoonNew: any): Array<{
  time: string; lng: number; lat: number; pressure: number;
  windSpeed: number; intensity: string; direction: string; moveSpeed: string;
  windCircles: { lv7: number; lv10: number; lv12: number } | null;
}> {
  const track = typhoonNew.typhoon[8] as any[];
  if (!track) return [];
  return track.map((p: any) => {
    const circles = p[10];
    return {
      time: p[1],
      lng: parseFloat(p[4]),
      lat: parseFloat(p[5]),
      pressure: parseInt(p[6]),
      windSpeed: parseInt(p[7]),
      intensity: p[3],
      direction: p[8],
      moveSpeed: p[9],
      windCircles: circles ? {
        lv7:  parseInt(circles[0]?.[1]) || 0,
        lv10: parseInt(circles[1]?.[1]) || 0,
        lv12: parseInt(circles[2]?.[1]) || 0,
      } : null,
    };
  });
}

// ==================== 雷达 ====================

/** 获取全国雷达图像列表，按时间升序排列 */
export async function getRadarList(): Promise<RadarTime> {
  const resp = await fetch(D1 + "/radar_channel/radar/json/radar_list.json", { headers: TY_H });
  return parseJsonp(await resp.text());
}

/** 构建雷达图像完整 URL */
export function getRadarImageUrl(filename: string): string {
  return D1 + "/radar_channel/radar/pic/" + filename;
}

/** 下载雷达图像 PNG 文件 */
export async function fetchRadarImage(filename: string): Promise<Buffer> {
  const resp = await fetch(getRadarImageUrl(filename), { headers: TY_H });
  return Buffer.from(await resp.arrayBuffer());
}

/** 获取中国区域的地理边界（73°E~135°E, 12.2°N~54.2°N） */
export function getChinaBounds(): { west: number; south: number; east: number; north: number } {
  return { west: 73, south: 12.2, east: 135, north: 54.2 };
}

/** 获取卫星云图列表 */
export async function getCloudList(): Promise<CloudTime> {
  const resp = await fetch(D1 + "/typhoon/typhoon_cloude.json", { headers: TY_H });
  return parseJsonp(await resp.text(), true);
}

/** 构建云图完整 URL */
export function getCloudImageUrl(filename: string): string {
  return D1 + "/typhoon/cloud/" + filename;
}

/** 下载卫星云图 PNG 文件 */
export async function fetchCloudImage(filename: string): Promise<Buffer> {
  const resp = await fetch(getCloudImageUrl(filename), { headers: TY_H });
  return Buffer.from(await resp.arrayBuffer());
}

/** 获取全球风场时间列表（GFS 模型） */
export async function getWindList(): Promise<WindTimeItem[]> {
  const resp = await fetch(D1 + "/typhoon/wind/worldWindList.json", { headers: TY_H });
  return parseJsonp(await resp.text());
}

/**
 * 获取全球风场数据（U/V 分量）
 * @param filename - 风场数据文件名，来自 getWindList()
 * @returns 两个 WindDataComponent（U 和 V 分量），各含 360×181 网格数据
 */
export async function getWindData(filename: string): Promise<WindDataComponent[]> {
  const resp = await fetch(getWindDataUrl(filename), { headers: TY_H });
  return parseJsonp(await resp.text());
}

/** 构建风场数据完整 URL */
export function getWindDataUrl(filename: string): string {
  return D1 + "/typhoon/wind/" + filename;
}

// ==================== 我的天气 ====================

/**
 * 获取实时天气 + 生活指数 + 预警 + 7天预报（核心聚合接口）
 * @param cityCode - 城市代码，如 "101010100"（北京）
 * @returns 包含 dataSK、dataZS、alarmDZ、cityDZ、fc 的完整响应
 */
export async function getWeatherIndex(cityCode: string): Promise<WeatherIndexResponse> {
  const resp = await fetch(D1 + "/weather_index/" + cityCode + ".html", { headers: WX_H });
  const text = await resp.text();
  const parsed = parseJsonpMulti(text);
  const zs = parsed["dataZS"] as any;
  if (zs && zs.zs) {
    const raw = zs.zs;
    const names: Record<string, string> = {};
    for (const key of Object.keys(raw)) {
      if (key.endsWith("_name")) names[key.replace("_name", "")] = raw[key];
    }
    const mapped: WeatherZS = { date: raw.date } as any;
    for (const code of Object.keys(names)) {
      (mapped as any)[code] = {
        name: names[code],
        hint: raw[code + "_hint"] || "",
        des: raw[code + "_des_s"] || "",
      };
    }
    parsed["dataZS"] = mapped;
  }
  return parsed as WeatherIndexResponse;
}

/**
 * 获取40天日历预报（单月）
 * @param cityCode - 城市代码，如 "101010100"
 * @param year - 年份，如 "2026"
 * @param month - 月份（补零），如 "07"
 * @returns 40天预报数据数组（约42条，含前后月部分日期）
 */
export async function getCalendar40(cityCode: string, year: string, month: string): Promise<WeatherFC40[]> {
  const resp = await fetch(D1 + "/calendar_new/" + year + "/" + cityCode + "_" + year + month + ".html", { headers: WX_H });
  const text = await resp.text();
  const eq = text.indexOf("=");
  return JSON.parse(text.substring(eq + 1));
}

/**
 * 获取逐3小时天气预报
 * @param cityCode - 城市代码，如 "101010100"
 * @returns 按天分组的逐小时天气数据，key 格式如 "1d", "23d"
 */
export async function getHourlyWeather(cityCode: string): Promise<Record<string, HourWeatherItem[]>> {
  const resp = await fetch("http://www.weather.com.cn/weather/" + cityCode + ".shtml", { headers: WX_H });
  const text = await resp.text();
  const idx = text.indexOf("hour3data=");
  if (idx < 0) throw new Error("hour3data not found in page");
  let braceCount = 0;
  const start = idx + "hour3data=".length;
  let end = start;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{" || text[i] === "[") braceCount++;
    else if (text[i] === "}" || text[i] === "]") {
      braceCount--;
      if (braceCount === 0) { end = i + 1; break; }
    }
  }
  const raw = JSON.parse(text.substring(start, end));
  const result: Record<string, HourWeatherItem[]> = {};
  for (const key of Object.keys(raw)) {
    const items = Array.isArray(raw[key]) ? raw[key] : [raw[key]];
    result[key] = items.flat().map((s: string) => {
      const parts = s.split(",");
      return {
        time: parts[0],
        weatherCode: parts[1],
        weather: parts[2],
        temp: parts[3],
        windDir: parts[4],
        windScale: parts[5],
        unknown: parts[6] || "",
      };
    });
  }
  return result;
}

/**
 * 获取定制化天气信息（精简版）
 * @param cityCode - 城市代码，如 "101010100"
 * @returns 包含 cityDZ 和 alarmDZ 数据
 */
export async function getDingzhi(cityCode: string): Promise<{ cityDZ: WeatherCityDZ; alarmDZ: { w: WeatherAlarm[] } }> {
  const resp = await fetch(D1 + "/dingzhi/" + cityCode + ".html", { headers: WX_H });
  const text = await resp.text();
  const parsed = parseJsonpMulti(text);
  const cityKey = "cityDZ" + cityCode;
  const alarmKey = "alarmDZ" + cityCode;
  return {
    cityDZ: parsed[cityKey] || parsed["cityDZ"],
    alarmDZ: parsed[alarmKey] || parsed["alarmDZ"],
  };
}

/**
 * 城市搜索
 * @param name - 城市名称（中文或拼音）
 * @returns 匹配的城市列表，ref 格式为 "cityCode~省份~城市名~..."
 */
export async function searchCity(name: string): Promise<CitySearchItem[]> {
  const resp = await fetch("https://toy1.weather.com.cn/search?cityname=" + encodeURIComponent(name), { headers: WX_H });
  const text = await resp.text();
  return parseJsonp(text);
}

/**
 * 通过 IP 获取当前城市代码
 * @returns 城市代码，如 "101010100"
 */
export async function getIpLocation(): Promise<string> {
  const resp = await fetch("https://wgeo.weather.com.cn/ip/", { headers: WX_H });
  const text = await resp.text();
  const re = /var\s+id\s*=\s*"(\d+)"/;
  const m = re.exec(text);
  if (m) return m[1];
  throw new Error("id not found in IP location response");
}
