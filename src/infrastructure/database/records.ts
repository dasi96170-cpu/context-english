import type {
  CeLearningPacketEncounterV1,
  CeLearningPacketKnowledgeItemV1,
  CeLearningPacketV1,
} from "../../domain/ceLearningPacketV1";

export interface PacketRecord {
  id: string;
  sourcePacketId: string;
  schemaVersion: "1.0";
  importedAt: string;
  generatedAt?: string;
  rawJson: string;
  rawSha256: string;
  contentSha256: string;
  sourceDocument: CeLearningPacketV1;
}

export interface EncounterRecord {
  id: string;
  packetId: string;
  sourcePointer: "/encounter";
  originalInput: string;
  inputType: string;
  primaryDomain: string;
  sourceType: string;
  sourceLanguage: string;
  contextDescription?: string;
  subdomains?: string[];
  sourceName?: string;
  sourceLocation?: string;
  encounteredAt?: string;
  sourceImageReference?: string;
  sourceData: CeLearningPacketEncounterV1;
}

export interface KnowledgeItemRecord {
  id: string;
  packetId: string;
  encounterId: string;
  sourcePointer: string;
  type: string;
  expression: string;
  normalizedExpression: string;
  normalizedLemma?: string;
  currentMeaning: string;
  coreConcept: string;
  sourceData: CeLearningPacketKnowledgeItemV1;
}
