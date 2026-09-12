# 雙語 ASS 字幕安全流程

1. 保留來源檔。候選字幕必須維持相同 `Dialogue:` 列數，且逐列照抄 `H:MM:SS.cc` 的開始與結束時間碼。
2. 可在相鄰列間重新分配碎字，但不可刪除、合併或新增時間軸。中日文要同步調整；批次首尾的半句不可腦補。
3. 每個 `\N` 視覺行以 20 字為目標。21–25 字預設警告，超過 25 字失敗；加 `--strict-length` 後，超過 20 字即失敗。
4. 詞語庫只先做 dry-run，人工確認後才交給翻譯流程；工具不會覆寫任何檔案。

```powershell
npm run glossary:dry-run -- --input .\input.ass --episode 2
npm run subtitles:check -- --source .\input.ass --candidate .\output.ass --strict-length
npm run validate:content
```

若來源含 `[Script Info]`、`[Events]`，候選檔也必須保留；來源只有 `Dialogue:` 時，不得自行新增標頭。
