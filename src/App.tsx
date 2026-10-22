import { useState } from "react";

import {
  prepareLearningPacketImport,
  type PrepareLearningPacketImportResult,
} from "./application/prepareLearningPacketImport";

export function App() {
  const [jsonText, setJsonText] = useState("");
  const [result, setResult] = useState<PrepareLearningPacketImportResult | null>(null);
  const [preparing, setPreparing] = useState(false);

  async function prepareImport() {
    setPreparing(true);
    setResult(await prepareLearningPacketImport(jsonText));
    setPreparing(false);
  }

  const candidate = result?.success ? result.candidate : null;
  const packet = candidate?.sourceDocument;

  return (
    <main className="app-shell">
      <h1>Context English</h1>
      <p>貼上 CE Learning Packet v1 JSON，驗證後建立尚未儲存的匯入預覽。</p>

      <label htmlFor="packet-json">Learning Packet JSON</label>
      <textarea
        id="packet-json"
        value={jsonText}
        onChange={(event) => {
          setJsonText(event.target.value);
          setResult(null);
        }}
        rows={18}
        spellCheck={false}
        placeholder='{"schemaVersion":"1.0", ...}'
      />

      <button type="button" onClick={() => void prepareImport()} disabled={preparing}>
        {preparing ? "Preparing…" : "Prepare Import"}
      </button>

      {candidate && packet && (
        <section className="result valid" aria-live="polite">
          <h2>Import Preview</h2>

          <h3>Packet</h3>
          <dl>
            <dt>Packet ID</dt>
            <dd><code>{packet.packetId}</code></dd>
            <dt>Schema version</dt>
            <dd>{packet.schemaVersion}</dd>
            {packet.generatedAt && (
              <>
                <dt>Generated at</dt>
                <dd>{packet.generatedAt}</dd>
              </>
            )}
          </dl>

          <h3>Encounter</h3>
          <dl>
            <dt>Original input</dt>
            <dd>{packet.encounter.originalInput}</dd>
            <dt>Input type</dt>
            <dd>{packet.encounter.inputType}</dd>
            <dt>Primary domain</dt>
            <dd>{packet.encounter.primaryDomain}</dd>
            <dt>Source type</dt>
            <dd>{packet.encounter.sourceType}</dd>
            <dt>Source language</dt>
            <dd>{packet.encounter.sourceLanguage}</dd>
            {packet.encounter.contextDescription && (
              <>
                <dt>Context</dt>
                <dd>{packet.encounter.contextDescription}</dd>
              </>
            )}
            {packet.encounter.sourceName && (
              <>
                <dt>Source name</dt>
                <dd>{packet.encounter.sourceName}</dd>
              </>
            )}
            {packet.encounter.sourceLocation && (
              <>
                <dt>Source location</dt>
                <dd>{packet.encounter.sourceLocation}</dd>
              </>
            )}
          </dl>

          <h3>Knowledge Items ({packet.knowledgeItems.length})</h3>
          <ol className="knowledge-items">
            {packet.knowledgeItems.map((item, index) => (
              <li key={`${item.type}-${item.expression}-${index}`}>
                <strong>{item.expression}</strong> <small>{item.type}</small>
                <dl>
                  <dt>Current meaning</dt>
                  <dd>{item.currentMeaning}</dd>
                  <dt>Core concept</dt>
                  <dd>{item.coreConcept}</dd>
                </dl>
              </li>
            ))}
          </ol>

          <h3>Summary</h3>
          <dl>
            <dt>Comparisons</dt>
            <dd>{packet.comparisons ? "Yes" : "No"}</dd>
            <dt>Sentence analysis</dt>
            <dd>{packet.sentenceAnalysis ? "Yes" : "No"}</dd>
            <dt>Learning priority</dt>
            <dd>{packet.learningAdvice.priority}</dd>
            <dt>Should save</dt>
            <dd>{packet.learningAdvice.shouldSave ? "Yes" : "No"}</dd>
          </dl>

          <details>
            <summary>Technical details</summary>
            <dl>
              <dt>Source packet ID</dt>
              <dd><code>{packet.packetId}</code></dd>
              <dt>Raw SHA-256</dt>
              <dd><code>{candidate.rawSha256}</code></dd>
              <dt>Content SHA-256</dt>
              <dd><code>{candidate.contentSha256}</code></dd>
            </dl>
          </details>
        </section>
      )}

      {result && !result.success && (
        <section className="result invalid" aria-live="polite">
          <h2>{result.stage === "identity" ? "Identity error" : "Validation errors"}</h2>
          <ul>
            {result.errors.map((error, index) => (
              <li key={`${error.pointer}-${error.keyword}-${index}`}>
                <code>{error.pointer}</code> [{error.keyword}] {error.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
