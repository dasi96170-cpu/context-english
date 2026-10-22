import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import appleBasic from "../../tests/fixtures/learning-packets/apple-basic.json";
import chineseEquipment from "../../tests/fixtures/learning-packets/chinese-equipment.json";
import pieceOfCake from "../../tests/fixtures/learning-packets/piece-of-cake.json";
import type { ImportCandidate } from "../domain/importCandidate";
import { ContextEnglishDatabase } from "../infrastructure/database/database";
import { inspectLearningPacketImport } from "./inspectLearningPacketImport";
import { prepareLearningPacketImport } from "./prepareLearningPacketImport";
import {
  ExactDuplicateImportError,
  SourcePacketIdConflictError,
  saveLearningPacketImport,
} from "./saveLearningPacketImport";

const importedAt = "2026-10-22T12:00:00.000Z";

async function candidateFrom(value: unknown): Promise<ImportCandidate> {
  const result = await prepareLearningPacketImport(JSON.stringify(value, null, 2));
  expect(result.success).toBe(true);
  if (!result.success) throw new Error("Expected a valid ImportCandidate.");
  return result.candidate;
}

function idSequence(ids: string[]): () => string {
  let index = 0;
  return () => ids[index++] ?? `unexpected-id-${index}`;
}

function databaseName(label: string): string {
  return `context-english-test-${label}-${crypto.randomUUID()}`;
}

describe("saveLearningPacketImport", () => {
  it("atomically persists a packet, encounter, and all knowledge items", async () => {
    const database = new ContextEnglishDatabase(databaseName("success"));
    const candidate = await candidateFrom(chineseEquipment);
    const sourceBeforeSave = structuredClone(candidate.sourceDocument);
    const ids = [
      "packet-id",
      "encounter-id",
      "knowledge-id-0",
      "knowledge-id-1",
      "knowledge-id-2",
      "knowledge-id-3",
    ];

    try {
      const saved = await saveLearningPacketImport(
        candidate,
        {},
        {
          database,
          now: () => importedAt,
          randomUUID: idSequence(ids),
        },
      );

      expect(saved).toEqual({
        packetId: "packet-id",
        encounterId: "encounter-id",
        knowledgeItemIds: ids.slice(2),
      });

      const packet = await database.packets.get("packet-id");
      const encounter = await database.encounters.get("encounter-id");
      const knowledgeItems = await database.knowledgeItems
        .where("packetId")
        .equals("packet-id")
        .sortBy("sourcePointer");

      expect(await database.packets.count()).toBe(1);
      expect(await database.encounters.count()).toBe(1);
      expect(knowledgeItems).toHaveLength(chineseEquipment.knowledgeItems.length);
      expect(packet).toMatchObject({
        sourcePacketId: chineseEquipment.packetId,
        importedAt,
        rawJson: candidate.rawJson,
        rawSha256: candidate.rawSha256,
        contentSha256: candidate.contentSha256,
        sourceDocument: candidate.sourceDocument,
      });
      expect(encounter).toMatchObject({
        packetId: "packet-id",
        sourcePointer: "/encounter",
        sourceData: candidate.sourceDocument.encounter,
      });
      expect(knowledgeItems.map((item) => item.sourcePointer)).toEqual([
        "/knowledgeItems/0",
        "/knowledgeItems/1",
        "/knowledgeItems/2",
        "/knowledgeItems/3",
      ]);
      expect(
        knowledgeItems.every(
          (item) =>
            item.packetId === "packet-id" && item.encounterId === "encounter-id",
        ),
      ).toBe(true);
      expect(candidate.sourceDocument).toEqual(sourceBeforeSave);
    } finally {
      await database.delete();
    }
  });

  it("rolls back every table when a knowledge item write fails", async () => {
    const database = new ContextEnglishDatabase(databaseName("rollback"));
    const candidate = await candidateFrom(chineseEquipment);
    const duplicateKnowledgeItemIds = idSequence([
      "packet-id",
      "encounter-id",
      "duplicate-knowledge-id",
      "duplicate-knowledge-id",
      "knowledge-id-2",
      "knowledge-id-3",
    ]);

    try {
      await expect(
        saveLearningPacketImport(
          candidate,
          {},
          {
            database,
            now: () => importedAt,
            randomUUID: duplicateKnowledgeItemIds,
          },
        ),
      ).rejects.toThrow();

      expect(await database.packets.count()).toBe(0);
      expect(await database.encounters.count()).toBe(0);
      expect(await database.knowledgeItems.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });

  it("does not invent normalizedLemma when the source lemma is absent", async () => {
    const database = new ContextEnglishDatabase(databaseName("lemma"));
    const candidate = await candidateFrom(pieceOfCake);

    try {
      await saveLearningPacketImport(
        candidate,
        {},
        {
          database,
          now: () => importedAt,
          randomUUID: idSequence(["packet-id", "encounter-id", "knowledge-id"]),
        },
      );

      const knowledgeItem = await database.knowledgeItems.get("knowledge-id");
      expect(knowledgeItem).not.toHaveProperty("normalizedLemma");
    } finally {
      await database.delete();
    }
  });

  it("retains records after the database is closed and reopened", async () => {
    const name = databaseName("reopen");
    const firstConnection = new ContextEnglishDatabase(name);
    const candidate = await candidateFrom(chineseEquipment);

    await saveLearningPacketImport(
      candidate,
      {},
      {
        database: firstConnection,
        now: () => importedAt,
        randomUUID: idSequence([
          "packet-id",
          "encounter-id",
          "knowledge-id-0",
          "knowledge-id-1",
          "knowledge-id-2",
          "knowledge-id-3",
        ]),
      },
    );
    firstConnection.close();

    const reopenedConnection = new ContextEnglishDatabase(name);
    try {
      expect(await reopenedConnection.packets.count()).toBe(1);
      expect(await reopenedConnection.encounters.count()).toBe(1);
      expect(await reopenedConnection.knowledgeItems.count()).toBe(4);
    } finally {
      await reopenedConnection.delete();
    }
  });

  it("rejects a second save of the same content without adding records", async () => {
    const database = new ContextEnglishDatabase(databaseName("exact-duplicate"));
    const candidate = await candidateFrom(appleBasic);

    try {
      await saveLearningPacketImport(
        candidate,
        {},
        {
          database,
          now: () => importedAt,
          randomUUID: idSequence(["packet-1", "encounter-1", "knowledge-1"]),
        },
      );

      await expect(
        saveLearningPacketImport(
          candidate,
          {},
          {
            database,
            now: () => importedAt,
            randomUUID: idSequence(["packet-2", "encounter-2", "knowledge-2"]),
          },
        ),
      ).rejects.toBeInstanceOf(ExactDuplicateImportError);

      expect(await database.packets.count()).toBe(1);
      expect(await database.encounters.count()).toBe(1);
      expect(await database.knowledgeItems.count()).toBe(1);
    } finally {
      await database.delete();
    }
  });

  it("rejects different content with the same source Packet ID by default", async () => {
    const database = new ContextEnglishDatabase(databaseName("source-deny"));
    const originalCandidate = await candidateFrom(appleBasic);
    const changedPacket = structuredClone(appleBasic);
    changedPacket.encounter.originalInput = "green apple";
    const changedCandidate = await candidateFrom(changedPacket);

    try {
      await saveLearningPacketImport(
        originalCandidate,
        {},
        {
          database,
          now: () => importedAt,
          randomUUID: idSequence(["packet-1", "encounter-1", "knowledge-1"]),
        },
      );

      await expect(
        saveLearningPacketImport(
          changedCandidate,
          {},
          {
            database,
            now: () => importedAt,
            randomUUID: idSequence(["packet-2", "encounter-2", "knowledge-2"]),
          },
        ),
      ).rejects.toBeInstanceOf(SourcePacketIdConflictError);

      expect(await database.packets.count()).toBe(1);
      expect(await database.encounters.count()).toBe(1);
      expect(await database.knowledgeItems.count()).toBe(1);
    } finally {
      await database.delete();
    }
  });

  it("allows an explicitly confirmed source Packet ID conflict without overwriting", async () => {
    const database = new ContextEnglishDatabase(databaseName("source-allow"));
    const originalCandidate = await candidateFrom(appleBasic);
    const changedPacket = structuredClone(appleBasic);
    changedPacket.encounter.originalInput = "green apple";
    const changedCandidate = await candidateFrom(changedPacket);

    try {
      await saveLearningPacketImport(
        originalCandidate,
        {},
        {
          database,
          now: () => importedAt,
          randomUUID: idSequence(["packet-1", "encounter-1", "knowledge-1"]),
        },
      );
      const originalRecord = await database.packets.get("packet-1");

      await saveLearningPacketImport(
        changedCandidate,
        { allowSourcePacketIdConflict: true },
        {
          database,
          now: () => "2026-10-22T13:00:00.000Z",
          randomUUID: idSequence(["packet-2", "encounter-2", "knowledge-2"]),
        },
      );

      expect(await database.packets.count()).toBe(2);
      expect(await database.packets.get("packet-1")).toEqual(originalRecord);
      expect(await database.packets.get("packet-2")).toMatchObject({
        sourcePacketId: originalCandidate.sourceDocument.packetId,
        contentSha256: changedCandidate.contentSha256,
      });
    } finally {
      await database.delete();
    }
  });

  it("allows expression overlap across different Packets", async () => {
    const database = new ContextEnglishDatabase(databaseName("expression-overlap"));
    const firstCandidate = await candidateFrom(appleBasic);
    const anotherPacket = structuredClone(appleBasic);
    anotherPacket.packetId = "cep_apple_another_encounter_001";
    const secondCandidate = await candidateFrom(anotherPacket);

    try {
      await saveLearningPacketImport(
        firstCandidate,
        {},
        {
          database,
          now: () => importedAt,
          randomUUID: idSequence(["packet-1", "encounter-1", "knowledge-1"]),
        },
      );
      await saveLearningPacketImport(
        secondCandidate,
        {},
        {
          database,
          now: () => importedAt,
          randomUUID: idSequence(["packet-2", "encounter-2", "knowledge-2"]),
        },
      );

      expect(await database.packets.count()).toBe(2);
      expect(await database.encounters.count()).toBe(2);
      expect(await database.knowledgeItems.count()).toBe(2);
    } finally {
      await database.delete();
    }
  });

  it("blocks a stale inspected candidate when another save imported it first", async () => {
    const database = new ContextEnglishDatabase(databaseName("stale-inspection"));
    const candidate = await candidateFrom(appleBasic);

    try {
      expect(await inspectLearningPacketImport(candidate, database)).toEqual({
        sourcePacketIdConflicts: [],
        expressionMatches: [],
      });

      await saveLearningPacketImport(
        candidate,
        {},
        {
          database,
          now: () => importedAt,
          randomUUID: idSequence(["packet-1", "encounter-1", "knowledge-1"]),
        },
      );

      await expect(
        saveLearningPacketImport(
          candidate,
          {},
          {
            database,
            now: () => importedAt,
            randomUUID: idSequence(["packet-2", "encounter-2", "knowledge-2"]),
          },
        ),
      ).rejects.toBeInstanceOf(ExactDuplicateImportError);
      expect(await database.packets.count()).toBe(1);
    } finally {
      await database.delete();
    }
  });
});
