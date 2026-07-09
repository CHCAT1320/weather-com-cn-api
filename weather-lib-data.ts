// ============================================================
// weather-lib-data.ts — 数据 API
// 封装所有 weather.com.cn 数据接口
// ============================================================
import type { TyphoonItem, CloudTime, RadarTime, WindTimeItem, WindDataComponent, TrackPointNew } from "./weather-lib-types";

const D1 = "https://d1.weather.com.cn";
const TY = "https://typhoon.weather.com.cn";
const TY_H = { "Referer": "https://typhoon.weather.com.cn/" };
const WX_H = { "Referer": "https://www.weather.com.cn/", "User-Agent": "Mozilla/5.0" };

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

export async function getTyphoonDetailXML(code: string): Promise<string> {
  const resp = await fetch(TY + "/data/typhoonFlash/" + code + ".xml");
  return resp.text();
}

/** 获取指定台风的新版 JSON 详情（含路径点、风圈、预报数据） */
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

/** 获取所有雷达站点的图像边界信息 */
export async function getImageBounds(): Promise<Record<string, { bound: [[number, number], [number, number]]; name: string; prov: string }>> {
  const resp = await fetch(D1 + "/radar_channel/radar/json/bounds.json", { headers: TY_H });
  return parseJsonp(await resp.text());
}

/** 获取中国区域的地理边界（73°E~135°E, 12.2°N~54.2°N） */
export function getChinaBounds(): { west: number; south: number; east: number; north: number } {
  return { west: 73, south: 12.2, east: 135, north: 54.2 };
}

/** 获取卫星云图列表 */
export async function getCloudList(): Promise<CloudTime> {
  const resp = await fetch(D1 + "/radar_channel/cloud/json/cloud_list.json", { headers: TY_H });
  return parseJsonp(await resp.text());
}

/** 构建云图完整 URL */
export function getCloudImageUrl(filename: string): string {
  return D1 + "/radar_channel/cloud/pic/" + filename;
}

/** 下载卫星云图 PNG 文件 */
export async function fetchCloudImage(filename: string): Promise<Buffer> {
  const resp = await fetch(getCloudImageUrl(filename), { headers: TY_H });
  return Buffer.from(await resp.arrayBuffer());
}

/** 获取全球风场时间列表（GFS 模型） */
export async function getWindList(): Promise<WindTimeItem[]> {
  const resp = await fetch(D1 + "/radar_channel/wind/json/wind_list.json", { headers: TY_H });
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
  return D1 + "/radar_channel/wind/data/" + filename;
}

/** 获取降水圈数据 */
export async function getRainCircle(): Promise<{ rainCircle: any[] }> {
  const resp = await fetch(D1 + "/radar_channel/rain/json/rain_circle.json", { headers: TY_H });
  return parseJsonp(await resp.text());
}

/** 获取旧版全国雷达拼图列表 */
export async function getRadarMosaicList(): Promise<any> {
  const resp = await fetch(D1 + "/radar_channel/radar/json/mosaic_list.json", { headers: TY_H });
  return parseJsonp(await resp.text());
}

/** 构建旧版雷达拼图完整 URL */
export function getRadarMosaicUrl(path: string): string {
  return D1 + "/radar_channel/radar/pic/" + path;
}

/** 下载旧版全国雷达拼图 PNG 文件 */
export async function fetchRadarMosaic(path: string): Promise<Buffer> {
  const resp = await fetch(getRadarMosaicUrl(path), { headers: WX_H });
  return Buffer.from(await resp.arrayBuffer());
}
