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

// ==================== 我的天气 ====================

export interface WeatherSK {
  nameen: string; cityname: string; city: string;
  temp: string; tempf: string; WD: string; wde: string;
  WS: string; wse: string; SD: string; sd: string;
  qy: string; njd: string; time: string; rain: string;
  rain24h: string; aqi: string; aqi_pm25: string;
  weather: string; weathere: string | null; weathercode: string;
  limitnumber: string; date: string;
}

export interface WeatherCityDZ {
  weatherinfo: {
    city: string; cityname: string; temp: string; tempn: string;
    weather: string; wd: string; ws: string;
    weathercode: string; weathercoden: string; fctime: string;
  };
}

export interface WeatherAlarm {
  w1: string; w2: string; w3: string; w4: string; w5: string;
  w6: string; w7: string; w8: string; w9: string; w10: string;
  w11: string; w12: string; w13: string; w14: string; w15: string;
  w16: string;
}

export interface WeatherIndexItem {
  name: string; hint: string; des: string;
}

export interface WeatherZS {
  date: string;
  lk: WeatherIndexItem; cl: WeatherIndexItem; gj: WeatherIndexItem;
  pl: WeatherIndexItem; co: WeatherIndexItem; pj: WeatherIndexItem;
  hc: WeatherIndexItem; gl: WeatherIndexItem; uv: WeatherIndexItem;
  wc: WeatherIndexItem; ct: WeatherIndexItem; pk: WeatherIndexItem;
  ac: WeatherIndexItem; dy: WeatherIndexItem; ls: WeatherIndexItem;
  gm: WeatherIndexItem; xc: WeatherIndexItem; tr: WeatherIndexItem;
  nl: WeatherIndexItem; xq: WeatherIndexItem; yh: WeatherIndexItem;
  yd: WeatherIndexItem; ag: WeatherIndexItem; mf: WeatherIndexItem;
  ys: WeatherIndexItem; fs: WeatherIndexItem; pp: WeatherIndexItem;
  zs: WeatherIndexItem; jt: WeatherIndexItem; gz: WeatherIndexItem;
}

export interface WeatherFC {
  fa: string; fb: string; fc: string; fd: string;
  fe: string; ff: string; fg: string; fh: string;
  fk: string; fl: string; fm: string; fn: string;
  fi: string; fj: string;
}

export interface WeatherIndexResponse {
  cityDZ: WeatherCityDZ;
  alarmDZ: { w: WeatherAlarm[] };
  dataSK: WeatherSK;
  dataZS: WeatherZS;
  fc: { f: WeatherFC[] };
}

export interface WeatherFC40 {
  alins: string; als: string; blue: string; c1: string; c2: string;
  cla: string; date: string; des: string; fe: string; hgl: string;
  hmax: string; hmin: string; hol: string; insuit: string; jq: string;
  max: string; maxobs: string; min: string; minobs: string;
  nl: string; nlyf: string; r: string; rainobs: string; suit: string;
  t1: string; t1t: string; t2: string; t3: string; t3t: string;
  time: string; today: string; update: string; w1: string; wd1: string;
  winter: string; wk: string; wor: string; ws1: string; yl: string;
}

export interface HourWeatherItem {
  time: string; weatherCode: string; weather: string;
  temp: string; windDir: string; windScale: string; unknown: string;
}

export interface CitySearchItem {
  ref: string;
}

export interface WeatherRenderOptions {
  width?: number;
  height?: number;
  /** 背景色 (CSS color) */
  bg?: string;
  /** 文字色 */
  fg?: string;
  /** 强调色 */
  accent?: string;
  /** 次要文字色 */
  secondary?: string;
  /** 显示的元素: "card" | "forecast" | "hourly" | "all" */
  components?: ("card" | "forecast" | "hourly")[];
}