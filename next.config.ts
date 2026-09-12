import type { NextConfig } from "next";

// GitHub Pages 只服靜態檔，沒有 Node 伺服器：
// - output: 'export'  把全站輸出成 out/ 的 HTML/CSS/JS
// - basePath          網址多一層 /Archive-Jurii，不設的話 CSS 跟連結會 404
// 原本的 headers() 在靜態匯出不支援，CSP 改用 layout.tsx 的 <meta> 發。
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Archive-Jurii",
  poweredByHeader: false,
};

export default nextConfig;
