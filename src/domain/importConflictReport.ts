export interface ExistingPacketConflict {
  existingPacketId: string;
  sourcePacketId: string;
  contentSha256: string;
}

export interface ExpressionMatch {
  normalizedExpression: string;
  expression: string;
  existingMatchCount: number;
}

export interface ImportConflictReport {
  exactDuplicate?: ExistingPacketConflict;
  sourcePacketIdConflicts: ExistingPacketConflict[];
  expressionMatches: ExpressionMatch[];
}
