# Weather Map Library

基于中国天气网数据源的气象地图渲染库，支持底图、雷达、云图、风场流线、台风路径等可视化。

## 安装

```bash
bun install
```

依赖：`sharp`（图像处理）

## 快速开始

```typescript
import { renderChinaRadar, renderChinaTyphoon, saveToFile } from "./weather-lib";

// 全国雷达图
const radar = await renderChinaRadar();
await saveToFile(radar, "output/radar.png");

// 台风图
const typhoon = await renderChinaTyphoon();
await saveToFile(typhoon, "output/typhoon.png");
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

## 文档

- [库 API 文档](LIBRARY_API.md)
- [数据源 API 文档](API_DOC.md)

## 数据源

- 台风 / 雷达 / 云图 / 风场：中国天气网 (weather.com.cn)
- 底图瓦片：高德地图（可通过 `tileUrl` 自定义）
- 风场模型：GFS 全球预报（1°×1° 网格）