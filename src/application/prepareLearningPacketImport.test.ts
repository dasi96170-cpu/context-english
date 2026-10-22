import { describe, expect, it } from "vitest";

import appleBasic from "../../tests/fixtures/learning-packets/apple-basic.json";
import { prepareLearningPacketImport } from "./prepareLearningPacketImport";

function reverseRootPropertyOrder(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).reverse());
}

describe("prepareLearningPacketImport", () => {
  const compactJson = JSON.stringify(appleBasic);
  const formattedJson = JSON.stringify(appleBasic, null, 2);
  const reorderedJson = JSON.stringify(
    reverseRootPropertyOrder(structuredClone(appleBasic)),
  );

  it("produces the same raw SHA-256 for identical source text", async () => {
    const first = await prepareLearningPacketImport(compactJson);
    const second = await prepareLearningPacketImport(compactJson);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    expect(first.candidate.rawSha256).toBe(second.candidate.rawSha256);
  });

  it("changes raw SHA-256 when only whitespace changes", async () => {
    const compact = await prepareLearningPacketImport(compactJson);
    const formatted = await prepareLearningPacketImport(formattedJson);

    expect(compact.success).toBe(true);
    expect(formatted.success).toBe(true);
    if (!compact.success || !formatted.success) return;

    expect(compact.candidate.rawSha256).not.toBe(formatted.candidate.rawSha256);
  });

  it("changes raw SHA-256 when only object property order changes", async () => {
    const original = await prepareLearningPacketImport(compactJson);
    const reordered = await prepareLearningPacketImport(reorderedJson);

    expect(original.success).toBe(true);
    expect(reordered.success).toBe(true);
    if (!original.success || !reordered.success) return;

    expect(original.candidate.rawSha256).not.toBe(reordered.candidate.rawSha256);
  });

  it("produces the same content SHA-256 for identical JSON", async () => {
    const first = await prepareLearningPacketImport(compactJson);
    const second = await prepareLearningPacketImport(compactJson);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    expect(first.candidate.contentSha256).toBe(second.candidate.contentSha256);
  });

  it("preserves content SHA-256 when only whitespace changes", async () => {
    const compact = await prepareLearningPacketImport(compactJson);
    const formatted = await prepareLearningPacketImport(formattedJson);

    expect(compact.success).toBe(true);
    expect(formatted.success).toBe(true);
    if (!compact.success || !formatted.success) return;

    expect(compact.candidate.contentSha256).toBe(formatted.candidate.contentSha256);
  });

  it("preserves content SHA-256 when only object property order changes", async () => {
    const original = await prepareLearningPacketImport(compactJson);
    const reordered = await prepareLearningPacketImport(reorderedJson);

    expect(original.success).toBe(true);
    expect(reordered.success).toBe(true);
    if (!original.success || !reordered.success) return;

    expect(original.candidate.contentSha256).toBe(reordered.candidate.contentSha256);
  });

  it("changes content SHA-256 when a field value changes", async () => {
    const changedPacket = structuredClone(appleBasic);
    changedPacket.encounter.originalInput = "green apple";

    const original = await prepareLearningPacketImport(compactJson);
    const changed = await prepareLearningPacketImport(JSON.stringify(changedPacket));

    expect(original.success).toBe(true);
    expect(changed.success).toBe(true);
    if (!original.success || !changed.success) return;

    expect(original.candidate.contentSha256).not.toBe(changed.candidate.contentSha256);
  });

  it("creates an ImportCandidate from a valid fixture", async () => {
    const result = await prepareLearningPacketImport(formattedJson);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.candidate.rawJson).toBe(formattedJson);
    expect(result.candidate.sourceDocument).toEqual(appleBasic);
    expect(result.candidate.sourceDocument.packetId).toBe(appleBasic.packetId);
    expect(result.candidate.sourceDocument.encounter.originalInput).toBe(
      appleBasic.encounter.originalInput,
    );
    expect(result.candidate.rawSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.candidate.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not create a candidate for a schema-invalid packet", async () => {
    const invalidPacket = structuredClone(appleBasic) as Record<string, unknown>;
    delete invalidPacket.schemaVersion;

    const result = await prepareLearningPacketImport(JSON.stringify(invalidPacket));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.stage).toBe("schema");
    expect(result).not.toHaveProperty("candidate");
  });

  it("does not create a candidate for a JSON parse error", async () => {
    const result = await prepareLearningPacketImport('{"schemaVersion":');

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.stage).toBe("parse");
    expect(result).not.toHaveProperty("candidate");
  });

  it("does not modify the validated source document during canonicalization", async () => {
    const expectedSourceDocument = JSON.parse(formattedJson) as unknown;
    const result = await prepareLearningPacketImport(formattedJson);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.candidate.sourceDocument).toEqual(expectedSourceDocument);
  });
});
