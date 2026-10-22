import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import appleBasic from "../../tests/fixtures/learning-packets/apple-basic.json";
import lookSeeWatch from "../../tests/fixtures/learning-packets/look-see-watch.json";
import type { ImportCandidate } from "../domain/importCandidate";
import { ContextEnglishDatabase } from "../infrastructure/database/database";
import { inspectLearningPacketImport } from "./inspectLearningPacketImport";
import { prepareLearningPacketImport } from "./prepareLearningPacketImport";
import { saveLearningPacketImport } from "./saveLearningPacketImport";

async function candidateFrom(value: unknown): Promise<ImportCandidate> {
  const result = await prepareLearningPacketImport(JSON.stringify(value));
  expect(result.success).toBe(true);
  if (!result.success) throw new Error("Expected a valid ImportCandidate.");
  return result.candidate;
}

function databaseName(label: string): string {
  return `context-english-inspect-${label}-${crypto.randomUUID()}`;
}

function idSequence(prefix: string): () => string {
  let index = 0;
  return () => `${prefix}-${index++}`;
}

async function saveCandidate(
  candidate: ImportCandidate,
  database: ContextEnglishDatabase,
  prefix: string,
): Promise<void> {
  await saveLearningPacketImport(
    candidate,
    {},
    {
      database,
      now: () => "2026-10-22T12:00:00.000Z",
      randomUUID: idSequence(prefix),
    },
  );
}

describe("inspectLearningPacketImport", () => {
  it("reports no conflicts for an empty database", async () => {
    const database = new ContextEnglishDatabase(databaseName("empty"));
    const candidate = await candidateFrom(appleBasic);

    try {
      expect(await inspectLearningPacketImport(candidate, database)).toEqual({
        sourcePacketIdConflicts: [],
        expressionMatches: [],
      });
    } finally {
      await database.delete();
    }
  });

  it("detects an exact content duplicate with its internal Packet ID", async () => {
    const database = new ContextEnglishDatabase(databaseName("exact"));
    const candidate = await candidateFrom(appleBasic);

    try {
      await saveCandidate(candidate, database, "existing");
      const report = await inspectLearningPacketImport(candidate, database);

      expect(report.exactDuplicate).toEqual({
        existingPacketId: "existing-0",
        sourcePacketId: candidate.sourceDocument.packetId,
        contentSha256: candidate.contentSha256,
      });
      expect(report.sourcePacketIdConflicts).toEqual([]);
    } finally {
      await database.delete();
    }
  });

  it("detects a source Packet ID conflict without calling it an exact duplicate", async () => {
    const database = new ContextEnglishDatabase(databaseName("source"));
    const existingCandidate = await candidateFrom(appleBasic);
    const changedPacket = structuredClone(appleBasic);
    changedPacket.encounter.originalInput = "green apple";
    const changedCandidate = await candidateFrom(changedPacket);

    try {
      await saveCandidate(existingCandidate, database, "existing");
      const report = await inspectLearningPacketImport(changedCandidate, database);

      expect(report.exactDuplicate).toBeUndefined();
      expect(report.sourcePacketIdConflicts).toEqual([
        {
          existingPacketId: "existing-0",
          sourcePacketId: existingCandidate.sourceDocument.packetId,
          contentSha256: existingCandidate.contentSha256,
        },
      ]);
    } finally {
      await database.delete();
    }
  });

  it("reports expression overlap without treating the Packet as a duplicate", async () => {
    const database = new ContextEnglishDatabase(databaseName("expression"));
    const existingCandidate = await candidateFrom(appleBasic);
    const anotherPacket = structuredClone(appleBasic);
    anotherPacket.packetId = "cep_apple_another_encounter_001";
    const anotherCandidate = await candidateFrom(anotherPacket);

    try {
      await saveCandidate(existingCandidate, database, "existing");
      const report = await inspectLearningPacketImport(anotherCandidate, database);

      expect(report.exactDuplicate).toBeUndefined();
      expect(report.sourcePacketIdConflicts).toEqual([]);
      expect(report.expressionMatches).toEqual([
        {
          normalizedExpression: "apple",
          expression: "apple",
          existingMatchCount: 1,
        },
      ]);
    } finally {
      await database.delete();
    }
  });

  it("deduplicates normalized expressions within the candidate", async () => {
    const database = new ContextEnglishDatabase(databaseName("candidate-expressions"));
    const existingCandidate = await candidateFrom(appleBasic);
    const packetWithRepeatedExpressions = structuredClone(lookSeeWatch);
    packetWithRepeatedExpressions.packetId = "cep_repeated_expression_001";
    packetWithRepeatedExpressions.knowledgeItems[0]!.expression = "Apple";
    packetWithRepeatedExpressions.knowledgeItems[1]!.expression = "  APPLE  ";
    const candidate = await candidateFrom(packetWithRepeatedExpressions);

    try {
      await saveCandidate(existingCandidate, database, "existing");
      const report = await inspectLearningPacketImport(candidate, database);

      expect(report.expressionMatches).toEqual([
        {
          normalizedExpression: "apple",
          expression: "Apple",
          existingMatchCount: 1,
        },
      ]);
    } finally {
      await database.delete();
    }
  });
});
