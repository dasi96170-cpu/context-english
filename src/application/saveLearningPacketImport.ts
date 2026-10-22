import type { ImportCandidate } from "../domain/importCandidate";
import type { ExistingPacketConflict } from "../domain/importConflictReport";
import { normalizeExpression } from "../domain/normalizeExpression";
import {
  contextEnglishDatabase,
  type ContextEnglishDatabase,
} from "../infrastructure/database/database";
import type {
  EncounterRecord,
  KnowledgeItemRecord,
  PacketRecord,
} from "../infrastructure/database/records";

export interface SavedLearningPacketImport {
  packetId: string;
  encounterId: string;
  knowledgeItemIds: string[];
}

export interface SaveLearningPacketImportDependencies {
  database?: ContextEnglishDatabase;
  now?: () => string;
  randomUUID?: () => string;
}

export interface SaveLearningPacketImportOptions {
  allowSourcePacketIdConflict?: boolean;
}

export class ExactDuplicateImportError extends Error {
  constructor(public readonly existingPacket: ExistingPacketConflict) {
    super(`Packet content has already been imported as ${existingPacket.existingPacketId}.`);
    this.name = "ExactDuplicateImportError";
  }
}

export class SourcePacketIdConflictError extends Error {
  constructor(public readonly existingPackets: ExistingPacketConflict[]) {
    super("The source packet ID already exists with different content.");
    this.name = "SourcePacketIdConflictError";
  }
}

export async function saveLearningPacketImport(
  candidate: ImportCandidate,
  options: SaveLearningPacketImportOptions = {},
  dependencies: SaveLearningPacketImportDependencies = {},
): Promise<SavedLearningPacketImport> {
  const database = dependencies.database ?? contextEnglishDatabase;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID());
  const sourceDocument = candidate.sourceDocument;
  const sourceEncounter = sourceDocument.encounter;

  const packetId = randomUUID();
  const encounterId = randomUUID();
  const knowledgeItemIds = sourceDocument.knowledgeItems.map(() => randomUUID());

  const packetRecord: PacketRecord = {
    id: packetId,
    sourcePacketId: sourceDocument.packetId,
    schemaVersion: sourceDocument.schemaVersion,
    importedAt: now(),
    ...(sourceDocument.generatedAt
      ? { generatedAt: sourceDocument.generatedAt }
      : {}),
    rawJson: candidate.rawJson,
    rawSha256: candidate.rawSha256,
    contentSha256: candidate.contentSha256,
    sourceDocument,
  };

  const encounterRecord: EncounterRecord = {
    id: encounterId,
    packetId,
    sourcePointer: "/encounter",
    originalInput: sourceEncounter.originalInput,
    inputType: sourceEncounter.inputType,
    primaryDomain: sourceEncounter.primaryDomain,
    sourceType: sourceEncounter.sourceType,
    sourceLanguage: sourceEncounter.sourceLanguage,
    ...(sourceEncounter.contextDescription
      ? { contextDescription: sourceEncounter.contextDescription }
      : {}),
    ...(sourceEncounter.subdomains ? { subdomains: sourceEncounter.subdomains } : {}),
    ...(sourceEncounter.sourceName ? { sourceName: sourceEncounter.sourceName } : {}),
    ...(sourceEncounter.sourceLocation
      ? { sourceLocation: sourceEncounter.sourceLocation }
      : {}),
    ...(sourceEncounter.encounteredAt
      ? { encounteredAt: sourceEncounter.encounteredAt }
      : {}),
    ...(sourceEncounter.imageReference
      ? { sourceImageReference: sourceEncounter.imageReference }
      : {}),
    sourceData: sourceEncounter,
  };

  const knowledgeItemRecords: KnowledgeItemRecord[] =
    sourceDocument.knowledgeItems.map((sourceData, index) => ({
      id: knowledgeItemIds[index]!,
      packetId,
      encounterId,
      sourcePointer: `/knowledgeItems/${index}`,
      type: sourceData.type,
      expression: sourceData.expression,
      normalizedExpression: normalizeExpression(sourceData.expression),
      ...(sourceData.lemma
        ? { normalizedLemma: normalizeExpression(sourceData.lemma) }
        : {}),
      currentMeaning: sourceData.currentMeaning,
      coreConcept: sourceData.coreConcept,
      sourceData,
    }));

  await database.transaction(
    "rw",
    database.packets,
    database.encounters,
    database.knowledgeItems,
    async () => {
      const exactDuplicate = await database.packets
        .where("contentSha256")
        .equals(candidate.contentSha256)
        .first();

      if (exactDuplicate) {
        throw new ExactDuplicateImportError({
          existingPacketId: exactDuplicate.id,
          sourcePacketId: exactDuplicate.sourcePacketId,
          contentSha256: exactDuplicate.contentSha256,
        });
      }

      const sourcePacketIdConflicts = await database.packets
        .where("sourcePacketId")
        .equals(sourceDocument.packetId)
        .filter((packet) => packet.contentSha256 !== candidate.contentSha256)
        .toArray();

      if (
        sourcePacketIdConflicts.length > 0 &&
        !options.allowSourcePacketIdConflict
      ) {
        throw new SourcePacketIdConflictError(
          sourcePacketIdConflicts.map((packet) => ({
            existingPacketId: packet.id,
            sourcePacketId: packet.sourcePacketId,
            contentSha256: packet.contentSha256,
          })),
        );
      }

      await database.packets.add(packetRecord);
      await database.encounters.add(encounterRecord);
      await database.knowledgeItems.bulkAdd(knowledgeItemRecords);
    },
  );

  return {
    packetId,
    encounterId,
    knowledgeItemIds,
  };
}
