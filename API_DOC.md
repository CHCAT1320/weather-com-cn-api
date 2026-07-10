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