# 数据源 API 文档

> 本文档详细描述 Weather Map Library 所使用的全部外部数据源 API。

---

## 通用说明

### JSONP 解析

多数接口返回 JSONP 格式，需去除外层包裹后解析 JSON。包裹方式有两种：

**方式一：函数调用 `callback({...})`**

```typescript
// 原始响应: callback({"datas":[...]})
const ps = text.indexOf("(");
const pe = text.lastIndexOf(")");
const json = JSON.parse(text.substring(ps + 1, pe));
```

**方式二：赋值 `var xxx = {...}`**

```typescript
// 原始响应: var cloudData = {"time":[...]}
const eq = text.indexOf("=");
const json = JSON.parse(text.substring(eq + 1));
```

### 请求头速查

| 域名 | 必需请求头 |
|------|-----------|
| `d1.weather.com.cn` | `Referer: https://typhoon.weather.com.cn/` |
| `img.weather.com.cn` | `Referer: https://typhoon.weather.com.cn/` |
| `typhoon.weather.com.cn` (XML) | 无需特殊请求头 |
| `mpfv4.weather.com.cn` | `Referer: https://www.weather.com.cn/` + `User-Agent: Mozilla/5.0` |
| `is.autonavi.com` | `User-Agent: WeatherMapLib/1.0` |

---

## 1. 台风数据

### 1.1 台风列表

```
GET https://typhoon.weather.com.cn/data/typhoonFlash/taifeng1.xml
```

**请求头：** 无需特殊请求头

**返回格式：** XML

**原始响应示例：**

```xml
<?xml version="1.0" encoding="utf-8"?>
<typhoonflash>
  <tfProps code="2609" title="巴威(第09号台风BAVI)"/>
  <tfProps code="2610" title="美莎克(第10号台风MAYSAK)"/>
  <tfProps code="2608" title="海高斯(第08号台风HIGOS)"/>
  ...
</typhoonflash>
```

**解析方式：**

```typescript
const re = /<tfProps\s+code="(\d+)"\s+title="([^"]+)"/g;
let m;
while ((m = re.exec(text)) !== null) {
  list.push({ code: m[1], title: m[2] });
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | string | 台风编号，4位数字：`YYNN`（YY=年份后两位，NN=当年序号） |
| `title` | string | 台风名称，格式：`中文名(第XX号台风英文名)` |

> 列表按 `code` 降序排列，最新台风排在首位。

---

### 1.2 台风详情（新版 JSON）

```
GET https://d1.weather.com.cn/typhoon/typhoon_data/{year}/{code}.json
```

**请求头：** `Referer: https://typhoon.weather.com.cn/`

**URL 参数：**

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `{year}` | string | 年份，4位数字 | `2026` |
| `{code}` | string | 台风编号，4位数字 | `2609` |

**示例：** `https://d1.weather.com.cn/typhoon/typhoon_data/2026/2609.json`

**返回格式：** JSONP（函数调用 `callback({...})`）

**原始响应：**

```
callback({"update":"2026-07-09 14:00:00","typhoon":[...]})
```

**解析后顶层结构：**

```json
{
  "update": "2026-07-09 14:00:00",
  "typhoon": [
    8,                              // [0]  未知
    "2609",                         // [1]  台风编号
    "巴威",                          // [2]  中文名称
    "BAVI",                         // [3]  英文名称
    "2026",                         // [4]  年份
    "09",                           // [5]  序号
    "2026-07-01 08:00:00",          // [6]  生成时间
    "active",                       // [7]  状态（active=活跃, stop=停编）
    [...],                          // [8]  ★ 历史路径点数组
    [...],                          // [9]  预留
    null,                           // [10] 预留
    null,                           // [11] 预留
    null                            // [12] 预留
  ]
}
```

#### 路径点 `typhoon[8]` 每个元素结构

```json
[
  null,                             // [0]  未知
  "2026-07-09 14时",                // [1]  观测时间（中文格式）
  "1783576800",                     // [2]  Unix 时间戳（秒）
  "SuperTY",                        // [3]  台风强度等级
  "128.9",                          // [4]  经度 °E（字符串）
  "18.7",                           // [5]  纬度 °N（字符串）
  "935",                            // [6]  中心气压 hPa（字符串）
  "52",                             // [7]  最大风速 m/s（字符串）
  "北西北",                          // [8]  移动方向（中文方位）
  "16",                             // [9]  移动速度 km/h（字符串）
  [                                 // [10] ★ 风圈半径数组
    ["30KTS", "500", "500", "500", "500", null],
    //       ↑NE    ↑SE    ↑SW    ↑NW
    ["50KTS", "300", "280", "280", "300", null],
    ["64KTS", "180", "120", "120", "180", null]
  ],
  {                                 // [11] ★ 各机构预测数据
    "BABJ": [                       // 中国气象局（北京）
      [
        "12",                       // 预报时效（小时）
        "2026-07-10 02时",          // 预报时间
        "128",                      // 经度 °E
        "20.2",                     // 纬度 °N
        "970",                      // 中心气压 hPa
        "35",                       // 最大风速 m/s
        "北",                        // 移动方向
        "15"                        // 移动速度 km/h
      ]
    ]
  },
  [null, null, null, null]          // [12] 预留
]
```

**风圈字段说明：**

| 索引 | 含义 | 说明 |
|------|------|------|
| `[0]` | 风圈等级标识 | `30KTS`=7级, `50KTS`=10级, `64KTS`=12级 |
| `[1]` | NE 象限半径 | 东北方向，单位 km |
| `[2]` | SE 象限半径 | 东南方向，单位 km |
| `[3]` | SW 象限半径 | 西南方向，单位 km |
| `[4]` | NW 象限半径 | 西北方向，单位 km |
| `[5]` | 预留 | 通常为 null |

**强度等级：**

| 等级 | 标识 | 风速范围 | 风力 |
|------|------|----------|------|
| 热带低压 | TD | ≤17.1 m/s | ≤7级 |
| 热带风暴 | TS | 17.2–24.4 m/s | 8–9级 |
| 强热带风暴 | STS | 24.5–32.6 m/s | 10–11级 |
| 台风 | TY | 32.7–41.4 m/s | 12–13级 |
| 强台风 | STY | 41.5–50.9 m/s | 14–15级 |
| 超强台风 | SuperTY | ≥51.0 m/s | 16级以上 |

---

### 1.3 台风详情（旧版 XML）

```
GET https://typhoon.weather.com.cn/data/typhoonFlash/{code}.xml
```

**请求头：** 无需特殊请求头

**返回格式：** XML

---

## 2. 雷达数据

### 2.1 全国雷达图像列表

```
GET https://d1.weather.com.cn/radar_channel/radar/json/radar_list.json
```

**请求头：** `Referer: https://typhoon.weather.com.cn/`

**返回格式：** JSONP（函数调用）

**原始响应：**

```
callback({"datas":[{"fn":"ACHN_QREF_20260709_100000.png","dt":"20260709100000"},...]})
```

**解析后结构：**

```json
{
  "datas": [
    { "fn": "ACHN_QREF_20260709_100000.png", "dt": "20260709100000" },
    { "fn": "ACHN_QREF_20260709_100600.png", "dt": "20260709100600" }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `datas` | Array | 雷达图像列表，按时间升序 |
| `datas[].fn` | String | 文件名：`ACHN`=全国, `QREF`=反射率, 时间戳 UTC |
| `datas[].dt` | String | 观测时间，格式 `YYYYMMDDHHmmss`（UTC） |

### 2.2 雷达图像下载

```
GET https://d1.weather.com.cn/radar_channel/radar/pic/{filename}
```

**请求头：** `Referer: https://typhoon.weather.com.cn/`

**返回格式：** PNG 图像（2882×2161 像素，RGBA），由 QGIS 3.22 预渲染，Web Mercator (EPSG:3857) 投影

---

## 3. 卫星云图数据

### 3.1 云图列表

```
GET https://d1.weather.com.cn/typhoon/typhoon_cloude.json
```

**请求头：** `Referer: https://typhoon.weather.com.cn/`

**返回格式：** JSONP（赋值格式 `var cloudData = {...}`）

**原始响应：**

```
var cloudData = {"time":[{"m":["2026-07-09 09:30:00",...],"picPath":["PWCP_TWC_FY4A_S99_MTCC_ACHN3857_LNO_P9_20260709093000000.PNG",...]}]}
```

**解析后结构：**

```json
{
  "time": [
    {
      "m": [
        "2026-07-09 09:30:00",
        "2026-07-09 09:45:00",
        "2026-07-09 10:00:00"
      ],
      "picPath": [
        "PWCP_TWC_FY4A_S99_MTCC_ACHN3857_LNO_P9_20260709093000000.PNG",
        "PWCP_TWC_FY4A_S99_MTCC_ACHN3857_LNO_P9_20260709094500000.PNG",
        "PWCP_TWC_FY4A_S99_MTCC_ACHN3857_LNO_P9_20260709100000000.PNG"
      ]
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `time` | Array | 按时间段分组的云图列表 |
| `time[].m` | Array | 各时间点的时间字符串（UTC+8），与 `picPath` 一一对应 |
| `time[].picPath` | Array | 对应的图像文件名 |

**文件名解析 `PWCP_TWC_FY4A_S99_MTCC_ACHN3857_LNO_P9_YYYYMMDDHHmmssSSS.PNG`：**

| 段 | 含义 |
|------|------|
| `PWCP` | 产品类别 |
| `TWC` | 来源 |
| `FY4A` | 风云四号 A 星 |
| `S99` | 传感器 |
| `MTCC` | 处理级别 |
| `ACHN3857` | 全国范围 / EPSG:3857 (Web Mercator) 投影 |
| `LNO_P9` | 图层/产品编号 |
| 时间戳 | `YYYYMMDDHHmmssSSS`（UTC+8） |

### 3.2 云图下载

```
GET https://d1.weather.com.cn/typhoon/cloud/{filename}
```

**请求头：** `Referer: https://typhoon.weather.com.cn/`

**返回格式：** PNG 图像（binary）

---

## 4. 风场数据

### 4.1 风场时间列表

```
GET https://d1.weather.com.cn/typhoon/wind/worldWindList.json
```

**请求头：** `Referer: https://typhoon.weather.com.cn/`

**返回格式：** JSONP（函数调用）

**原始响应：**

```
callback([{"t1":1783576800000,"t2":1783580400000,"url":"gfvu-world-202607091400.json"}])
```

**解析后结构：**

```json
[
  {
    "t1": 1783576800000,
    "t2": 1783580400000,
    "url": "gfvu-world-202607091400.json"
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `t1` | Number | 起报时间（Unix 毫秒时间戳） |
| `t2` | Number | 预报时效截止时间（Unix 毫秒时间戳） |
| `url` | String | 风场数据文件名 |

### 4.2 风场数据

```
GET https://d1.weather.com.cn/typhoon/wind/{filename}
```

**请求头：** `Referer: https://typhoon.weather.com.cn/`

**返回格式：** JSONP（函数调用）

**原始响应：**

```
callback([{"header":{...},"data":[...]},{"header":{...},"data":[...]}])
```

**解析后结构：** 数组包含两个元素——U 分量和 V 分量。

```json
[
  {
    "header": {
      "refTime": "201808010800",
      "parameterCategory": 2,
      "parameterNumber": 2,
      "forecastTime": 1,
      "gridDefinitionTemplateName": "Latitude_Longitude",
      "numberPoints": 65160,
      "winds": "true",
      "nx": 360,
      "ny": 181,
      "lo1": 0,
      "la1": 90,
      "lo2": 359,
      "la2": -90,
      "dx": 1,
      "dy": 1
    },
    "data": [ -2, -2, -2, ... ]
  },
  {
    "header": { ... "parameterNumber": 3, ... },
    "data": [ 1, 1, 1, ... ]
  }
]
```

**Header 字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `refTime` | String | 参考时间 |
| `parameterCategory` | Number | GRIB2 参数类别，2=动量 |
| `parameterNumber` | Number | **2=U分量**（东西方向），**3=V分量**（南北方向） |
| `forecastTime` | Number | 预报时效（小时） |
| `gridDefinitionTemplateName` | String | 网格类型，`Latitude_Longitude`=等经纬度 |
| `numberPoints` | Number | 总数据点数 = nx × ny = 65160 |
| `winds` | String | 固定值 `"true"`，标识风场数据 |
| `nx` | Number | 经度方向网格数 = 360 |
| `ny` | Number | 纬度方向网格数 = 181 |
| `lo1` | Number | 起始经度 = 0° |
| `la1` | Number | 起始纬度 = 90°N（北极） |
| `lo2` | Number | 结束经度 = 359° |
| `la2` | Number | 结束纬度 = -90°（南极） |
| `dx` | Number | 经度步长 = 1° |
| `dy` | Number | 纬度步长 = 1° |

**Data 数组：**

- 一维数组，长度 = nx × ny = 65160
- **索引计算：** `index = j * nx + i`
  - `i` = 经度索引（0–359），`lon = lo1 + i * dx`
  - `j` = 纬度索引（0–180），`lat = la1 - j * dy`
- 数据单位：m/s
- 取值范围：约 -30 到 +30 m/s
- **U 分量**（parameterNumber=2）：正值=西风→东，负值=东风→西
- **V 分量**（parameterNumber=3）：正值=北风→南（已转为屏幕坐标系，Y轴向下），负值=南风→北
- 风速 = `√(U² + V²)`
- 气象风向 = `atan2(-U, V)`（风**来自**的方向，V已翻转）

---

## 5. 降水数据

### 5.1 降水圈

```
GET https://d1.weather.com.cn/typhoon/typhoon_data/rainCircle.json
```

**请求头：** `Referer: https://typhoon.weather.com.cn/`

**返回格式：** JSONP（函数调用）

```json
{
  "rainCircle": []
}
```

---

## 6. 雷达图像边界

```
GET https://img.weather.com.cn/radarinfo/img_bounds.json
```

**请求头：** `Referer: https://typhoon.weather.com.cn/`

**返回格式：** JSONP（函数调用 `imgbounds({...})`）

**原始响应：**

```
imgbounds({"achn":{"bound":[[73,54.2],[135,12.2]],"name":"全国","prov":""},...})
```

**解析后结构：**

```json
{
  "achn": {
    "bound": [[73, 54.2], [135, 12.2]],
    "name": "全国",
    "prov": ""
  },
  "az9010": {
    "bound": [[113.75, 41.9], [119.19, 37.7]],
    "name": "北京",
    "prov": "",
    "range": 230
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `{key}` | Object | 站点/区域代码：`achn`=全国拼图，`azXXXX`=单站雷达 |
| `bound` | Array | `[[west, north], [east, south]]`，经纬度边界 |
| `name` | String | 中文名称 |
| `prov` | String | 所属省份 |
| `range` | Number | 雷达探测半径（km），仅单站雷达有此字段 |

---

## 7. 全国雷达拼图（旧版）

### 7.1 拼图列表

```
GET https://mpfv4.weather.com.cn/mpf_resource/mpf_v4/mpfv4_list.json
```

**请求头：**
```
Referer: https://www.weather.com.cn/
User-Agent: Mozilla/5.0
```

**返回格式：** JSONP（赋值格式 `var mpfv4List = {...}`）

### 7.2 拼图下载

```
GET https://mpfv4.weather.com.cn/mpf_resource/mpf_v4/{path}
```

**请求头：** 同上

**返回格式：** PNG 图像

---

## 8. 高德地图瓦片

```
GET https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style={style}&x={x}&y={y}&z={z}
```

**请求头：** `User-Agent: WeatherMapLib/1.0`

**URL 参数：**

| 参数 | 说明 | 取值 |
|------|------|------|
| `{s}` | 子域名（负载均衡） | `1`, `2`, `3`, `4` |
| `{style}` | 地图样式 | `8`=标准（默认） |
| `{x}` | 瓦片列号 | 0 到 2^z - 1 |
| `{y}` | 瓦片行号 | 0 到 2^z - 1（Google 约定，原点在左上角） |
| `{z}` | 缩放级别 | 0–18 |

**返回格式：** PNG 图像（256×256 像素）

**投影：** Web Mercator (EPSG:3857)

**经纬度 → 像素坐标转换：**

```
n = 2^z × 256
px = (lng + 180) / 360 × n
py = (1 − ln(tan(φ) + 1/cos(φ)) / π) / 2 × n
```

**缩放级别参考：**

| 级别 | 世界范围像素 | 每像素 ≈ |
|------|-------------|----------|
| z=2 | 1024×512 | 78 km |
| z=3 | 2048×1024 | 39 km |
| z=4 | 4096×2048 | 19 km |
| z=5 | 8192×4096 | 10 km |
| z=6 | 16384×8192 | 5 km |

**自定义瓦片源：**

通过 `tileUrl` 参数可替换默认的高德地图瓦片，格式使用 `{z}`、`{x}`、`{y}` 占位符：

```typescript
// OpenStreetMap
renderBaseMap({ tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" })

// CartoDB 暗色主题
renderBaseMap({ tileUrl: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" })
```

---

## 9. 我的天气（My Weather）栏目 API

> 以下 API 为中国天气网首页"我的天气"栏目所使用，涵盖实时天气、生活指数、预警、逐小时预报、7天/15天/40天预报等。

### 通用说明

- 所有 `d1.weather.com.cn` 域名的接口均需 `Referer: https://www.weather.com.cn/` 请求头
- 返回格式为 JSONP（JavaScript 赋值 `var xxx = {...}`），需去除前缀后解析 JSON
- 城市代码（cityCode）为 9 位数字，如 `101010100`（北京）
- 国际城市代码可能有不同格式

### 9.1 实时天气 + 生活指数 + 预警 + 7天预报（核心聚合接口）

```
GET https://d1.weather.com.cn/weather_index/{cityCode}.html
```

**请求头：** `Referer: https://www.weather.com.cn/`

**示例：** `https://d1.weather.com.cn/weather_index/101010100.html`

**返回格式：** JSONP（JavaScript 赋值，包含多个变量）

**原始响应：**
```
var cityDZ = {...};
var alarmDZ = {...};
var dataSK = {...};
var dataZS = {...};
var fc = {...};
```

#### 9.1.1 `dataSK` — 实时天气

```json
{
  "nameen": "beijing",
  "cityname": "北京",
  "city": "101010100",
  "temp": "26.1",
  "tempf": "79",
  "WD": "东北风",
  "wde": "NE",
  "WS": "2级",
  "wse": "8km/h",
  "SD": "88%",
  "sd": "88%",
  "qy": "998",
  "njd": "4km",
  "time": "12:55",
  "rain": "0",
  "rain24h": "0",
  "aqi": "37",
  "aqi_pm25": "37",
  "weather": "雨",
  "weathere": null,
  "weathercode": "d301",
  "limitnumber": "5和0",
  "date": "07月10日(星期五)"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `nameen` | String | 城市英文名（拼音） |
| `cityname` | String | 城市中文名 |
| `city` | String | 城市代码 |
| `temp` | String | 当前温度（℃） |
| `tempf` | String | 当前温度（℉） |
| `WD` | String | 风向（中文） |
| `wde` | String | 风向（英文缩写，如 NE） |
| `WS` | String | 风力等级 |
| `wse` | String | 风速（km/h） |
| `SD` / `sd` | String | 相对湿度（%） |
| `qy` | String | 气压（hPa） |
| `njd` | String | 能见度（km） |
| `time` | String | 观测时间（HH:mm） |
| `rain` | String | 当前降水量（mm） |
| `rain24h` | String | 24小时降水量（mm） |
| `aqi` | String | AQI 空气质量指数 |
| `aqi_pm25` | String | PM2.5 |
| `weather` | String | 天气现象（中文） |
| `weathercode` | String | 天气代码（d=白天, n=夜间, 如 d301） |
| `limitnumber` | String | 限行尾号 |
| `date` | String | 日期 |

#### 9.1.2 `cityDZ` — 城市天气摘要

```json
{
  "weatherinfo": {
    "city": "北京",
    "cityname": "beijing",
    "temp": "28",
    "tempn": "24",
    "weather": "大雨转暴雨",
    "wd": "东风转东南风",
    "ws": "<3级",
    "weathercode": "d9",
    "weathercoden": "n10",
    "fctime": "202607100800"
  }
}
```

| 字段 | 说明 |
|------|------|
| `temp` | 白天最高温度 |
| `tempn` | 夜间最低温度 |
| `weather` | 天气现象 |
| `weathercode` | 白天天气代码 |
| `weathercoden` | 夜间天气代码 |
| `fctime` | 预报发布时间 |

#### 9.1.3 `alarmDZ` — 天气预警

```json
{
  "w": [
    {
      "w1": "北京市",
      "w4": "02",
      "w5": "暴雨",
      "w6": "03",
      "w7": "橙色",
      "w8": "2026-07-09 13:35",
      "w9": "市气象台2026年07月09日13时30分发布暴雨橙色预警信号...",
      "w10": "202607091335545112暴雨橙色",
      "w11": "10101-20260709133539-0203.html",
      "w12": "2026-07-09 13:40",
      "w13": "北京市发布暴雨橙色预警信号",
      "w14": "Alert",
      "w15": "2026-07-11 01:35:39",
      "w16": "11000041600000_20260709133539"
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `w1` | 区域名称 |
| `w4` | 预警类型代码（02=暴雨, 09=雷电, 等） |
| `w5` | 预警类型名称 |
| `w6` | 预警级别代码（01=蓝, 02=黄, 03=橙, 04=红） |
| `w7` | 预警级别名称 |
| `w8` | 发布时间 |
| `w9` | 预警详情描述 |
| `w10` | 预警唯一标识 |
| `w11` | 预警详情页路径 |
| `w12` | 更新时间 |
| `w13` | 预警标题 |
| `w15` | 预警过期时间 |
| `w16` | 区域+预警组合标识 |

#### 9.1.4 `dataZS` — 生活指数（30+ 项）

```json
{
  "zs": {
    "date": "2026071011",
    "uv_name": "紫外线强度指数",
    "uv_hint": "最弱",
    "uv_des_s": "辐射弱，涂擦SPF8-12防晒护肤品。",
    "ct_name": "穿衣指数",
    "ct_hint": "热",
    "ct_des_s": "适合穿T恤、短薄外套等夏季服装。",
    "xc_name": "洗车指数",
    "xc_hint": "不宜",
    "xc_des_s": "有雨，雨水和泥水会弄脏爱车。",
    "gm_name": "感冒指数",
    "gm_hint": "较易发",
    "gm_des_s": "天凉，湿度大，较易感冒。",
    "yd_name": "运动指数",
    "yd_hint": "较不宜",
    "yd_des_s": "有降水，推荐您在室内进行休闲运动。",
    "ys_name": "雨伞指数",
    "ys_hint": "带伞",
    "ys_des_s": "较强降水，带雨伞，避免淋湿。",
    "tr_name": "旅游指数",
    "tr_hint": "较不宜",
    "tr_des_s": "有强降雨，建议您最好还是在室内活动。",
    "co_name": "舒适度指数",
    "co_hint": "较舒适",
    "co_des_s": "晴好的天气，午后略闷热，早晚凉爽。",
    "ag_name": "过敏指数",
    "ag_hint": "不易发",
    "ag_des_s": "除特殊体质，无需担心过敏问题。",
    "zs_name": "中暑指数",
    "zs_hint": "无中暑风险",
    "zs_des_s": "天气不热，在炎炎夏日中十分难得。",
    "ls_name": "晾晒指数",
    "ls_hint": "不宜",
    "ls_des_s": "有较强降水会淋湿衣物，不适宜晾晒。",
    "cl_name": "晨练指数",
    "cl_hint": "不宜",
    "cl_des_s": "有较强降水，建议在室内做适当锻炼。",
    "jt_name": "交通指数",
    "jt_hint": "较差",
    "jt_des_s": "有强降水且路面湿滑，注意控制车速。",
    "dy_name": "钓鱼指数",
    "dy_hint": "不宜",
    "dy_des_s": "天气不好，不适合垂钓。",
    "gj_name": "逛街指数",
    "gj_hint": "不适宜",
    "gj_des_s": "有较强降水，坚持出门需带雨具。",
    "pk_name": "放风筝指数",
    "pk_hint": "不宜",
    "pk_des_s": "天气不好，不适宜放风筝。",
    "hc_name": "划船指数",
    "hc_hint": "不适宜",
    "hc_des_s": "天气不好，建议选择别的娱乐方式。",
    "nl_name": "夜生活指数",
    "nl_hint": "较不适宜",
    "nl_des_s": "建议夜生活最好在室内进行。",
    "yh_name": "约会指数",
    "yh_hint": "不适宜",
    "yh_des_s": "建议在室内约会，免去天气的骚扰。",
    "xq_name": "心情指数",
    "xq_hint": "差",
    "xq_des_s": "有较强降水，使人心情不佳，注意调节。",
    "pl_name": "空气污染扩散条件指数",
    "pl_hint": "优",
    "pl_des_s": "气象条件非常有利于空气污染物扩散。",
    "pj_name": "啤酒指数",
    "pj_hint": "适宜",
    "pj_des_s": "天气炎热，可适量饮用啤酒，不要过量。",
    "wc_name": "风寒指数",
    "wc_hint": "无",
    "wc_des_s": "温度未达到风寒所需的低温。",
    "ac_name": "空调开启指数",
    "ac_hint": "较少开启",
    "ac_des_s": "体感舒适，不需要开启空调。",
    "gl_name": "太阳镜指数",
    "gl_hint": "不需要",
    "gl_des_s": "白天能见度差不需要佩戴太阳镜",
    "fs_name": "防晒指数",
    "fs_hint": "弱",
    "fs_des_s": "涂抹8-12SPF防晒护肤品。",
    "mf_name": "美发指数",
    "mf_hint": "一般",
    "mf_des_s": "天热，头皮皮脂分泌多，注意清洁。",
    "pp_name": "化妆指数",
    "pp_hint": "去油",
    "pp_des_s": "请选用露质面霜打底，水质无油粉底霜。",
    "gz_name": "干燥指数",
    "gz_hint": "适宜",
    "gz_des_s": "温湿条件适宜，风速不大。",
    "lk_name": "路况指数",
    "lk_hint": "湿滑",
    "lk_des_s": "路面湿滑，车辆易打滑，减慢车速。"
  },
  "cn": "北京"
}
```

> 共 30+ 项生活指数。每个指数包含 `_name`（名称）、`_hint`（等级提示）、`_des_s`（详细描述）三个字段。

#### 9.1.5 `fc` — 7天预报

```json
{
  "f": [
    {
      "fa": "09", "fb": "10",
      "fc": "28", "fd": "24",
      "fe": "东风", "ff": "东南风",
      "fg": "<3级", "fh": "<3级",
      "fk": "2", "fl": "3",
      "fm": "100", "fn": "73.5",
      "fi": "7/10", "fj": "今天"
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `fa` | 白天天气代码 |
| `fb` | 夜间天气代码 |
| `fc` | 白天最高温度（℃） |
| `fd` | 夜间最低温度（℃） |
| `fe` | 白天风向 |
| `ff` | 夜间风向 |
| `fg` | 白天风力 |
| `fh` | 夜间风力 |
| `fk` / `fl` | 未知 |
| `fm` | 相对湿度（%） |
| `fn` | 降水概率（%） |
| `fi` | 日期（M/D） |
| `fj` | 星期几（中文） |

### 9.2 逐小时天气（3小时间隔）

**数据来源：** 7天预报页面 `http://www.weather.com.cn/weather/{cityCode}.shtml`

**请求头：** `Referer: https://www.weather.com.cn/`

**返回格式：** 页面内嵌 JavaScript 变量 `var hour3data = {...}`

```json
{
  "1d": [
    "10日11时,d09,大雨,25℃,东风,<3级,3",
    "10日14时,d08,中雨,27℃,东南风,<3级,3",
    "10日17时,d07,小雨,28℃,东风,<3级,3",
    "10日20时,n08,中雨,26℃,东风,<3级,0",
    "10日23时,n09,大雨,25℃,东风,<3级,0",
    "11日02时,n10,暴雨,25℃,东南风,<3级,0",
    "11日05时,n09,大雨,24℃,东南风,<3级,0",
    "11日08时,d02,阴,24℃,南风,<3级,3"
  ],
  "23d": [["11日08时,d02,阴,24℃,南风,<3级,3", ...]]
}
```

**每条数据格式：** CSV 字符串 `时间,天气代码,天气现象,温度,风向,风力,??`

| 段 | 说明 |
|------|------|
| 1 | 时间（M月D日HH时） |
| 2 | 天气代码（d=白天, n=夜间） |
| 3 | 天气现象（中文） |
| 4 | 温度（℃） |
| 5 | 风向 |
| 6 | 风力 |
| 7 | 未知 |

### 9.3 15天预报

```
GET http://www.weather.com.cn/weather15d/{cityCode}.shtml
```

**请求头：** `Referer: https://www.weather.com.cn/`

**返回格式：** HTML 页面，数据为服务端渲染（内嵌在 HTML 中），非 JSON API

**数据位于 HTML 结构中：**

```html
<ul class="t clearfix">
  <li>
    <span class="time">周五（17日）</span>
    <big class="png30 d02"></big>
    <big class="png30 n301"></big>
    <span class="wea">阴转雨</span>
    <span class="tem"><em>31℃</em>/23℃</span>
    <span class="wind">东南风转西南风</span>
    <span class="wind1"><3级</span>
  </li>
</ul>
```

> 需解析 HTML 提取数据。CSS 类 `png30 dXX` 对应白天天气图标，`png30 nXX` 对应夜间。

### 9.4 40天日历预报

```
GET https://d1.weather.com.cn/calendar_new/{year}/{cityCode}_{year}{month}.html
```

**请求头：** `Referer: https://www.weather.com.cn/`

**URL 参数：**

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `{year}` | String | 年份，4位数字 | `2026` |
| `{cityCode}` | String | 城市代码 | `101010100` |
| `{month}` | String | 月份，2位数字（补零） | `07` |

**示例：** `https://d1.weather.com.cn/calendar_new/2026/101010100_202607.html`

**返回格式：** JSONP（JavaScript 赋值 `var fc40 = [...]`）

```json
[
  {
    "alins": "开市.入宅.出行.修造.词讼",
    "als": "祭祀,沐浴,理发,整手足甲,修饰垣墙,平治道涂,馀事勿取",
    "cla": "history",
    "date": "20260628",
    "des": "历史均值",
    "hgl": "50%",
    "hmax": "32",
    "hmin": "22",
    "nl": "十四",
    "nlyf": "五月",
    "r": "f",
    "time": "11:30",
    "update": "yes",
    "wk": "日",
    "jq": "",
    "w1": "",
    "wd1": "",
    "ws1": "",
    "t1": "", "t2": "", "t3": "",
    "max": "", "min": "",
    "maxobs": "", "minobs": "",
    "rainobs": ""
  }
]
```

| 字段 | 说明 |
|------|------|
| `date` | 日期（YYYYMMDD） |
| `cla` | 数据类别：`history`=历史均值, `forecast`=预报 |
| `des` | 描述（历史均值/预报） |
| `hmax` | 历史最高温度（℃） |
| `hmin` | 历史最低温度（℃） |
| `hgl` | 历史降水概率（%） |
| `max` | 预报最高温度（℃），仅 `cla=forecast` 时有值 |
| `min` | 预报最低温度（℃），仅 `cla=forecast` 时有值 |
| `w1` | 白天天气现象 |
| `wd1` | 风向 |
| `ws1` | 风力 |
| `t1` | 天气图标（白天） |
| `t2` | 天气图标（夜间） |
| `nl` | 农历日 |
| `nlyf` | 农历月 |
| `wk` | 星期 |
| `jq` | 节气 |
| `alins` | 忌 |
| `als` | 宜 |
| `r` | 是否为休息日（f=否） |
| `time` | 更新时间 |
| `update` | 是否已更新 |

> 每月约 42 天的数据（含前后月部分日期），一次返回一个月的日历数据。需按月逐月请求获取完整 40 天数据。

### 9.5 定制化天气（Dingzhi）

```
GET https://d1.weather.com.cn/dingzhi/{cityCode}.html
```

**请求头：** `Referer: https://www.weather.com.cn/`

**返回格式：** JSONP

```javascript
var cityDZ101010100 = {"weatherinfo":{"city":"101010100","cityname":"北京","fctime":"202607101100","temp":"28℃","tempn":"24℃","weather":"大雨转暴雨","weathercode":"d9","weathercoden":"n10","wd":"东风转东南风","ws":"<3级"}};
var alarmDZ101010100 = {"w":[...]};
```

> 与 `weather_index` 接口中的 `cityDZ` 和 `alarmDZ` 数据相同，但变量名带城市代码后缀。

### 9.6 城市搜索

```
GET https://toy1.weather.com.cn/search?cityname={cityName}
```

**返回格式：** JSONP

**返回结构：** 城市列表，每条包含 `ref` 字段（格式：`cityCode~省份~城市名~...`）

### 9.7 IP 定位

```
GET https://wgeo.weather.com.cn/ip/
```

**返回格式：** JavaScript，设置全局变量 `id`（城市代码）

### 9.8 用户定制天空列表

```
GET https://mysky.weather.com.cn/myPhoto/customization/selectCustomizations/?userId={userId}
```

**返回格式：** JSONP（回调 `getallddd`）

**响应：** `{"message":"success","data":[...]}`

> 需要用户登录后的 userId。

### 9.9 天气代码对照

| 代码 | 天气 | 代码 | 天气 |
|------|------|------|------|
| `d00` / `n00` | 晴 | `d01` / `n01` | 多云 |
| `d02` / `n02` | 阴 | `d03` / `n03` | 阵雨 |
| `d04` / `n04` | 雷阵雨 | `d05` / `n05` | 雷阵雨伴冰雹 |
| `d06` / `n06` | 雨夹雪 | `d07` / `n07` | 小雨 |
| `d08` / `n08` | 中雨 | `d09` / `n09` | 大雨 |
| `d10` / `n10` | 暴雨 | `d11` / `n11` | 大暴雨 |
| `d12` / `n12` | 特大暴雨 | `d13` / `n13` | 阵雪 |
| `d14` / `n14` | 小雪 | `d15` / `n15` | 中雪 |
| `d16` / `n16` | 大雪 | `d17` / `n17` | 暴雪 |
| `d18` / `n18` | 雾 | `d19` / `n19` | 冻雨 |
| `d20` / `n20` | 沙尘暴 | `d21` / `n21` | 小到中雨 |
| `d22` / `n22` | 中到大雨 | `d23` / `n23` | 大到暴雨 |
| `d24` / `n24` | 暴雨到大暴雨 | `d25` / `n25` | 大暴雨到特大暴雨 |
| `d26` / `n26` | 小到中雪 | `d27` / `n27` | 中到大雪 |
| `d28` / `n28` | 大到暴雪 | `d29` / `n29` | 浮尘 |
| `d30` / `n30` | 扬沙 | `d31` / `n31` | 强沙尘暴 |
| `d301` / `n301` | 雨 | `d302` / `n302` | 雪 |

> 前缀 `d` = 白天 (day), `n` = 夜间 (night)。代码对应天气图标，如 `d02.png` 为白天阴天图标。