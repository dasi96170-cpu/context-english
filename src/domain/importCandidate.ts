import type { CeLearningPacketV1 } from "./ceLearningPacketV1";

/**
 * A validated source packet prepared for user review. It has not been saved.
 */
export interface ImportCandidate {
  rawJson: string;
  sourceDocument: CeLearningPacketV1;
  rawSha256: string;
  contentSha256: string;
}
