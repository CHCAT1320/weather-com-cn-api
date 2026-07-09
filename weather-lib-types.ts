// ============================================================
// weather-map-lib/src/types.ts
// ============================================================

export interface TyphoonItem { code: string; title: string; }

export interface TrackPoint {
  time: string; lng: number; lat: number;
  pressure: number; windSpeed: number;
  intensity: string; direction: string; moveSpeed: string;
}

export interface WindCircles {
  level7:  { ne: number; se: number; sw: number; nw: number; max: number };
  level10: { ne: number; se: number; sw: number; nw: number; max: number };
  level12: { ne: number; se: number; sw: number; nw: number; max: number };
}

export type TrackPointNew = [
  null, string, string, string, string, string,
  string, string, string, string,
  Array<[string, string, string, string, string, null?]>,
  Record<string, Array<[string, string, string, string, string, string, string, string]>>,
  [string, string, string, string]
];

export interface CloudTime { time: Array<{ m: string[]; picPath: string[] }>; }
export interface RadarTime { datas: Array<{ fn: string; dt: string }>; }
export interface WindTimeItem { t1: number; t2: number; url: string; }

export interface WindDataHeader {
  refTime: string; parameterCategory: number; parameterNumber: number;
  forecastTime: number; gridDefinitionTemplateName: string;
  numberPoints: number; winds: string; nx: number; ny: number;
}

export interface WindDataComponent { header: WindDataHeader; data: number[]; }

export interface RenderOptions {
  width?: number; height?: number; format?: "png" | "jpeg";
  zoom?: number; centerLng?: number; centerLat?: number;
  mapStyle?: number;
}

export interface RenderResult {
  buffer: Buffer; dataUrl: string; width: number; height: number;
  savedTo?: string;
}
