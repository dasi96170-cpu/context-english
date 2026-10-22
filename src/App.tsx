import { useState } from "react";

import type { LearningPacketValidationResult } from "./validation/validateLearningPacket";
import { parseAndValidateLearningPacket } from "./validation/validateLearningPacket";

export function App() {
  const [jsonText, setJsonText] = useState("");
  const [result, setResult] = useState<LearningPacketValidationResult | null>(null);

  function validateInput() {
    setResult(parseAndValidateLearningPacket(jsonText));
  }

  return (
    <main className="app-shell">
      <h1>Context English</h1>
      <p>貼上 CE Learning Packet v1 JSON，使用正式 Schema 進行瀏覽器驗證。</p>

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

      <button type="button" onClick={validateInput}>
        Validate
      </button>

      {result?.valid && (
        <section className="result valid" aria-live="polite">
          <h2>Valid</h2>
          <p>
            Packet <code>{result.packet.packetId}</code> contains{" "}
            {result.packet.knowledgeItems.length} knowledge item(s).
          </p>
        </section>
      )}

      {result && !result.valid && (
        <section className="result invalid" aria-live="polite">
          <h2>Validation errors</h2>
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
