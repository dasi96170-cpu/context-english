import type { ErrorObject } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import learningPacketSchema from "../../schemas/ce-learning-packet-v1.schema.json";
import type { CeLearningPacketV1 } from "../domain/ceLearningPacketV1";

export interface ValidationIssue {
  pointer: string;
  keyword: string;
  message: string;
}

export type LearningPacketValidationResult =
  | {
      valid: true;
      packet: CeLearningPacketV1;
    }
  | {
      valid: false;
      stage: "parse" | "schema";
      errors: ValidationIssue[];
    };

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
});

addFormats(ajv);

const validateSchema = ajv.compile(learningPacketSchema);

function escapeJsonPointerToken(token: string): string {
  return token.replaceAll("~", "~0").replaceAll("/", "~1");
}

function pointerForError(error: ErrorObject): string {
  const basePointer = error.instancePath;

  if (error.keyword === "required") {
    const missingProperty = String(error.params.missingProperty);
    return `${basePointer}/${escapeJsonPointerToken(missingProperty)}`;
  }

  if (error.keyword === "additionalProperties") {
    const additionalProperty = String(error.params.additionalProperty);
    return `${basePointer}/${escapeJsonPointerToken(additionalProperty)}`;
  }

  return basePointer || "/";
}

function normalizeAjvErrors(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    pointer: pointerForError(error),
    keyword: error.keyword,
    message: error.message ?? "Schema validation failed.",
  }));
}

function hasSupportedSchemaVersion(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Reflect.get(value, "schemaVersion") === "1.0";
}

export function validateLearningPacket(value: unknown): LearningPacketValidationResult {
  const schemaVersionSupported = hasSupportedSchemaVersion(value);
  const schemaValid = validateSchema(value);

  if (schemaValid && schemaVersionSupported) {
    return {
      valid: true,
      packet: value as unknown as CeLearningPacketV1,
    };
  }

  const errors = normalizeAjvErrors(validateSchema.errors);

  if (!schemaVersionSupported && !errors.some((error) => error.pointer === "/schemaVersion")) {
    errors.unshift({
      pointer: "/schemaVersion",
      keyword: "schemaVersion",
      message: 'must be exactly "1.0"',
    });
  }

  return {
    valid: false,
    stage: "schema",
    errors,
  };
}

export function parseAndValidateLearningPacket(
  jsonText: string,
): LearningPacketValidationResult {
  let value: unknown;

  try {
    value = JSON.parse(jsonText);
  } catch (error) {
    return {
      valid: false,
      stage: "parse",
      errors: [
        {
          pointer: "/",
          keyword: "parse",
          message: error instanceof Error ? error.message : "Invalid JSON.",
        },
      ],
    };
  }

  return validateLearningPacket(value);
}
