import { useState } from "react";

import {
  inspectLearningPacketImport,
} from "./application/inspectLearningPacketImport";
import {
  prepareLearningPacketImport,
  type PrepareLearningPacketImportResult,
} from "./application/prepareLearningPacketImport";
import {
  ExactDuplicateImportError,
  SourcePacketIdConflictError,
  saveLearningPacketImport,
  type SavedLearningPacketImport,
} from "./application/saveLearningPacketImport";
import type { ImportConflictReport } from "./domain/importConflictReport";

export function App() {
  const [jsonText, setJsonText] = useState("");
  const [result, setResult] = useState<PrepareLearningPacketImportResult | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedLearningPacketImport | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictReport, setConflictReport] = useState<ImportConflictReport | null>(
    null,
  );
  const [inspecting, setInspecting] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [allowSourcePacketIdConflict, setAllowSourcePacketIdConflict] =
    useState(false);

  async function prepareImport() {
    setPreparing(true);
    setSaved(null);
    setSaveError(null);
    setConflictReport(null);
    setInspectionError(null);
    setAllowSourcePacketIdConflict(false);

    const prepared = await prepareLearningPacketImport(jsonText);
    setResult(prepared);

    if (prepared.success) {
      setInspecting(true);
      try {
        setConflictReport(await inspectLearningPacketImport(prepared.candidate));
      } catch (error) {
        setInspectionError(
          error instanceof Error ? error.message : "Unable to inspect local conflicts.",
        );
      } finally {
        setInspecting(false);
      }
    }

    setPreparing(false);
  }

  async function saveImport() {
    if (
      !candidate ||
      !conflictReport ||
      conflictReport.exactDuplicate ||
      (conflictReport.sourcePacketIdConflicts.length > 0 &&
        !allowSourcePacketIdConflict) ||
      saving ||
      saved
    ) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      setSaved(
        await saveLearningPacketImport(candidate, {
          allowSourcePacketIdConflict,
        }),
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save locally.");
      if (
        error instanceof ExactDuplicateImportError ||
        error instanceof SourcePacketIdConflictError
      ) {
        try {
          setConflictReport(await inspectLearningPacketImport(candidate));
          setAllowSourcePacketIdConflict(false);
        } catch (inspectionFailure) {
          setInspectionError(
            inspectionFailure instanceof Error
              ? inspectionFailure.message
              : "Unable to refresh local conflicts.",
          );
        }
      }
    } finally {
      setSaving(false);
    }
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
          setSaved(null);
          setSaveError(null);
          setConflictReport(null);
          setInspectionError(null);
          setAllowSourcePacketIdConflict(false);
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

          <h3>Local conflict check</h3>
          {inspecting && <p>Checking local data…</p>}
          {inspectionError && (
            <p className="save-error" role="alert">{inspectionError}</p>
          )}

          {conflictReport?.exactDuplicate && (
            <div className="conflict conflict-blocking" role="alert">
              <strong>This packet has already been imported.</strong>
              <dl>
                <dt>Existing Packet ID</dt>
                <dd><code>{conflictReport.exactDuplicate.existingPacketId}</code></dd>
                <dt>Source Packet ID</dt>
                <dd><code>{conflictReport.exactDuplicate.sourcePacketId}</code></dd>
              </dl>
            </div>
          )}

          {conflictReport && conflictReport.sourcePacketIdConflicts.length > 0 && (
            <div className="conflict conflict-warning">
              <strong>
                The same source packet ID already exists with different content.
              </strong>
              <p>
                Found {conflictReport.sourcePacketIdConflicts.length} existing local
                packet(s).
              </p>
              <ul>
                {conflictReport.sourcePacketIdConflicts.map((conflict) => (
                  <li key={conflict.existingPacketId}>
                    <code>{conflict.existingPacketId}</code> —{" "}
                    <code>{conflict.contentSha256}</code>
                  </li>
                ))}
              </ul>
              <label className="conflict-confirmation">
                <input
                  type="checkbox"
                  checked={allowSourcePacketIdConflict}
                  onChange={(event) =>
                    setAllowSourcePacketIdConflict(event.target.checked)
                  }
                />
                I understand this source packet ID already exists with different
                content and want to save this as a separate local packet.
              </label>
            </div>
          )}

          {conflictReport && conflictReport.expressionMatches.length > 0 && (
            <div className="conflict conflict-info">
              <strong>Existing knowledge items use the same expression:</strong>
              <ul>
                {conflictReport.expressionMatches.map((match) => (
                  <li key={match.normalizedExpression}>
                    {match.expression} ({match.existingMatchCount})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conflictReport &&
            !conflictReport.exactDuplicate &&
            conflictReport.sourcePacketIdConflicts.length === 0 &&
            conflictReport.expressionMatches.length === 0 && (
              <p>No local conflicts found.</p>
            )}

          <div className="save-actions">
            <button
              type="button"
              onClick={() => void saveImport()}
              disabled={
                saving ||
                saved !== null ||
                inspecting ||
                conflictReport === null ||
                inspectionError !== null ||
                conflictReport?.exactDuplicate !== undefined ||
                (conflictReport.sourcePacketIdConflicts.length > 0 &&
                  !allowSourcePacketIdConflict)
              }
            >
              {saving ? "Saving…" : saved ? "Saved" : "Save to Library"}
            </button>
          </div>

          {saved && (
            <div className="save-status" role="status">
              <strong>Saved locally</strong>
              <dl>
                <dt>Packet internal ID</dt>
                <dd><code>{saved.packetId}</code></dd>
                <dt>Encounter ID</dt>
                <dd><code>{saved.encounterId}</code></dd>
                <dt>Knowledge Items</dt>
                <dd>{saved.knowledgeItemIds.length}</dd>
              </dl>
            </div>
          )}

          {saveError && <p className="save-error" role="alert">{saveError}</p>}
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
