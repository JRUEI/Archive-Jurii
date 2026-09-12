# 逢田珠里依｜SHOWROOM

逢田 珠里依（≒JOY）SHOWROOM(ショールーム) 直播的繁體中文內容整理站。內容由 `content/episodes/*.md` 建置為 Next.js 靜態頁面。

## 本機執行

```powershell
npm ci
npm run dev
```

開啟 <http://localhost:3000>（若 3000 已被占用，Next 會改用 3001）。

## 部署前驗證

```powershell
npm run verify
```

這會依序執行 ESLint、TypeScript、內容檢查與 production build。`prebuild` 會在 Vercel 建置前自動執行唯讀內容驗證；既有內容品質問題會列為 warning，不會被工具自動改寫。

## 字幕與詞語庫

安全流程與指令見 [`docs/subtitle-workflow.md`](docs/subtitle-workflow.md)。詞語庫位於 `content/glossary.json`，dry-run 只報告可能替換，不會覆寫字幕。

人名一律依 [`docs/cast.md`](docs/cast.md)（網站上的對應頁面為 `/members`，資料檔 `content/members.json`） 的 ≒JOY 成員對照表（漢字名、讀音、暱稱、中文譯名與已知 ASR 錯聽）。

## Vercel

- Node.js 固定為 `24.x`。
- 使用預設 `npm run build`，不需要 `vercel.json`。
- `.vercelignore` 排除 Demo、報告、暫存字幕與封存腳本；公開網站只使用正式 Next.js 輸出。
