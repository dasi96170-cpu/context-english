#!/usr/bin/env python3
"""Validate CE Learning Packet v1 fixtures and required rejection cases."""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path
from typing import Any, Callable

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schemas" / "ce-learning-packet-v1.schema.json"
FIXTURE_DIR = ROOT / "tests" / "fixtures" / "learning-packets"


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


schema = load_json(SCHEMA_PATH)
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())


def errors_for(instance: Any) -> list[Any]:
    return sorted(
        validator.iter_errors(instance),
        key=lambda error: [str(part) for part in error.absolute_path],
    )


def describe_error(errors: list[Any]) -> str:
    if not errors:
        return ""
    error = errors[0]
    path = "/" + "/".join(str(part) for part in error.absolute_path)
    return f"{path}: {error.message}"


failures: list[str] = []
fixtures: dict[str, Any] = {}

print("Schema: PASS (JSON Schema Draft 2020-12)")

for path in sorted(FIXTURE_DIR.glob("*.json")):
    packet = load_json(path)
    fixtures[path.name] = packet
    errors = errors_for(packet)
    result = "PASS" if not errors else "FAIL"
    print(f"Valid fixture {path.name}: {result}")
    if errors:
        print(f"  {describe_error(errors)}")
        failures.append(f"valid fixture failed: {path.name}")


if not fixtures:
    failures.append("no valid fixtures found")


repeated_syllable_packet = copy.deepcopy(fixtures["apple-basic.json"])
repeated_syllable_packet["packetId"] = "cep_banana_syllable_check_001"
repeated_syllable_packet["encounter"]["originalInput"] = "banana"
repeated_syllable_packet["knowledgeItems"][0]["expression"] = "banana"
repeated_syllable_packet["knowledgeItems"][0]["lemma"] = "banana"
repeated_syllable_packet["knowledgeItems"][0]["syllables"] = ["ba", "na", "na"]
repeated_syllable_errors = errors_for(repeated_syllable_packet)
repeated_syllable_result = "PASS" if not repeated_syllable_errors else "FAIL"
print(f"Valid repeated-syllable check: {repeated_syllable_result}")
if repeated_syllable_errors:
    print(f"  {describe_error(repeated_syllable_errors)}")
    failures.append("valid repeated-syllable packet failed")


base = fixtures["piece-of-cake.json"]
comparison_base = fixtures["chinese-equipment.json"]


def missing_schema_version() -> Any:
    packet = copy.deepcopy(base)
    del packet["schemaVersion"]
    return packet


def wrong_schema_version() -> Any:
    packet = copy.deepcopy(base)
    packet["schemaVersion"] = "2.0"
    return packet


def empty_knowledge_items() -> Any:
    packet = copy.deepcopy(base)
    packet["knowledgeItems"] = []
    return packet


def missing_expression() -> Any:
    packet = copy.deepcopy(base)
    del packet["knowledgeItems"][0]["expression"]
    return packet


def illegal_item_type() -> Any:
    packet = copy.deepcopy(base)
    packet["knowledgeItems"][0]["type"] = "concept"
    return packet


def illegal_primary_domain() -> Any:
    packet = copy.deepcopy(base)
    packet["encounter"]["primaryDomain"] = "health"
    return packet


def illegal_source_language() -> Any:
    packet = copy.deepcopy(base)
    packet["encounter"]["sourceLanguage"] = "fr"
    return packet


def empty_usage() -> Any:
    packet = copy.deepcopy(base)
    packet["knowledgeItems"][0]["usage"] = {}
    return packet


def comparison_with_one_term() -> Any:
    packet = copy.deepcopy(comparison_base)
    packet["comparisons"][0]["terms"] = ["device"]
    return packet


def unknown_top_level_field() -> Any:
    packet = copy.deepcopy(base)
    packet["unknownField"] = True
    return packet


def invalid_date_time() -> Any:
    packet = copy.deepcopy(base)
    packet["generatedAt"] = "not-a-date-time"
    return packet


invalid_cases: list[tuple[str, Callable[[], Any]]] = [
    ("missing schemaVersion", missing_schema_version),
    ("wrong schemaVersion", wrong_schema_version),
    ("empty knowledgeItems", empty_knowledge_items),
    ("Knowledge Item missing expression", missing_expression),
    ("illegal Knowledge Item type", illegal_item_type),
    ("illegal primaryDomain", illegal_primary_domain),
    ("illegal sourceLanguage", illegal_source_language),
    ("empty usage object", empty_usage),
    ("comparison with fewer than two terms", comparison_with_one_term),
    ("unknown top-level field", unknown_top_level_field),
    ("invalid RFC 3339 date-time", invalid_date_time),
]

for name, build_case in invalid_cases:
    errors = errors_for(build_case())
    result = "PASS" if errors else "FAIL"
    print(f"Invalid case rejected — {name}: {result}")
    if not errors:
        failures.append(f"invalid case was accepted: {name}")


if failures:
    print("\nValidation: FAIL")
    for failure in failures:
        print(f"- {failure}")
    sys.exit(1)

print(
    f"\nValidation: PASS "
    f"({len(fixtures)} valid fixtures accepted; "
    f"{len(invalid_cases)} invalid cases rejected)"
)
