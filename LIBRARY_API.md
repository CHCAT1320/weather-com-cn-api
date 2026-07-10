# Weather Map Library API 文档

> Weather Map Library 是一个基于 TypeScript/Bun 的气象地图渲染库，封装了 weather.com.cn 数据接口，支持底图渲染、雷达/云图叠加、风场流线、台风路径等可视化功能。

---

## 安装

```bash
bun install
```

**依赖：**
- `sharp` — 图像处理（瓦片拼接、图层合成、SVG 渲染）
- Bun 运行时

---

## 快速开始

```typescript
import { renderChinaRadar, renderChinaTyphoon, saveToFile } from "./weather-lib";

// 渲染全国雷达图
const radar = await renderChinaRadar();
await saveToFile(radar, "output/radar.png");

// 渲染台风聚焦图
const typhoon = await renderChinaTyphoon();
await saveToFile(typhoon, "output/typhoon.png");
```

---

## 类型定义

### RenderOptions

渲染选项，所有渲染函数均接受此参数。

```typescript
interface RenderOptions {
  width?: number;       // 画布宽度，默认 1600（全局风图 1024）
  height?: number;      // 画布高度，默认 1200（全局风图 512）
  format?: "png" | "jpeg";  // 输出格式
  zoom?: number;        // 缩放级别，默认由边界自动计算
  centerLng?: number;   // 中心经度
  centerLat?: number;   // 中心纬度
  mapStyle?: number;    // 地图样式，8=标准
  tileUrl?: string;     // 自定义瓦片 URL，{z}/{x}/{y} 占位符，默认高德地图
  windSeed?: number;    // 风场流线种子间距，默认 18（px，800px基准）
  windStep?: number;    // 风场流线追踪步长，默认 2（px，800px基准）
  windArrow?: number;   // 风场箭头间距，默认 50（px，800px基准）
}
```

### RenderResult

渲染结果。

```typescript
interface RenderResult {
  buffer: Buffer;       // PNG 图像二进制数据
  dataUrl: string;      // Base64 Data URL
  width: number;        // 图像宽度
  height: number;       // 图像高度
  savedTo?: string;     // 保存路径（saveToFile 后）
}
```

### TrackPoint

台风路径点。

```typescript
interface TrackPoint {
  time: string;         // 观测时间
  lng: number;          // 经度
  lat: number;          // 纬度
  pressure: number;     // 中心气压 (hPa)
  windSpeed: number;    // 最大风速 (m/s)
  intensity: string;    // 强度等级 (TD/TS/STS/TY/STY/SuperTY)
  direction: string;    // 移动方向 (中文方位)
  moveSpeed: string;    // 移动速度 (km/h)
  windCircles: {        // 风圈半径 (km)
    lv7: number;        // 7级风圈
    lv10: number;       // 10级风圈
    lv12: number;       // 12级风圈
  } | null;
}
```

### WindDataComponent

风场数据分量。

```typescript
interface WindDataComponent {
  header: {
    parameterNumber: number;  // 2=U分量, 3=V分量
    nx: number;               // 经度网格数 (360)
    ny: number;               // 纬度网格数 (181)
    lo1: number;              // 起始经度 (0°)
    la1: number;              // 起始纬度 (90°N)
    dx: number;               // 经度步长 (1°)
    dy: number;               // 纬度步长 (1°)
  };
  data: number[];       // 风场数据 (m/s), 长度 nx*ny
}
```

---

## 数据层 API

### getTyphoonList()

获取所有台风列表。

```typescript
function getTyphoonList(): Promise<TyphoonItem[]>
```

**返回：** `TyphoonItem[]` — 台风列表，按编号降序排列（最新在前）。

```typescript
interface TyphoonItem {
  code: string;   // 台风编号，如 "2609"
  title: string;  // 台风名称，如 "巴威(第09号台风BAVI)"
}
```

---

### getTyphoonNew(code, year?)

获取指定台风的详细数据（新版 JSON 格式）。

```typescript
function getTyphoonNew(code: string, year?: string): Promise<{ update: string; typhoon: any[] }>
```

**参数：**
| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `code` | string | 台风编号，如 `"2609"` | 必填 |
| `year` | string | 年份 | `"2026"` |

---

### extractTrack(typhoonNew)

从台风详情中提取路径点数组。

```typescript
function extractTrack(typhoonNew: any): TrackPoint[]
```

**参数：** `typhoonNew` — `getTyphoonNew()` 的返回值。

**返回：** `TrackPoint[]` — 路径点数组，按时间升序排列。

---

### getRadarList()

获取全国雷达图像列表。

```typescript
function getRadarList(): Promise<RadarTime>
```

**返回：**

```typescript
interface RadarTime {
  datas: Array<{ fn: string; dt: string }>;
}
```

- `fn` — 图像文件名
- `dt` — 观测时间（`YYYYMMDDHHmmss`）

---

### fetchRadarImage(filename)

下载雷达图像。

```typescript
function fetchRadarImage(filename: string): Promise<Buffer>
```

---

### getCloudList()

获取卫星云图列表。

```typescript
function getCloudList(): Promise<CloudTime>
```

**返回：**

```typescript
interface CloudTime {
  time: Array<{
    m: string[];        // 时间列表
    picPath: string[];  // 文件名列表
  }>;
}
```

---

### fetchCloudImage(filename)

下载卫星云图。

```typescript
function fetchCloudImage(filename: string): Promise<Buffer>
```

---

### getWindList()

获取全球风场时间列表。

```typescript
function getWindList(): Promise<WindTimeItem[]>
```

**返回：**

```typescript
interface WindTimeItem {
  t1: number;   // 起报时间 (Unix ms)
  t2: number;   // 截止时间 (Unix ms)
  url: string;  // 数据文件名
}
```

---

### getWindData(filename)

获取全球风场数据。

```typescript
function getWindData(filename: string): Promise<WindDataComponent[]>
```

**返回：** `WindDataComponent[]` — 包含两个分量（U 和 V），每个分量包含 header 和 data 数组。

---

### getImageBounds()

获取雷达图像边界信息。

```typescript
function getImageBounds(): Promise<Record<string, {
  bound: [[number, number], [number, number]];
  name: string;
  prov: string;
}>>
```

---

### getChinaBounds()

获取中国区域边界。

```typescript
function getChinaBounds(): { west: number; south: number; east: number; north: number }
```

**返回：** `{ west: 73, south: 12.2, east: 135, north: 54.2 }`

---

## 我的天气 — 数据层 API

### getWeatherIndex(cityCode)

获取实时天气 + 生活指数 + 预警 + 7天预报（核心聚合接口）。

```typescript
function getWeatherIndex(cityCode: string): Promise<WeatherIndexResponse>
```

**参数：** `cityCode` — 9位城市代码，如 `"101010100"`（北京）。

**返回：**

```typescript
interface WeatherIndexResponse {
  dataSK: WeatherSK;           // 实时天气
  dataZS: WeatherZS;           // 30+ 生活指数
  alarmDZ: { w: WeatherAlarm[] };  // 天气预警
  cityDZ: WeatherCityDZ;       // 城市天气摘要
  fc: { f: WeatherFC[] };      // 7天预报
}
```

**WeatherSK 字段：**

| 字段 | 说明 | 示例 |
|------|------|------|
| `temp` | 当前温度（℃） | `"26.1"` |
| `weather` | 天气现象 | `"雨"` |
| `WD` / `wde` | 风向（中文/英文） | `"东北风"` / `"NE"` |
| `WS` | 风力等级 | `"2级"` |
| `SD` | 相对湿度 | `"88%"` |
| `qy` | 气压（hPa） | `"998"` |
| `aqi` | AQI | `"37"` |
| `rain` | 当前降水（mm） | `"0"` |
| `rain24h` | 24h降水（mm） | `"0"` |
| `time` | 观测时间 | `"12:55"` |
| `date` | 日期 | `"07月10日(星期五)"` |

**WeatherZS** — 30+ 生活指数，每个指数含 `name`、`hint`、`des` 三个字段：
`ct`（穿衣）、`uv`（紫外线）、`xc`（洗车）、`gm`（感冒）、`yd`（运动）、`ys`（雨伞）、`tr`（旅游）、`co`（舒适度）、`ag`（过敏）、`zs`（中暑）、`ls`（晾晒）、`cl`（晨练）、`jt`（交通）、`dy`（钓鱼）、`gj`（逛街）、`pk`（放风筝）、`hc`（划船）、`nl`（夜生活）、`yh`（约会）、`xq`（心情）、`pl`（污染扩散）、`pj`（啤酒）、`wc`（风寒）、`ac`（空调）、`gl`（太阳镜）、`fs`（防晒）、`mf`（美发）、`pp`（化妆）、`gz`（干燥）、`lk`（路况）

**WeatherFC** — 7天预报每天一条：

| 字段 | 说明 |
|------|------|
| `fa` / `fb` | 白天/夜间天气代码 |
| `fc` / `fd` | 最高/最低温度（℃） |
| `fe` / `ff` | 白天/夜间风向 |
| `fg` / `fh` | 白天/夜间风力 |
| `fm` | 相对湿度（%） |
| `fn` | 降水概率（%） |
| `fi` | 日期（M/D） |
| `fj` | 星期 |

---

### getHourlyWeather(cityCode)

获取逐3小时天气预报。

```typescript
function getHourlyWeather(cityCode: string): Promise<Record<string, HourWeatherItem[]>>
```

**返回：** 按天分组的逐小时数据，key 如 `"1d"`、`"23d"`、`"7d"`。

```typescript
interface HourWeatherItem {
  time: string;        // 如 "10日11时"
  weatherCode: string; // 天气代码
  weather: string;     // 天气现象
  temp: string;        // 温度
  windDir: string;     // 风向
  windScale: string;   // 风力
}
```

---

### getCalendar40(cityCode, year, month)

获取40天日历预报（单月）。

```typescript
function getCalendar40(cityCode: string, year: string, month: string): Promise<WeatherFC40[]>
```

**参数：** `year` 如 `"2026"`，`month` 如 `"07"`（补零）。

**返回：** 约 42 条数据（含前后月部分日期），`cla` 字段区分 `"history"`（历史均值）和 `"forecast"`（预报）。

---

### getIpLocation()

通过 IP 获取当前城市代码。

```typescript
function getIpLocation(): Promise<string>
```

**返回：** 9位城市代码，如 `"101010100"`。

---

### searchCity(name)

按名称搜索城市。

```typescript
function searchCity(name: string): Promise<CitySearchItem[]>
```

**参数：** `name` — 支持中文/拼音/英文，如 `"上海"`、`"shanghai"`。

**返回：** `ref` 字段格式 `"城市代码~拼音~中文名~..."`，取第一段为城市代码。

> 注意：不支持带行政后缀（如"上海市"、"华龙区"），只支持城市名本身。

---

## 我的天气 — 渲染层 API

### renderWeatherCard(sk, zs, alarms, fc, options?)

渲染天气卡片（当前天气 + 生活指数 + 预警 + 降水）。

```typescript
function renderWeatherCard(
  sk: WeatherSK,
  zs: WeatherZS,
  alarms: WeatherAlarm[],
  fc: WeatherFC[],
  options?: WeatherRenderOptions
): Promise<RenderResult>
```

**渲染内容：**
- 城市名 + 日期时间
- 当前温度（80px 大字）+ 天气图标
- 风向、湿度、降水、气压
- AQI 空气质量徽章
- 天气预警（如有）
- 6项生活指数（穿衣/紫外线/洗车/感冒/运动/雨伞，3列2行）

**默认画布：** 580×380px

---

### renderForecastChart(fc, options?)

渲染7天预报图表。

```typescript
function renderForecastChart(fc: WeatherFC[], options?: WeatherRenderOptions): Promise<RenderResult>
```

**渲染内容：** 温度柱状图（高低温）+ 天气图标 + 日期标签。

**默认画布：** 700×360px

---

### renderHourlyTimeline(hourly, fc, options?)

渲染逐小时预报时间线。

```typescript
function renderHourlyTimeline(
  hourly: Record<string, HourWeatherItem[]>,
  fc: WeatherFC[],
  options?: WeatherRenderOptions
): Promise<RenderResult>
```

**渲染内容：** 温度曲线 + 面积填充 + 数据点 + 天气图标 + 时间标签。

**默认画布：** 700×320px

---

### renderWeatherDashboard(cityCode, options?)

一键渲染天气仪表盘（卡片 + 逐小时 + 7天预报）。

```typescript
function renderWeatherDashboard(cityCode: string, options?: WeatherRenderOptions): Promise<RenderResult>
```

自动拉取数据，渲染三面板垂直拼接。**默认画布：** 700×~1000px。

### WeatherRenderOptions

```typescript
interface WeatherRenderOptions {
  width?: number;    // 画布宽度
  bg?: string;       // 背景色，默认 "#1a1a2e"
  fg?: string;       // 文字色，默认 "#e0e0e0"
  accent?: string;   // 强调色，默认 "#ff6b35"
  secondary?: string;// 次要文字色，默认 "#8888aa"
}
```

---

## 渲染层 API

### renderBaseMap(options?)

渲染纯底图（高德地图瓦片）。

```typescript
function renderBaseMap(options?: RenderOptions): Promise<RenderResult>
```

**默认参数：** `zoom=5, centerLng=104, centerLat=35, width=1600, height=1200, mapStyle=8`

**示例：**

```typescript
const map = await renderBaseMap({ zoom: 6, centerLng: 116, centerLat: 40 });
```

---

### renderRadarOverlay(baseResult, radarFilename, bounds, options)

将雷达图像叠加到底图上。

```typescript
function renderRadarOverlay(
  baseResult: RenderResult,     // 底图渲染结果
  radarFilename: string,        // 雷达图像文件名
  bounds: { west: number; south: number; east: number; north: number },  // 地理边界
  options: RenderOptions        // 渲染选项
): Promise<RenderResult>
```

---

### renderCloudOverlay(baseResult, cloudFilename, bounds, options)

将卫星云图叠加到底图上。

```typescript
function renderCloudOverlay(
  baseResult: RenderResult,
  cloudFilename: string,
  bounds: { west: number; south: number; east: number; north: number },
  options: RenderOptions
): Promise<RenderResult>
```

---

### renderChinaRadar(options?)

一键渲染全国雷达图（底图+雷达叠加）。

```typescript
function renderChinaRadar(options?: RenderOptions): Promise<RenderResult>
```

自动获取最新雷达图、计算最优缩放级别和中心点。

**示例：**

```typescript
const radar = await renderChinaRadar({ width: 1200, height: 900 });
```

---

### renderChinaCloud(options?)

一键渲染全国卫星云图。

```typescript
function renderChinaCloud(options?: RenderOptions): Promise<RenderResult>
```

---

### renderWindOverlay(baseResult, windData, options)

将风场流线叠加到底图上。

```typescript
function renderWindOverlay(
  baseResult: RenderResult,
  windData: WindDataComponent[],
  options: RenderOptions
): Promise<RenderResult>
```

流线使用双线性插值+数值积分追踪风场路径，颜色按最大风速着色。可通过 `windSeed`/`windStep` 控制精细度。

---

### renderChinaWind(options?)

一键渲染全国风场图（暗色底图+风场流线）。

```typescript
function renderChinaWind(options?: RenderOptions): Promise<RenderResult>
```

底图自动反色处理为暗色主题，风场流线颜色：
- 0–5 m/s：青色
- 5–10 m/s：亮绿
- 10–15 m/s：亮黄
- 15–20 m/s：亮橙
- 20–25 m/s：亮红
- 25+ m/s：品红

---

### renderGlobalWind(options?)

一键渲染全球风场图（暗色底图+风场流线）。

```typescript
function renderGlobalWind(options?: RenderOptions): Promise<RenderResult>
```

**默认参数：** `zoom=2, centerLng=0, centerLat=0, width=1024, height=512`

画布宽度 1024px 精确匹配 zoom=2 时的世界宽度（`256 × 2² = 1024`），无重复。风场数据经度自动回绕，跨越 0°/360° 边界无断裂。

**示例：**

```typescript
const g = await renderGlobalWind();
const gFine = await renderGlobalWind({ windSeed: 10, windStep: 1, width: 2048, height: 1024, zoom: 3 });
```

---

### renderTyphoonOverlay(baseResult, track, forecast, name, options)

将台风路径叠加到底图上。

```typescript
function renderTyphoonOverlay(
  baseResult: RenderResult,
  track: TrackPoint[],
  forecast: Array<{ lng: number; lat: number; time: string; intensity: string }>,
  name: string,
  options: RenderOptions
): Promise<RenderResult>
```

**渲染内容：**
- 历史路径（橙色折线+按台风等级着色的圆点）
- 预测路径（黄色虚线+空心圆+强度标签）
- 7/10/12级风圈（椭圆，无文字标注）
- 当前位置标记（等级颜色圆点+脉冲圈）
- 信息面板（左下角：名称、等级、风速、气压、坐标、移动方向/速度、时间）
- 台风等级图例（右上角：6级分类+颜色+风速范围）
- 图例（左上角：含风圈半径详情）

---

### renderChinaTyphoon(options?)

一键渲染最新台风聚焦图。

```typescript
function renderChinaTyphoon(options?: RenderOptions): Promise<RenderResult>
```

自动获取最新台风，以台风当前位置为中心（zoom=5），包含历史路径和预测路径。

---

### renderTyphoonOverview(options?)

一键渲染台风全览图（缩小地图以显示完整路径）。

```typescript
function renderTyphoonOverview(options?: RenderOptions): Promise<RenderResult>
```

自动计算路径边界（含预测路径），加上 25% 边距，计算最优缩放级别。

---

### saveToFile(result, filepath)

将渲染结果保存为 PNG 文件。

```typescript
function saveToFile(result: RenderResult, filepath: string): Promise<string>
```

**返回：** 文件路径。

---

### toDataUrl(result)

获取渲染结果的 Base64 Data URL。

```typescript
function toDataUrl(result: RenderResult): string
```

---

## 完整示例

### 地图渲染

```typescript
import {
  renderBaseMap, renderChinaRadar, renderChinaCloud,
  renderChinaWind, renderGlobalWind, renderChinaTyphoon, renderTyphoonOverview,
  saveToFile
} from "./weather-lib";

// 1. 底图
const base = await renderBaseMap({ zoom: 4 });
await saveToFile(base, "output/base.png");

// 2. 全国雷达
const radar = await renderChinaRadar();
await saveToFile(radar, "output/radar.png");

// 3. 全国云图
const cloud = await renderChinaCloud();
await saveToFile(cloud, "output/cloud.png");

// 4. 风场（默认精细度）
const wind = await renderChinaWind();
await saveToFile(wind, "output/wind.png");

// 5. 全球风场
const globalWind = await renderGlobalWind();
await saveToFile(globalWind, "output/global_wind.png");

// 6. 台风聚焦
const typhoon = await renderChinaTyphoon();
await saveToFile(typhoon, "output/typhoon.png");

// 7. 台风全览
const overview = await renderTyphoonOverview();
await saveToFile(overview, "output/typhoon_overview.png");
```

### 我的天气

```typescript
import {
  getWeatherIndex, getHourlyWeather, getCalendar40,
  getIpLocation, searchCity,
  renderWeatherCard, renderForecastChart, renderHourlyTimeline, renderWeatherDashboard,
  saveToFile
} from "./weather-lib";

// 获取城市代码
const code = await getIpLocation();                  // IP 自动定位
// const results = await searchCity("上海");         // 按名称搜索
// const code = results[0].ref.split("~")[0];

// 获取数据
const [wx, hourly] = await Promise.all([
  getWeatherIndex(code),
  getHourlyWeather(code),
]);

// 单独渲染各组件
await saveToFile(await renderWeatherCard(wx.dataSK, wx.dataZS, wx.alarmDZ.w, wx.fc.f), "output/card.png");
await saveToFile(await renderForecastChart(wx.fc.f), "output/forecast.png");
await saveToFile(await renderHourlyTimeline(hourly, wx.fc.f), "output/timeline.png");

// 一键仪表盘（自动拉数据+渲染三面板）
await saveToFile(await renderWeatherDashboard(code), "output/dashboard.png");

// 40天预报
const fc40 = await getCalendar40(code, "2026", "07");
console.log(fc40.filter(f => f.cla === "forecast"));
```

---

## 边界与投影

- **中国区域边界：** `{ west: 73, south: 12.2, east: 135, north: 54.2 }`
- **底图投影：** Web Mercator (EPSG:3857)
- **雷达/云图投影：** Web Mercator (EPSG:3857)，由 QGIS 预渲染
- **风场数据投影：** 等经纬度 (EPSG:4326)，渲染时自动转换
- **台风坐标：** WGS84 (EPSG:4326)

缩放级别自动计算公式：

```
geoW = east - west
mercH = ln(tan(north)) - ln(tan(south))
zW = log2(360 * canvasWidth / (geoW * 256))
zH = log2(2π * canvasHeight / (mercH * 256))
zoom = round(min(zW, zH))
centerMerc = (mercatorY(north) + mercatorY(south)) / 2
centerLat = inverseMercatorY(centerMerc)
```