# Context English

Context English 是一個私人使用的真實情境式英文學習系統。它的目標不是只翻譯英文，而是保存使用者在工作、生活、旅遊、軟體、圖片及工程畫面中實際遇到的英文，理解其核心概念、情境用法、選字原因與母語者自然表達，並為後續複習建立可攜式資料。

目前採用 ChatGPT-first 架構：

- ChatGPT 負責語言理解、情境判斷、詞彙比較、句子分析與個人化教學。
- CE Learning Packet 負責在 ChatGPT 與未來輔助工具之間交換結構化學習資料。
- 未來的 PWA 將負責知識庫、Encounter、Mastery、間隔複習、圖片資產、OCR、搜尋及匯入匯出。

目前完成的是教學規則、資料交換規格、JSON Schema 與 regression fixtures。這不代表 PWA、資料庫或 AI API 已經完成；本 Repository 目前沒有串接任何 AI API 或外部託管服務。

## Specifications

- [Teaching Rules](docs/TEACHING_RULES.md)
- [CE Learning Packet v1](docs/LEARNING_PACKET_SPEC.md)
- [CE Learning Packet v1 JSON Schema](schemas/ce-learning-packet-v1.schema.json)

## Schema validation

在乾淨的暫存 virtual environment 中執行：

```bash
CE_TEST_VENV="$(mktemp -d /tmp/context-english-test.XXXXXX)"
python3 -m venv "$CE_TEST_VENV"
"$CE_TEST_VENV/bin/python" -m pip install -r tests/requirements.txt
"$CE_TEST_VENV/bin/python" tests/validate_learning_packets.py
```

驗證器使用 JSON Schema Draft 2020-12，並明確啟用 RFC 3339 `date-time` format assertion。
