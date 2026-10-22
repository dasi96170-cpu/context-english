import type { ImportConflictReport } from "../domain/importConflictReport";
import type { ImportCandidate } from "../domain/importCandidate";
import { normalizeExpression } from "../domain/normalizeExpression";
import {
  contextEnglishDatabase,
  type ContextEnglishDatabase,
} from "../infrastructure/database/database";
import type { PacketRecord } from "../infrastructure/database/records";

function packetConflict(record: PacketRecord) {
  return {
    existingPacketId: record.id,
    sourcePacketId: record.sourcePacketId,
    contentSha256: record.contentSha256,
  };
}

export async function inspectLearningPacketImport(
  candidate: ImportCandidate,
  database: ContextEnglishDatabase = contextEnglishDatabase,
): Promise<ImportConflictReport> {
  const sourcePacketId = candidate.sourceDocument.packetId;
  const expressions = new Map<string, string>();

  for (const item of candidate.sourceDocument.knowledgeItems) {
    const normalizedExpression = normalizeExpression(item.expression);
    if (!expressions.has(normalizedExpression)) {
      expressions.set(normalizedExpression, item.expression);
    }
  }

  const [exactDuplicate, packetsWithSourceId, expressionMatches] = await Promise.all([
    database.packets.where("contentSha256").equals(candidate.contentSha256).first(),
    database.packets.where("sourcePacketId").equals(sourcePacketId).toArray(),
    Promise.all(
      Array.from(expressions, async ([normalizedExpression, expression]) => ({
        normalizedExpression,
        expression,
        existingMatchCount: await database.knowledgeItems
          .where("normalizedExpression")
          .equals(normalizedExpression)
          .count(),
      })),
    ),
  ]);

  return {
    ...(exactDuplicate ? { exactDuplicate: packetConflict(exactDuplicate) } : {}),
    sourcePacketIdConflicts: packetsWithSourceId
      .filter((packet) => packet.contentSha256 !== candidate.contentSha256)
      .map(packetConflict),
    expressionMatches: expressionMatches.filter(
      (match) => match.existingMatchCount > 0,
    ),
  };
}
