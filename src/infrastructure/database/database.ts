import Dexie, { type EntityTable } from "dexie";

import type {
  EncounterRecord,
  KnowledgeItemRecord,
  PacketRecord,
} from "./records";

export class ContextEnglishDatabase extends Dexie {
  packets!: EntityTable<PacketRecord, "id">;
  encounters!: EntityTable<EncounterRecord, "id">;
  knowledgeItems!: EntityTable<KnowledgeItemRecord, "id">;

  constructor(databaseName = "context-english") {
    super(databaseName);

    this.version(1).stores({
      packets: "id, sourcePacketId, contentSha256, importedAt",
      encounters: "id, packetId, primaryDomain, encounteredAt",
      knowledgeItems:
        "id, packetId, encounterId, normalizedExpression, normalizedLemma",
    });
  }
}

export const contextEnglishDatabase = new ContextEnglishDatabase();
