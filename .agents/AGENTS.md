# 逢田珠里依 SHOWROOM（Archive-Jurii）- Agent Rules (邊界守則)

因應大語言模型（LLM）的高自主性風險，維護本專案的 AI 代理（Agent）必須嚴格遵守以下邊界守則與 Auto-review 機制。

## 1. 停止與真實回報機制 (Stop and Report)
* **找不到資源時**：若指定的 Markdown 檔案、圖片或程式碼元件不存在，**絕對禁止** AI 自行捏造或強硬生成替代內容。必須立即停止執行，並真實回報給使用者「找不到該資源」。
* **權限與執行錯誤時**：若遇到 npm 依賴安裝失敗、或是缺少讀寫權限，不得擅自刪除重要設定檔（如 `package.json`、`tsconfig.json`）來試圖修復。必須中斷任務並提供錯誤 Log 供使用者判斷。
* **語氣要求**：回報問題時應保持中立、客觀，移除所有「鼓勵堅持」、「強硬完成」或「這很容易修復」的主觀臆測語氣。

## 2. Auto-review (人工審核點)
在 Antigravity 系統中，為了落實安全，以下操作會強制進入 pending 狀態，等待使用者批准（Approve）或拒絕（Reject）：
* **任何終端機指令 (`run_command`)**：包含但不限於 `npm install`、`npm run build`、`git commit` 等，AI 只能**提案**，實際執行權在使用者手上。
* **高風險修改**：若涉及大規模重構核心架構（如更改 Next.js App Router 路由結構），AI 必須先提交 `implementation_plan.md` 供使用者審查，核准後才可修改。

## 3. 網站維護邊界
* **段落格式與切段規則**：製作或重切集數檔一律照 `docs/episode-workflow.md`，每段標題帶開始時間碼，話題講滿 60 秒才開新段。
* **不可隨意覆蓋**：更新 `content/episodes/` 內的 Markdown 廣播紀錄時，若檔案已存在，AI 必須先使用 `view_file` 讀取內容，並徵求使用者同意是否覆寫。
* **設計系統鎖定**：本站色票取自制服視覺（卡其米棕外套 + 奶油黃緞帶 + 金釦 + 膚棕背景），以 `--color-brand-yellow`／`ochre`／`brown`／`cream`／`tan`／`gold`／`ink` 七個 token 表示，亮暗兩套實際色值**一律以 `src/app/globals.css` 為準**，不要在其他檔案另抄一份。非經使用者明確指示，AI 不得擅自修改這些 token 的色值。
* **不要在元件裡寫死色碼**：需要品牌色一律用 token（例如 `text-brand-ink`，而不是 `text-[#2E2118]`）。唯一的例外是 `CardMode.tsx` 的圖卡匯出——`html-to-image` 讀不到 Tailwind class，必須用 inline style，但那份色表應該與 token 同源，不得各自演化。

## 4. 展現形式的絕對原則 (HTML Demo vs Markdown)
* **嚴禁使用 Markdown 企劃書/報告**：遇到需要展示規劃、架構或資料庫概念時，**絕對禁止**產出 `implementation_plan.md` 或是任何 Markdown 格式的產出給使用者。
* **一律使用 HTML UI 雛形**：不論是企劃展示、修改前後比對，或是概念解說，**一律且只能**透過撰寫獨立的 `demo_xxx.html` 來進行視覺化的 UI 呈現。
