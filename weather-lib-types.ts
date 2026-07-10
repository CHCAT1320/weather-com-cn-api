// ============================================================
// weather-map-lib/src/types.ts
// ============================================================

export interface TyphoonItem { code: string; title: string; }

export interface TrackPoint {
  time: string; lng: number; lat: number;
  pressure: number; windSpeed: number;
  intensity: string; direction: string; moveSpeed: string;
  windCircles: { lv7: number; lv10: number; lv12: number } | null;
}

export interface CloudTime { time: Array<{ m: string[]; picPath: string[] }>; }
export interface RadarTime { datas: Array<{ fn: string; dt: string }>; }
export interface WindTimeItem { t1: number; t2: number; url: string; }

export interface WindDataHeader {
  refTime: string; parameterCategory: number; parameterNumber: number;
  forecastTime: number; gridDefinitionTemplateName: string;
  numberPoints: number; winds: string; nx: number; ny: number;
  lo1: number; la1: number; dx: number; dy: number;
}

export interface WindDataComponent { header: WindDataHeader; data: number[]; }

export interface RenderOptions {
  width?: number; height?: number; format?: "png" | "jpeg";
  zoom?: number; centerLng?: number; centerLat?: number;
  mapStyle?: number;
  tileUrl?: string;
  windSeed?: number;
  windStep?: number;
  windArrow?: number;
}

export interface RenderResult {
  buffer: Buffer; dataUrl: string; width: number; height: number;
  savedTo?: string;
}