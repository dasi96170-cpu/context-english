# CE Learning Packet v1 Specification

## 1. 目的

CE Learning Packet 是 ChatGPT 與 Context English 輔助工具之間的資料交換格式。

它用來保存一次真實學習事件，包括：

- 使用者這次輸入了什麼
- 在什麼情境下遇見
- 這次學了哪些單字、片語、術語或句型
- ChatGPT 對目前情境的分析
- 詞彙比較或句子分析
- ChatGPT 提出的學習建議

CE Learning Packet 不是 UI 顯示格式，也不是完整資料庫備份格式。

## 2. 版本名稱

正式名稱：

`CE Learning Packet v1`

`schemaVersion` 固定為：

`"1.0"`

同一 major version 內只能增加向後相容的選填欄位。若刪除欄位、改變既有欄位語意或資料型別，必須升級 major version。

## 3. 設計原則

1. 必填欄位保持精簡。
2. 不適用的選填欄位直接省略。
3. 不用大量 `null`、空字串或空陣列填滿資料。
4. 每個欄位保存語意資料，不保存卡片顏色、分頁位置等 UI 狀態。
5. 圖片只保存參照，不放入 Base64。
6. ChatGPT 不確定的內容不得為了通過格式而編造。
7. 使用受控列舉表示頻率、自然度和學習優先度。
8. 自由文字保留足夠彈性，避免第一版建立過度龐大的分類系統。
9. 未來實驗性資料優先放入 `extensions`，成熟後再升級為正式欄位。
10. 匯入工具必須先驗證，再寫入正式知識庫。
11. Packet source ID 與資料庫正式 ID 分離。
12. UI、Mastery、Review、ErrorRecord 及搜尋索引不屬於 v1 Packet 核心資料。

## 4. 頂層結構

| 欄位 | 必填 | 說明 |
|---|---:|---|
| `schemaVersion` | 是 | 固定為 `"1.0"` |
| `packetId` | 是 | ChatGPT 產生的 Packet source ID |
| `generatedAt` | 否 | ChatGPT 產生 Packet 的時間 |
| `encounter` | 是 | 這次真實遇見事件 |
| `knowledgeItems` | 是 | 一個或多個學習項目 |
| `comparisons` | 否 | 多詞比較 |
| `sentenceAnalysis` | 否 | 句子輸入的分析 |
| `learningAdvice` | 是 | 整體學習建議 |
| `extensions` | 否 | 未來擴充資料 |

## 5. Packet Metadata

### 5.1 schemaVersion

- 型別：string
- 必填
- v1 固定為 `"1.0"`

### 5.2 packetId

- 型別：string
- 必填
- 只能使用英文字母、數字、底線和連字號
- 建議前綴：`cep_`
- 是來源資料的 source ID，不是資料庫正式永久 ID
- PWA 匯入時必須檢查重複並建立正式 UUID 或 ULID

### 5.3 generatedAt

- 型別：string
- 選填
- 表示 ChatGPT 產生 Packet 的時間
- 必須符合 ISO 8601／RFC 3339 `date-time`
- 只有對話環境能可靠提供時間時才填
- ChatGPT 不得猜測使用者裝置的精確時間

## 6. 時間語意

CE Learning Packet v1 不使用單一、語意模糊的 `createdAt`。

### 6.1 encounteredAt

- 位於 `encounter`
- 選填
- 表示使用者實際遇到英文的時間
- 必須符合 ISO 8601／RFC 3339 `date-time`
- 只有使用者提供、圖片 metadata 可知，或系統可靠取得時才填
- ChatGPT 不得猜測使用者實際遇見時間

### 6.2 generatedAt

- 位於 Packet 頂層
- 選填
- 表示 ChatGPT 產生 Packet 的時間
- 缺少此欄位不影響 Packet 合法性

### 6.3 importedAt

- 不屬於 CE Learning Packet
- 由 PWA 在完成匯入時自行建立
- 不由 ChatGPT 輸出
- 不得覆寫 `encounteredAt` 或 `generatedAt`

三個時間代表不同事件，不應互相代替。

## 7. Source ID 與資料庫正式 ID

CE Learning Packet v1 只保留 `packetId` 作為 ChatGPT source ID。

不要求：

- `encounterId`
- `itemId`

理由：

- 每份 Packet 只有一個 Encounter，沒有跨欄位需要引用 Encounter ID。
- `comparisons` 以詞面文字表達，目前沒有引用 Knowledge Item ID。
- 由 ChatGPT 產生未被引用的 ID 只會增加錯誤與衝突風險。

`packetId` 用於：

- 人工辨識與討論來源 Packet
- 重複匯入的初步檢查
- 錯誤追蹤
- 保存來源 provenance

PWA 匯入時應：

1. 驗證 `packetId` 格式。
2. 檢查是否曾匯入相同 Packet。
3. 計算內容 hash，不只依賴 `packetId` 判定重複。
4. 為 Packet、Encounter 和每個 Knowledge Item 建立正式 UUID 或 ULID。
5. 保存原始 `packetId`。
6. 保存原始 Packet JSON。
7. 以 JSON Pointer 保存項目來源位置，例如 `/knowledgeItems/0`。
8. 不因 source ID 相同就直接覆蓋既有資料。

## 8. Encounter

Encounter 表示這次輸入與有價值的真實來源情境。

| 欄位 | 必填 | 說明 |
|---|---:|---|
| `originalInput` | 是 | 使用者原始輸入或圖片的文字表示 |
| `inputType` | 是 | 主要輸入類型 |
| `contextDescription` | 否 | 真實且有學習價值的情境 |
| `primaryDomain` | 是 | 學習內容本身的主要領域 |
| `subdomains` | 否 | 品牌、技術或產品細分類 |
| `sourceType` | 是 | typedText、image、screenshot 等 |
| `sourceLanguage` | 是 | 受控來源語言 |
| `sourceName` | 否 | 軟體、網站、文件或應用名稱 |
| `sourceLocation` | 否 | 軟體畫面、功能路徑或文件位置 |
| `encounteredAt` | 否 | 實際遇見時間 |
| `imageReference` | 否 | PWA 可解析的圖片資產參照 |
| `originalQuestion` | 否 | 使用者原始問題 |

### 8.0 原始文字與 provenance

`originalInput` 與 `originalQuestion` 是 provenance 欄位，不是摘要欄位。若欄位保存的是使用者文字，內容必須逐字來自使用者實際輸入，不得摘要、潤飾、重寫、重新組句，或把多輪訊息合併成一個看似原始、但使用者從未輸入過的句子。ChatGPT 產生的教學描述、意圖判斷或情境摘要不得冒充使用者原始輸入或原始問題。

多輪 Encounter 應遵守：

- `originalInput` 保存最直接對應本次學習目標的使用者原文，前提是該文字確實出現在使用者輸入中。
- 其他有學習價值的多輪情境可整理到 `contextDescription`；`contextDescription` 是描述欄位，不得被當作逐字引文。
- `originalQuestion` 只有在能可靠逐字取得使用者問題時才填。無法確認逐字內容時必須省略，不得用摘要或重建句代替。
- CE Learning Packet v1 不應為了保存全部多輪內容而偽造單一原句。完整對話保存若有需要，應由未來版本或 PWA 的來源資料處理。

圖片或截圖沒有適合直接複製的文字型 `originalInput` 時，仍可使用忠實的圖片內容文字表示，但必須清楚表明它是圖片內容的表示，例如以「圖片內容表示：」開頭。只可描述畫面中能確認的文字或可見內容，不得加入圖片中沒有的推論、歷史、來源或使用者意圖。

正反例：

- 正確：使用者輸入 `Open the light.`，則 `originalInput` 保存為 `Open the light.`。
- 錯誤：第一輪輸入 `我在旅遊網站看到 check in。`，第二輪輸入 `保存`，卻將兩輪合併成使用者未曾輸入的 `我在旅遊網站看到 check in，請幫我保存。` 作為 `originalInput`。此時應逐字保存最直接的學習輸入 `我在旅遊網站看到 check in。`，並由保存指令觸發 Packet，不把兩輪重組為新句子。
- 錯誤：使用者原本問 `這句是我自己寫的，請告訴我為什麼不自然，還有在房間裡請別人開燈時怎麼說。`，卻將摘要後的 `為什麼這句不自然？` 寫入 `originalQuestion`。若要填 `originalQuestion`，必須保存完整原句；若無法可靠取得完整原句，就省略該欄位。

### 8.1 inputType

允許值：

- `englishWord`
- `englishPhrase`
- `englishSentence`
- `userWrittenEnglish`
- `chineseConcept`
- `chineseSentence`
- `comparison`
- `image`
- `engineeringScreen`
- `mixed`

### 8.2 sourceType

允許值：

- `typedText`
- `pastedText`
- `image`
- `screenshot`
- `camera`
- `conversation`
- `other`

### 8.3 sourceLanguage

CE Learning Packet v1 只允許：

- `en`
- `zh-Hant`
- `mixed`
- `und`

未來如需更多語言，透過相容版本或新版 Schema 擴充，不使用任意自由字串。

### 8.4 contextDescription

`contextDescription` 為選填。

只有真的存在有價值的真實情境時才保存，例如：

- 在 GX Works2 的 Device List 看到 `device`
- 在 HMI 配方管理畫面看到 `recipe`
- 在工作 Email 中看到特定句子
- 在機場標示上看到某個片語

純一般單字查詢不應為了通過 Schema 產生「一般英文單字查詢」「沒有特殊情境」等填充值。

### 8.5 primaryDomain

`primaryDomain` 表示學習內容本身的主要知識或使用領域，不表示使用者當時所在的場合。

允許值：

- `general`
- `engineering`
- `software`
- `work`
- `business`
- `travel`
- `dailyLife`
- `social`
- `entertainment`
- `other`

例如，在工作中使用 GX Works2 遇到 `device`：

```json
{
  "primaryDomain": "engineering",
  "subdomains": ["PLC", "Mitsubishi PLC", "GX Works2"]
}
```

不應只因為在工作時間遇見，就使用 `work`。

`work` 適用於內容本身是一般職場活動、工作協作、內部溝通或工作流程的情況。`business` 適用於商務、交易、企業或較正式商業溝通。

使用者當時是在工作、生活或旅途中遇見，可由 `contextDescription` 或未來的 tags 表示。

### 8.6 subdomains、sourceName 與 sourceLocation

`subdomains` 是自由字串陣列，例如：

```json
["PLC", "Mitsubishi PLC", "GX Works2"]
```

`sourceName` 範例：

```json
"GX Works2"
```

`sourceLocation` 範例：

```json
"Find/Replace > Device List"
```

規則：

- `primaryDomain` 用於穩定大分類。
- `subdomains` 用於品牌、技術領域和產品分類。
- `sourceName` 表示來源產品或文件。
- `sourceLocation` 表示來源內的具體位置。
- 不要把所有資訊重複塞進 `primaryDomain`。
- 無法確定時，不得猜測 `sourceName` 或 `sourceLocation`。

### 8.7 imageReference

`imageReference` 只保存邏輯資產 ID、檔名或相對參照，不保存 Base64，也不要求是公開 URL。

圖片檔案本身由未來 PWA 的資產儲存、備份與還原機制負責。

## 9. Knowledge Item

Knowledge Item 是可獨立保存、搜尋與複習的學習項目。

一次 Packet 至少有一個 Knowledge Item。

### 9.1 必填欄位

| 欄位 | 說明 |
|---|---|
| `type` | 學習項目類型 |
| `expression` | 實際英文形式 |
| `currentMeaning` | 本次情境中的中文意思 |
| `coreConcept` | 核心概念 |

### 9.2 選填欄位

| 欄位 | 說明 |
|---|---|
| `lemma` | 標準詞形 |
| `partOfSpeech` | 本次使用的詞性 |
| `ipa` | IPA |
| `syllables` | 音節陣列 |
| `stress` | 重音表示 |
| `usage` | 使用程度與學習角色 |
| `analysis` | 詳細情境分析 |

`syllables` 依實際發音順序保存音節。相同音節可以重複，例如 `banana` 可表示為 `["ba", "na", "na"]`；不得要求陣列元素唯一。

### 9.3 type

允許值：

- `word`
- `term`
- `phrase`
- `phrasalVerb`
- `idiom`
- `chunk`
- `sentencePattern`

不是每種類型都適用 lemma、IPA 或詞性。不適用時省略。

### 9.4 term

`term` 用於具有特定領域定義或功能名稱的術語，例如：

- `home position`
- `remote operation`
- `alarm history`
- `device list`
- 工業自動化語境中的 `recipe`

`term` 和 `phrase` 的差別：

- `phrase`：一般語言中的多字表達
- `term`：在某個領域、產品或工作流程中具有特定定義或功能的名稱

同一表達可能在一般語言中是 word 或 phrase，但在特定 Encounter 中以 term 保存。

例如：

- 一般飲食語境的 `recipe` 可保存為 `word`
- HMI 配方管理功能中的 `recipe` 可保存為 `term`

Knowledge Item 的 type 表示本次學習角度，不宣稱該表達永遠只屬於一種類型。

## 10. Usage

`usage` 整體為選填；存在時至少包含一個子欄位。

以下子欄位也都按需要選填：

- `frequency`
- `register`
- `commonContexts`
- `naturalness`
- `learningPriority`
- `vocabularyRole`

不同 Knowledge Item 類型不一定適合所有 Usage 欄位。

例如：

- 一般單字適合標示 frequency 和 naturalness。
- 廠商 UI 術語可能適合標示 register、commonContexts 和 learningPriority，但未必適合宣稱一般語言頻率。
- sentencePattern 未必需要 vocabularyRole。
- 極特定功能名稱的母語者自然度可能沒有獨立學習價值。

不得為了格式完整而填入無可靠依據或沒有學習價值的值。若 AI 無法可靠判斷某欄位，應省略。

空物件 `"usage": {}` 不合法；若沒有任何適合的 Usage 資料，應省略整個 `usage`。

### 10.1 frequency

- `veryCommon`
- `common`
- `domainCommon`
- `uncommon`
- `rareOrDated`

### 10.2 register

- `informal`
- `neutral`
- `formal`
- `veryFormal`
- `technical`

`register` 是一個或多個值的陣列。

### 10.3 naturalness

- `nativeCommon`
- `natural`
- `contextDependent`
- `grammaticalButUnnatural`
- `unnatural`

### 10.4 learningPriority

- `mustLearn`
- `recommended`
- `recognitionOnly`
- `notNow`

### 10.5 vocabularyRole

- `active`
- `passive`
- `both`

### 10.6 confidence

v1 不加入單一 `confidence` 欄位。不同判斷可能具有不同信心，例如詞義、頻率、OCR 與情境判讀不能合理共用一個 confidence。

未來如加入，應考慮附在個別 assertion 或分析區塊，而不是代表整份 Knowledge Item。

## 11. Analysis

`analysis` 屬於單一 Knowledge Item，整體與所有子欄位皆為選填。若存在，至少包含一個子欄位。

可包含：

- `contextualMeaning`
- `whyThisWord`
- `namingLogic`
- `whyNotAlternatives`
- `multipleMeanings`
- `literalMeaning`
- `actualMeaning`
- `collocations`
- `phrases`
- `phrasalVerbs`
- `idioms`
- `wordFamily`
- `examples`

### 11.1 whyNotAlternatives

每筆包含：

- `alternative`
- `explanation`

### 11.2 multipleMeanings

每筆必須包含：

- `meaning`

並可選擇包含：

- `contexts`
- `frequency`

不同義項可以有不同 frequency。無法可靠判斷時省略。

### 11.3 Multiple Meanings 與 Concept Tree

CE Learning Packet v1 的 `multipleMeanings` 只保存目前有學習價值的重要義項。

它是義項列表，不是真正的 Concept Tree，也不表示正式的 Sense hierarchy。

v1 不處理：

- 父子義項
- 義項衍生關係
- 比喻延伸路徑
- Sense ID
- 跨 Encounter 的義項合併
- 完整概念網路

未來可透過 `extensions`、正式資料庫中的 Sense 模型或新版 Learning Packet 加入 Concept Tree。

### 11.4 延伸表達

`collocations`、`phrases`、`phrasalVerbs`、`idioms` 共用精簡結構。

每筆必須包含：

- `expression`

並可選擇包含：

- `meaning`
- `usageNote`
- `literalMeaning`
- `actualMeaning`

### 11.5 wordFamily

每筆必須包含：

- `expression`

並可選擇包含：

- `partOfSpeech`
- `meaning`

### 11.6 examples

每筆必須包含：

- `english`
- `chinese`

並可選擇包含：

- `context`
- `note`

不適用的分析區塊直接省略。

## 12. Comparisons

`comparisons` 是選填陣列，用於：

- 中文一詞多英文
- 近義詞比較
- 替換字比較
- 易混淆詞比較

每組 Comparison 包含：

| 欄位 | 必填 | 說明 |
|---|---:|---|
| `terms` | 是 | 至少兩個不重複的被比較詞 |
| `coreDifference` | 是 | 整組核心差異摘要 |
| `entries` | 是 | 至少兩筆詳細差異 |
| `interchangeability` | 是 | 是否可互換及限制 |
| `replacementEffect` | 否 | 替換後語意如何變化 |

每個 `entry` 必須包含：

- `term`
- `coreConcept`
- `suitableContexts`
- `naturalness`

並可選擇包含：

- `register`
- `note`

`interchangeability.level` 允許：

- `yes`
- `sometimes`
- `no`

並必須附 `explanation`。

## 13. Sentence Analysis

`sentenceAnalysis` 是選填物件，只在句子輸入或句子修正有價值時使用。若存在，至少包含一個子欄位。

可包含：

- `translation`
- `chunks`
- `patterns`
- `unnaturalParts`
- `correctedVersion`
- `simpleVersion`
- `naturalVersion`
- `workVersion`
- `formalVersion`

### 13.1 chunks

每筆必須包含：

- `text`
- `meaning`

可選擇包含：

- `role`

### 13.2 patterns

每筆包含：

- `pattern`
- `explanation`

### 13.3 unnaturalParts

每筆包含：

- `text`
- `issue`
- `explanation`
- `suggestion`

不應為了填滿四種版本而產生意思幾乎相同的句子。不適用的版本直接省略。

## 14. Learning Advice

`learningAdvice` 為必填物件，表示 ChatGPT 對這次內容的建議，不代表資料已自動保存。

包含：

| 欄位 | 必填 | 說明 |
|---|---:|---|
| `shouldSave` | 是 | 是否建議加入正式知識庫 |
| `priority` | 是 | 學習優先度 |
| `reason` | 是 | 建議原因 |
| `activeOrPassive` | 是 | 整體學習角色 |
| `recommendedPractice` | 是 | 一個或多個建議練習 |

`priority` 允許：

- `mustLearn`
- `recommended`
- `recognitionOnly`
- `notNow`

`activeOrPassive` 允許：

- `active`
- `passive`
- `both`
- `notApplicable`

即使使用者已要求保存，`shouldSave` 和 `priority` 仍應反映真實學習建議。

## 15. Future Extensions

v1 預留 `extensions` 物件，但不強制定義以下資料：

- `mastery`
- `reviewSeeds`
- `errorRecord`
- `confusionGroup`
- `imageAnnotation`
- `ocrCoordinates`
- `realUsage`

實驗性資料應使用具命名空間的 key，例如：

```json
{
  "extensions": {
    "contextEnglish.reviewSeeds.v1": {},
    "contextEnglish.imageAnnotation.v1": {}
  }
}
```

正式進入核心規格前，應先經過實際案例驗證。

## 16. PWA 持久狀態責任

以下資料或行為由未來 PWA 負責，不屬於 CE Learning Packet v1 的核心必填資料：

- Packet、Encounter、Knowledge Item 的正式 UUID／ULID
- `importedAt`
- 原始 Packet 與內容 hash
- Encounter 合併與真實遇見次數
- Mastery 各能力維度
- Review 排程與答題紀錄
- ErrorRecord
- ConfusionGroup
- 搜尋索引與模糊搜尋資料
- 圖片二進位資產
- OCR 座標
- 使用者修正歷史
- 備份、還原與版本遷移

Packet 可以提供建立這些資料的來源，但不應把整個應用程式狀態塞入交換格式。

## 17. 省略、null 與空值規則

- 頂層與各物件的必填欄位不可省略。
- 選填欄位沒有資料時優先省略。
- 不使用空字串代表未知。
- 不建立空的選填陣列或空物件。
- `usage` 或 `analysis` 若存在，至少要有一個子欄位。
- 不確定與不適用是不同狀態；v1 優先都以省略處理，必要時在人類可讀分析中說明。

## 18. 匯入驗證

PWA 匯入時應依序：

1. 確認 JSON 可解析。
2. 確認 `schemaVersion` 支援。
3. 使用 JSON Schema Draft 2020-12 驗證。
4. 明確啟用 RFC 3339 `date-time` format assertion。
5. 檢查是否已有相同 `packetId`。
6. 計算內容 hash，檢查是否曾匯入相同內容。
7. 檢查 Knowledge Item 是否可能重複。
8. 顯示預覽，讓使用者決定新增、合併或取消。
9. 建立正式 UUID／ULID 與 `importedAt`。
10. 保存原始 Packet，便於未來重新解析或版本遷移。

不得因單一選填欄位缺失而拒絕整份合法 Packet。

注意：部分 JSON Schema validator 將 `format` 視為 annotation。實作者必須確認 validator 已載入並啟用 RFC 3339 date-time checker，不能只假設宣告 `"format": "date-time"` 就會自動拒絕錯誤日期。

## 19. ChatGPT 輸出規則

輸出 Learning Packet 時：

- 使用單一 JSON code block
- 不在 JSON code block 中加入註解
- 不使用 Markdown 表格代替 JSON
- 不使用尾端逗號
- 不輸出 JavaScript 物件語法
- 不輸出圖片 Base64
- 不編造圖片 ID、來源、時間或使用者歷史
- 只包含和本次 Encounter 有關的內容
- 選填欄位無資料時省略
- 不輸出 `createdAt`
- 不輸出 `encounterId` 或 `itemId`
- `sourceLanguage` 只使用 v1 允許值
- `primaryDomain` 表示內容領域，不表示使用者所在場合
- 純一般查詢不建立無資訊價值的 `contextDescription`

## 20. 正式 JSON Schema

正式機器可讀 Schema 位於：

`schemas/ce-learning-packet-v1.schema.json`

該 Schema 使用 JSON Schema Draft 2020-12。
