---
name: manage-harumatope-wiki
description: 用來維護福嶋晴菜「はるまとぺーじ」廣播 Wiki 的專屬技能，包含新增集數、架構解析與本地開發指南。
---

# Harumatope Wiki 維護指南

這份技能指南提供給未來維護此專案的 Agent，幫助你快速掌握這個專案的架構，並能安全地協助使用者新增集數或微調 UI。

## 1. 專案架構概覽
此專案是一個基於 Next.js 15 (App Router) + Tailwind CSS v4 的純靜態展示網站，主要由 Markdown 驅動內容。
* **內容存放區**：`content/episodes/*.md` (所有廣播集數的存放地)
* **核心元件**：`src/components/EpisodeViewer.tsx` (負責切換四種模式)
* **解析器**：`src/lib/markdown.ts` (負責透過 `gray-matter` 解析 Frontmatter 與切分區塊)

## 2. 最小權限操作指南 (新增集數)
當使用者要求「新增一集廣播內容」時，請遵守以下最小權限流程：
1. **讀取內容**：直接讀取使用者提供的純文字或 Markdown 內容。
2. **格式化**：確保其符合 `Unified_System_Instruction` 定義的格式（包含 `【精簡總結】` 與 `【無損還原】`）。
3. **建立檔案**：使用專用工具 `write_to_file` 寫入至 `content/episodes/epXX.md`，**不要**透過終端機執行 bash/powershell 腳本寫入。
4. **驗證**：若需確認結果，請提議執行 `npm run dev` 並請使用者至 `localhost:3000` 確認。

## 3. UI 與設計系統修改限制
* 本站的 UI 擁有獨特的「IG 限時動態滑動卡片模式」(`CardMode.tsx`)，該模式深度整合了 `framer-motion`。若要修改動畫，請務必先備份原檔案。
* 若要修改主視覺顏色，請統一至 `src/app/globals.css` 調整 `:root` 變數中的 `--color-brand-purple` 與 `--color-brand-green`，不可在組件內硬編碼 Hex 色碼。
