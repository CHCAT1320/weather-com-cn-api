import { renderBaseMap, renderChinaRadar, renderChinaCloud, renderChinaWind, renderChinaTyphoon, renderTyphoonOverview, saveToFile } from "./weather-lib";

const outDir = "output";

console.log("=".repeat(60));
console.log("  Weather Map Render Test");
console.log("=".repeat(60));

console.log("\n[1/6] Rendering base map...");
const base = await renderBaseMap();
await saveToFile(base, outDir + "/map_base.png");
console.log("  Saved: output/map_base.png (" + (base.buffer.byteLength / 1024).toFixed(1) + "KB)");

console.log("\n[2/6] Rendering radar map...");
const radar = await renderChinaRadar();
await saveToFile(radar, outDir + "/map_radar.png");
console.log("  Saved: output/map_radar.png (" + (radar.buffer.byteLength / 1024).toFixed(1) + "KB)");

console.log("\n[3/6] Rendering cloud map...");
const cloud = await renderChinaCloud();
await saveToFile(cloud, outDir + "/map_cloud.png");
console.log("  Saved: output/map_cloud.png (" + (cloud.buffer.byteLength / 1024).toFixed(1) + "KB)");

console.log("\n[4/6] Rendering wind map...");
const wind = await renderChinaWind();
await saveToFile(wind, outDir + "/map_wind.png");
console.log("  Saved: output/map_wind.png (" + (wind.buffer.byteLength / 1024).toFixed(1) + "KB)");

console.log("\n[5/6] Rendering typhoon map...");
const typhoon = await renderChinaTyphoon();
await saveToFile(typhoon, outDir + "/map_typhoon.png");
console.log("  Saved: output/map_typhoon.png (" + (typhoon.buffer.byteLength / 1024).toFixed(1) + "KB)");

console.log("\n[6/6] Rendering typhoon overview...");
const overview = await renderTyphoonOverview();
await saveToFile(overview, outDir + "/map_typhoon_overview.png");
console.log("  Saved: output/map_typhoon_overview.png (" + (overview.buffer.byteLength / 1024).toFixed(1) + "KB)");

console.log("\n" + "=".repeat(60));
console.log("  All renders complete!");
console.log("=".repeat(60));