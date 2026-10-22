export type KnowledgeItemType =
  | "word"
  | "term"
  | "phrase"
  | "phrasalVerb"
  | "idiom"
  | "chunk"
  | "sentencePattern";

export interface CeLearningPacketEncounterV1 {
  originalInput: string;
  inputType: string;
  contextDescription?: string;
  primaryDomain: string;
  subdomains?: string[];
  sourceType: string;
  sourceLanguage: "en" | "zh-Hant" | "mixed" | "und";
  sourceName?: string;
  sourceLocation?: string;
  encounteredAt?: string;
  imageReference?: string;
}

export interface CeLearningPacketKnowledgeItemV1 {
  type: KnowledgeItemType;
  expression: string;
  lemma?: string;
  currentMeaning: string;
  coreConcept: string;
}

export interface CeLearningPacketAdviceV1 {
  shouldSave: boolean;
  priority: "mustLearn" | "recommended" | "recognitionOnly" | "notNow";
  reason: string;
  activeOrPassive: "active" | "passive" | "both" | "notApplicable";
  recommendedPractice: string[];
}

/**
 * Minimal validated view used by the P1.1A UI.
 * The repository JSON Schema remains the runtime source of truth.
 */
export interface CeLearningPacketV1 {
  schemaVersion: "1.0";
  packetId: string;
  generatedAt?: string;
  encounter: CeLearningPacketEncounterV1;
  knowledgeItems: CeLearningPacketKnowledgeItemV1[];
  comparisons?: unknown[];
  sentenceAnalysis?: Record<string, unknown>;
  learningAdvice: CeLearningPacketAdviceV1;
  extensions?: Record<string, unknown>;
}
