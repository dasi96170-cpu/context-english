import { describe, expect, it } from "vitest";

import appleBasic from "../../tests/fixtures/learning-packets/apple-basic.json";
import chineseEquipment from "../../tests/fixtures/learning-packets/chinese-equipment.json";
import engineeringSentence from "../../tests/fixtures/learning-packets/engineering-sentence.json";
import gxworks2Device from "../../tests/fixtures/learning-packets/gxworks2-device.json";
import hmiRecipe from "../../tests/fixtures/learning-packets/hmi-recipe.json";
import lookSeeWatch from "../../tests/fixtures/learning-packets/look-see-watch.json";
import openTheLight from "../../tests/fixtures/learning-packets/open-the-light.json";
import pieceOfCake from "../../tests/fixtures/learning-packets/piece-of-cake.json";
import {
  parseAndValidateLearningPacket,
  validateLearningPacket,
} from "./validateLearningPacket";

type MutablePacket = Record<string, any>;

const validFixtures = {
  "apple-basic.json": appleBasic,
  "chinese-equipment.json": chineseEquipment,
  "engineering-sentence.json": engineeringSentence,
  "gxworks2-device.json": gxworks2Device,
  "hmi-recipe.json": hmiRecipe,
  "look-see-watch.json": lookSeeWatch,
  "open-the-light.json": openTheLight,
  "piece-of-cake.json": pieceOfCake,
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function expectInvalid(packet: unknown): void {
  const result = validateLearningPacket(packet);
  expect(result.valid).toBe(false);
}

describe("CE Learning Packet v1 browser validation contract", () => {
  it.each(Object.entries(validFixtures))("accepts valid fixture %s", (_name, packet) => {
    expect(validateLearningPacket(packet).valid).toBe(true);
  });

  it("accepts repeated syllables", () => {
    const packet = clone(appleBasic) as MutablePacket;
    packet.packetId = "cep_banana_syllable_check_001";
    packet.encounter.originalInput = "banana";
    packet.knowledgeItems[0].expression = "banana";
    packet.knowledgeItems[0].lemma = "banana";
    packet.knowledgeItems[0].syllables = ["ba", "na", "na"];

    expect(validateLearningPacket(packet).valid).toBe(true);
  });

  it("accepts a packet with extensions omitted", () => {
    const packet = clone(pieceOfCake) as MutablePacket;
    delete packet.extensions;

    expect(validateLearningPacket(packet).valid).toBe(true);
  });

  it("accepts a packet with a non-empty namespaced extension", () => {
    const packet = clone(pieceOfCake) as MutablePacket;
    packet.extensions = {
      "contextEnglish.reviewSeeds.v1": { example: true },
    };

    expect(validateLearningPacket(packet).valid).toBe(true);
  });

  const invalidCases: Array<[string, () => MutablePacket]> = [
    [
      "missing schemaVersion",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        delete packet.schemaVersion;
        return packet;
      },
    ],
    [
      "wrong schemaVersion",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        packet.schemaVersion = "2.0";
        return packet;
      },
    ],
    [
      "empty knowledgeItems",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        packet.knowledgeItems = [];
        return packet;
      },
    ],
    [
      "Knowledge Item missing expression",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        delete packet.knowledgeItems[0].expression;
        return packet;
      },
    ],
    [
      "illegal Knowledge Item type",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        packet.knowledgeItems[0].type = "concept";
        return packet;
      },
    ],
    [
      "illegal primaryDomain",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        packet.encounter.primaryDomain = "health";
        return packet;
      },
    ],
    [
      "illegal sourceLanguage",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        packet.encounter.sourceLanguage = "fr";
        return packet;
      },
    ],
    [
      "empty usage object",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        packet.knowledgeItems[0].usage = {};
        return packet;
      },
    ],
    [
      "empty extensions object",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        packet.extensions = {};
        return packet;
      },
    ],
    [
      "comparison with fewer than two terms",
      () => {
        const packet = clone(chineseEquipment) as MutablePacket;
        packet.comparisons[0].terms = ["device"];
        return packet;
      },
    ],
    [
      "unknown top-level field",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        packet.unknownField = true;
        return packet;
      },
    ],
    [
      "invalid RFC 3339 date-time",
      () => {
        const packet = clone(pieceOfCake) as MutablePacket;
        packet.generatedAt = "not-a-date-time";
        return packet;
      },
    ],
  ];

  it.each(invalidCases)("rejects invalid case: %s", (_name, buildPacket) => {
    expectInvalid(buildPacket());
  });

  it("returns all schema errors with JSON Pointers", () => {
    const packet = clone(pieceOfCake) as MutablePacket;
    delete packet.packetId;
    packet.knowledgeItems = [];

    const result = validateLearningPacket(packet);
    expect(result.valid).toBe(false);
    if (result.valid) return;

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pointer: "/packetId", keyword: "required" }),
        expect.objectContaining({ pointer: "/knowledgeItems", keyword: "minItems" }),
      ]),
    );
  });

  it("returns a structured JSON parse error", () => {
    const result = parseAndValidateLearningPacket('{"schemaVersion":');
    expect(result).toMatchObject({
      valid: false,
      stage: "parse",
      errors: [
        {
          pointer: "/",
          keyword: "parse",
        },
      ],
    });
  });
});
