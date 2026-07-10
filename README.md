# Weather Map Library

基于中国天气网数据源的气象地图渲染库，支持底图、雷达、云图、风场流线、台风路径、天气卡片等可视化。

## 安装

```bash
bun install
```

依赖：`sharp`（图像处理）

## 快速开始

### 地图渲染

```typescript
import { renderChinaRadar, renderChinaTyphoon, saveToFile } from "./weather-lib";

const radar = await renderChinaRadar();
await saveToFile(radar, "output/radar.png");

const typhoon = await renderChinaTyphoon();
await saveToFile(typhoon, "output/typhoon.png");
```

### 我的天气

```typescript
import { renderWeatherDashboard, renderWeatherCard, getWeatherIndex, getIpLocation, saveToFile } from "./weather-lib";

// 一键仪表盘
const dashboard = await renderWeatherDashboard("101010100");
await saveToFile(dashboard, "output/dashboard.png");

// 或分步操作
const code = await getIpLocation();              // IP 自动定位
const wx = await getWeatherIndex(code);          // 获取天气数据
await saveToFile(await renderWeatherCard(wx.dataSK, wx.dataZS, wx.alarmDZ.w, wx.fc.f), "output/card.png");
```

## 渲染函数

| 函数 | 说明 | 默认画布 |
|------|------|---------|
| `renderBaseMap()` | 纯底图 | 1600×1200 |
| `renderChinaRadar()` | 底图 + 全国雷达 | 1600×1200 |
| `renderChinaCloud()` | 底图 + 卫星云图 | 1600×1200 |
| `renderChinaWind()` | 暗色底图 + 风场流线 | 1600×1200 |
| `renderGlobalWind()` | 全球风场流线 | 1024×512 |
| `renderChinaTyphoon()` | 台风聚焦图 | 1600×1200 |
| `renderTyphoonOverview()` | 台风全览图 | 1600×1200 |
| `renderWeatherCard()` | 天气卡片 | 580×380 |
| `renderForecastChart()` | 7天预报图表 | 700×360 |
| `renderHourlyTimeline()` | 逐小时时间线 | 700×320 |
| `renderWeatherDashboard()` | 三合一仪表盘 | 700×~1000 |

## 数据函数

| 函数 | 说明 |
|------|------|
| `getWeatherIndex(cityCode)` | 实时天气 + 生活指数 + 预警 + 7天预报 |
| `getHourlyWeather(cityCode)` | 逐3小时天气预报 |
| `getCalendar40(cityCode, year, month)` | 40天日历预报 |
| `getIpLocation()` | IP 定位获取城市代码 |
| `searchCity(name)` | 按名称搜索城市 |
| `getTyphoonList()` | 台风列表 |
| `getTyphoonNew(code)` | 台风详情 |
| `getRadarList()` / `getCloudList()` | 雷达/云图列表 |
| `getWindList()` / `getWindData()` | 风场数据 |

## 文档

- [库 API 文档](LIBRARY_API.md)
- [数据源 API 文档](API_DOC.md)

## 数据源

- 台风 / 雷达 / 云图 / 风场 / 天气：中国天气网 (weather.com.cn)
- 底图瓦片：高德地图（可通过 `tileUrl` 自定义）
- 风场模型：GFS 全球预报（1°×1° 网格）