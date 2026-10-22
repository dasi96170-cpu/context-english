import { canonicalize } from "json-canonicalize";

import type { ImportCandidate } from "../domain/importCandidate";
import { sha256Utf8 } from "../infrastructure/sha256";
import {
  parseAndValidateLearningPacket,
  type ValidationIssue,
} from "../validation/validateLearningPacket";

export type PrepareLearningPacketImportResult =
  | {
      success: true;
      candidate: ImportCandidate;
    }
  | {
      success: false;
      stage: "parse" | "schema" | "identity";
      errors: ValidationIssue[];
    };

export async function prepareLearningPacketImport(
  rawJson: string,
): Promise<PrepareLearningPacketImportResult> {
  const validation = parseAndValidateLearningPacket(rawJson);

  if (!validation.valid) {
    return {
      success: false,
      stage: validation.stage,
      errors: validation.errors,
    };
  }

  try {
    const canonicalJson = canonicalize(validation.packet);
    const [rawSha256, contentSha256] = await Promise.all([
      sha256Utf8(rawJson),
      sha256Utf8(canonicalJson),
    ]);

    return {
      success: true,
      candidate: {
        rawJson,
        sourceDocument: validation.packet,
        rawSha256,
        contentSha256,
      },
    };
  } catch (error) {
    return {
      success: false,
      stage: "identity",
      errors: [
        {
          pointer: "/",
          keyword: "canonicalization",
          message:
            error instanceof Error
              ? error.message
              : "Unable to canonicalize the source document.",
        },
      ],
    };
  }
}
