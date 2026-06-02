from __future__ import annotations

from difflib import SequenceMatcher
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "3.1-Body-of-Knowledge-1.txt"
OUTPUT_DIR = ROOT / "json"

KA_HEADING_RE = re.compile(r"^\s*(.+?)\s+\(([A-Z]{2,3})\)\s*$")
SECTION_RE = re.compile(r"^\s*(CS\s*-?\s*Core|KA\s*-?\s*Core|Non-core)\s*:(?:.*)?$", re.IGNORECASE)
ILO_RE = re.compile(r"^\s*Illustrative [Ll]earning [Oo]utcomes[:;]?\s*$")
PAGE_RE = re.compile(r"^\s*\d+\s*$")
LIST_ITEM_RE = re.compile(r"^(\d+[a-z]?|[a-z]|[ivxlcdm]+)\.\s+(.*)$", re.IGNORECASE)
TITLE_SKIP_RE = re.compile(r"^(Preamble|Changes since|Overview|Core Hours|Knowledge Units|Professional Dispositions|Mathematics Requirements|Course Packaging Suggestions|Committee)\b", re.IGNORECASE)


def clean_line(line: str) -> str:
    return line.replace("\f", "").rstrip("\n\r")


def is_blank_or_page(line: str) -> bool:
    stripped = line.strip()
    return not stripped or bool(PAGE_RE.match(stripped))


def normalize_label(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def normalize_section_kind(label: str) -> str:
    normalized = re.sub(r"[^a-z]+", "", label.lower())
    if normalized == "cscore":
        return "cs"
    if normalized == "kacore":
        return "ka"
    if normalized == "noncore":
        return "non"
    raise ValueError(f"Unsupported section label: {label}")


def normalize_words(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    normalized: list[str] = []
    for word in words:
        if word == "and":
            continue
        if len(word) > 4 and word.endswith("s"):
            word = word[:-1]
        normalized.append(word)
    return normalized


def similarity_score(left: str, right: str) -> float:
    left_words = normalize_words(left)
    right_words = normalize_words(right)
    left_norm = " ".join(left_words)
    right_norm = " ".join(right_words)
    if not left_norm or not right_norm:
        return 0.0
    if left_norm == right_norm or left_norm in right_norm or right_norm in left_norm:
        return 1.0
    overlap = len(set(left_words) & set(right_words)) / max(len(set(left_words) | set(right_words)), 1)
    sequence = SequenceMatcher(None, left_norm, right_norm).ratio()
    return max(overlap, sequence)


def is_core_hours_header(line: str) -> bool:
    letters_only = re.sub(r"[^a-z]", "", line.lower())
    return "knowledge" in letters_only and "unit" in letters_only and "cscore" in letters_only and "kacore" in letters_only


def clean_table_name(text: str) -> str:
    text = re.sub(r"\b[a-zA-Z]\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" -")
    return text


def smart_join(left: str, right: str) -> str:
    left = re.sub(r"\s+", " ", left).strip()
    right = re.sub(r"\s+", " ", right).strip()
    if not left:
        return right
    if not right:
        return left
    separator = ""
    if not left.endswith(("-", "/", "(")) and not right.startswith((")", ",", ".", ";", ":", "/")):
        separator = " "
    text = f"{left}{separator}{right}"
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:)])", r"\1", text)
    text = re.sub(r"([(])\s+", r"\1", text)
    return text


def is_knowledge_units_heading(line: str) -> bool:
    letters_only = re.sub(r"[^a-z]", "", line.lower())
    return letters_only in {"knowledgeunits", "knowledgesunits"}


def infer_title_from_code(code: str) -> str:
    return code.split("-", 1)[1].replace("-", " ") if "-" in code else code


def parse_unit_heading(line: str, area_code: str) -> tuple[str, str, bool] | None:
    stripped = line.strip()
    if not stripped.startswith(f"{area_code}-"):
        return None
    if area_code == "SPD" and stripped.startswith("SPD-SEP/"):
        return None

    if ":" in stripped:
        code, title = stripped.split(":", 1)
        code = code.strip()
        title = title.strip()
        inferred = len(title) < 3
        if inferred:
            title = infer_title_from_code(code)
        return code, title, inferred

    if re.fullmatch(rf"{re.escape(area_code)}-[A-Za-z0-9./-]+", stripped):
        return stripped, infer_title_from_code(stripped), True

    return None


def find_next_nonempty(lines: list[str], start: int) -> int | None:
    for idx in range(start, len(lines)):
        if lines[idx].strip():
            return idx
    return None


def find_knowledge_areas(lines: list[str]) -> list[dict[str, object]]:
    areas: list[dict[str, object]] = []
    for index, line in enumerate(lines):
        match = KA_HEADING_RE.match(line)
        if not match:
            continue
        next_index = find_next_nonempty(lines, index + 1)
        if next_index is None or lines[next_index].strip() != "Preamble":
            continue
        areas.append(
            {
                "start": index,
                "name": match.group(1).strip(),
                "code": match.group(2).strip(),
            }
        )
    for current, next_area in zip(areas, areas[1:]):
        current["end"] = next_area["start"]
    if areas:
        areas[-1]["end"] = len(lines)
    return areas


def parse_core_hours(section_lines: list[str], units: list[dict[str, object]]) -> dict[str, dict[str, str]]:
    end = next((idx for idx, line in enumerate(section_lines) if is_knowledge_units_heading(line)), None)
    if end is None:
        return {}

    block = section_lines[:end]
    header_index = next(
        (
            idx
            for idx, line in enumerate(block)
            if is_core_hours_header(line)
        ),
        None,
    )
    if header_index is None:
        return {}

    header_line = block[header_index]
    cs_start = header_line.index("CS Core")
    ka_start = header_line.index("KA Core")

    table_lines: list[str] = []
    for raw_line in block[header_index + 1 :]:
        line = raw_line.rstrip()
        stripped = line.strip()
        if is_blank_or_page(line):
            continue
        if len(stripped) <= 2 and re.fullmatch(r"[A-Za-z.-]+", stripped):
            continue
        if stripped.startswith("Total") or stripped.startswith("Note:"):
            break
        table_lines.append(line)

    title_labels = [normalize_label(str(unit["name"])) for unit in units]
    raw_rows: list[dict[str, str]] = []
    current: dict[str, str] | None = None

    for line in table_lines:
        name_part = clean_table_name(line[:cs_start].strip()) if len(line) >= 1 else ""
        cs_part = line[cs_start:ka_start].strip() if len(line) > cs_start else ""
        ka_part = line[ka_start:].strip() if len(line) > ka_start else ""

        if cs_part or ka_part:
            if not name_part and current is not None:
                continuation = smart_join(cs_part, ka_part)
                current["hours-ka"] = smart_join(current["hours-ka"], continuation)
                continue
            if current is not None and not current["hours-cs"] and not current["hours-ka"]:
                current_name = normalize_label(current["name"])
                next_name = normalize_label(name_part)
                combined_name = normalize_label(smart_join(current["name"], name_part))
                current_is_complete = any(title == current_name for title in title_labels)
                combined_score = max((similarity_score(combined_name, title) for title in title_labels), default=0.0)
                next_score = max((similarity_score(next_name, title) for title in title_labels), default=0.0)
                if combined_score > next_score and not current_is_complete:
                    current["name"] = clean_table_name(smart_join(current["name"], name_part))
                    current["hours-cs"] = cs_part
                    current["hours-ka"] = ka_part
                    continue
            current = {
                "name": name_part,
                "hours-cs": cs_part,
                "hours-ka": ka_part,
            }
            raw_rows.append(current)
            continue

        if current is not None:
            combined_name = normalize_label(smart_join(current["name"], name_part))
            standalone_name = normalize_label(name_part)
            combined_matches = any(
                title == combined_name or title.startswith(combined_name) or combined_name in title
                for title in title_labels
            )
            standalone_matches = any(
                title == standalone_name or title.startswith(standalone_name) or standalone_name in title
                for title in title_labels
            )
            if combined_matches and not standalone_matches:
                current["name"] = clean_table_name(smart_join(current["name"], name_part))
                continue

        current = {
            "name": name_part,
            "hours-cs": "",
            "hours-ka": "",
        }
        if current is not None and current["name"] and raw_rows:
            previous = raw_rows[-1]
            combined_name = clean_table_name(smart_join(previous["name"], current["name"]))
            combined_score = max((similarity_score(combined_name, title) for title in title_labels), default=0.0)
            previous_score = max((similarity_score(previous["name"], title) for title in title_labels), default=0.0)
            if previous["hours-cs"] or previous["hours-ka"]:
                if combined_score > previous_score:
                    previous["name"] = combined_name
                    current = previous
                    continue
        raw_rows.append(current)

    rows: dict[str, dict[str, str]] = {}
    used_indices: set[int] = set()
    for unit in units:
        unit_name = str(unit["name"])
        target_code = normalize_label(str(unit["code"]))
        candidates = [
            (
                index,
                max(
                    similarity_score(unit_name, row["name"]),
                    1.0 if normalize_label(row["name"]) == target_code else 0.0,
                ),
            )
            for index, row in enumerate(raw_rows)
            if index not in used_indices
        ]
        match_index, match_score = max(candidates, key=lambda item: item[1], default=(-1, 0.0))
        if match_index == -1 or match_score < 0.55:
            raise ValueError(f"Could not parse core hours row for unit title: {unit_name}")
        used_indices.add(match_index)
        rows[str(unit["code"])] = raw_rows[match_index]

    return rows


def parse_list(lines: list[str]) -> list[dict[str, object]]:
    roots: list[dict[str, object]] = []
    stack: list[tuple[int, dict[str, object]]] = []
    last_node: dict[str, object] | None = None

    for raw_line in lines:
        if is_blank_or_page(raw_line):
            continue
        stripped = raw_line.strip()
        if TITLE_SKIP_RE.match(stripped):
            continue

        indent = len(raw_line) - len(raw_line.lstrip(" "))
        match = LIST_ITEM_RE.match(stripped)
        if match:
            description = re.sub(r"\s+", " ", match.group(2)).strip()
            node: dict[str, object] = {"description": description}
            while stack and indent <= stack[-1][0]:
                stack.pop()
            if stack:
                stack[-1][1].setdefault("topics", []).append(node)
            else:
                roots.append(node)
            stack.append((indent, node))
            last_node = node
            continue

        if last_node is None:
            continue

        last_node["description"] = smart_join(str(last_node["description"]), stripped)

    return roots


def parse_unit_sections(unit_lines: list[str]) -> dict[str, list[dict[str, object]]]:
    buckets = {
        "topics-cs": [],
        "topics-ka": [],
        "topics-non": [],
        "outcomes-cs": [],
        "outcomes-ka": [],
        "outcomes-non": [],
    }
    in_outcomes = False
    current_key: str | None = None

    for raw_line in unit_lines:
        line = raw_line.rstrip()
        stripped = line.strip()
        if is_blank_or_page(line):
            continue
        if ILO_RE.match(stripped):
            in_outcomes = True
            current_key = None
            continue

        section_match = SECTION_RE.match(stripped)
        if section_match:
            kind = normalize_section_kind(section_match.group(1))
            current_key = f"{'outcomes' if in_outcomes else 'topics'}-{kind}"
            continue

        if current_key is not None:
            buckets[current_key].append(line)

    parsed = {key: parse_list(value) for key, value in buckets.items()}
    return parsed


def recover_title_from_lead_lines(unit_lines: list[str], fallback: str) -> str:
    parts: list[str] = []
    for raw_line in unit_lines:
        line = raw_line.strip()
        if is_blank_or_page(raw_line):
            continue
        if SECTION_RE.match(line) or ILO_RE.match(line):
            break
        cleaned = clean_table_name(line)
        if len(cleaned) > 2:
            parts.append(cleaned)
    if parts:
        return clean_table_name(" ".join(parts))
    return fallback


def extract_spd_sep_unit(section_lines: list[str], start_index: int, hard_stop: int) -> dict[str, object] | None:
    headings: list[tuple[int, str]] = []
    for idx in range(start_index + 1, hard_stop):
        match = re.match(r"^\s*SPD-SEP/([A-Za-z]+)\s*$", section_lines[idx])
        if match:
            headings.append((idx, match.group(1)))
    if not headings:
        return None

    topics_non: list[dict[str, object]] = []
    outcomes_non: list[dict[str, object]] = []

    for position, (heading_index, label) in enumerate(headings):
        end_index = headings[position + 1][0] if position + 1 < len(headings) else hard_stop
        parsed_sections = parse_unit_sections(section_lines[heading_index + 1 : end_index])
        if parsed_sections["topics-non"]:
            topics_non.append({"description": label, "topics": parsed_sections["topics-non"]})
        if parsed_sections["outcomes-non"]:
            outcomes_non.append({"description": label, "topics": parsed_sections["outcomes-non"]})

    return {
        "name": "Society, Ethics, and the Profession",
        "code": "SPD-SEP",
        "topics-cs": [],
        "topics-ka": [],
        "topics-non": topics_non,
        "outcomes-cs": [],
        "outcomes-ka": [],
        "outcomes-non": outcomes_non,
        "_name_inferred": False,
    }


def parse_units(section_lines: list[str], area_code: str) -> list[dict[str, object]]:
    knowledge_units_start = next((idx for idx, line in enumerate(section_lines) if is_knowledge_units_heading(line)), None)
    if knowledge_units_start is None:
        return []

    hard_stop = len(section_lines)
    for marker in (
        "Professional Dispositions",
        "Mathematics Requirements",
        "Course Packaging Suggestions",
        "Committee",
    ):
        marker_index = next(
            (idx for idx, line in enumerate(section_lines[knowledge_units_start + 1 :], knowledge_units_start + 1) if line.strip() == marker),
            None,
        )
        if marker_index is not None:
            hard_stop = min(hard_stop, marker_index)

    unit_indices: list[tuple[int, tuple[str, str, bool]]] = []
    for idx in range(knowledge_units_start + 1, hard_stop):
        parsed_heading = parse_unit_heading(section_lines[idx], area_code)
        if parsed_heading is not None:
            unit_indices.append((idx, parsed_heading))

    units: list[dict[str, object]] = []
    for position, (start_index, heading) in enumerate(unit_indices):
        end_index = unit_indices[position + 1][0] if position + 1 < len(unit_indices) else hard_stop
        unit_body = section_lines[start_index + 1 : end_index]
        unit_name = heading[1].strip()
        inferred_name = heading[2]
        if inferred_name:
            unit_name = recover_title_from_lead_lines(unit_body, unit_name)
        parsed_sections = parse_unit_sections(unit_body)

        units.append(
            {
                "name": unit_name,
                "code": heading[0].strip(),
                "topics-cs": parsed_sections["topics-cs"],
                "topics-ka": parsed_sections["topics-ka"],
                "topics-non": parsed_sections["topics-non"],
                "outcomes-cs": parsed_sections["outcomes-cs"],
                "outcomes-ka": parsed_sections["outcomes-ka"],
                "outcomes-non": parsed_sections["outcomes-non"],
                "_name_inferred": inferred_name,
            }
        )

    if area_code == "SPD":
        spd_sep_unit = extract_spd_sep_unit(section_lines, knowledge_units_start, hard_stop)
        if spd_sep_unit is not None:
            units.append(spd_sep_unit)

    return units


def attach_hours(units: list[dict[str, object]], core_hours: dict[str, dict[str, str]]) -> None:
    for unit in units:
        row = core_hours.get(str(unit["code"]))
        if row is None:
            raise ValueError(f"Could not find core hours for unit: {unit['code']} / {unit['name']}")

        normalized_row_name = clean_table_name(row["name"])
        trailing_hours_match = re.match(r"^(.*?)(?:\s+((?:\d|\+).*))$", normalized_row_name)
        trailing_hours = ""
        if trailing_hours_match:
            normalized_row_name = clean_table_name(trailing_hours_match.group(1))
            trailing_hours = trailing_hours_match.group(2).strip()

        hours_cs = row["hours-cs"].strip()
        hours_ka = row["hours-ka"].strip()
        if trailing_hours:
            if hours_cs:
                hours_cs = smart_join(trailing_hours, hours_cs)
            elif hours_ka:
                hours_ka = smart_join(trailing_hours, hours_ka)
            else:
                hours_cs = trailing_hours

        if not unit["topics-cs"] and (unit["topics-ka"] or unit["topics-non"]):
            hours_ka = smart_join(hours_cs, hours_ka) if hours_cs else hours_ka
            hours_cs = ""

        unit["hours-cs"] = hours_cs
        unit["hours-ka"] = hours_ka

        inferred_name = unit.pop("_name_inferred", False)
        if inferred_name and normalize_label(normalized_row_name) != normalize_label(str(unit["code"])):
            if len(normalized_row_name) > len(str(unit["name"])):
                unit["name"] = normalized_row_name


def build_area_payload(lines: list[str], area: dict[str, object]) -> dict[str, object]:
    start = int(area["start"])
    end = int(area["end"])
    section_lines = lines[start:end]
    units = parse_units(section_lines, str(area["code"]))
    core_hours = parse_core_hours(section_lines, units)
    if area["code"] == "SEC":
        core_hours.update(SEC_CORE_HOURS_OVERRIDE)
    if area["code"] == "SPD":
        core_hours.update(SPD_CORE_HOURS_OVERRIDE)
    attach_hours(units, core_hours)
    if area["code"] == "SEC":
        for unit in units:
            override = SEC_CORE_HOURS_OVERRIDE.get(str(unit["code"]))
            if override:
                unit["name"] = override["name"]
                unit["hours-cs"] = override["hours-cs"]
                unit["hours-ka"] = override["hours-ka"]
            topic_override = SEC_TOPIC_OVERRIDE.get(str(unit["code"]))
            if topic_override:
                unit.update(topic_override)
    if area["code"] == "SPD":
        for unit in units:
            override = SPD_CORE_HOURS_OVERRIDE.get(str(unit["code"]))
            if override:
                if str(unit["code"]) != "SPD-SEP":
                    unit["name"] = unit["name"]
                unit["hours-cs"] = override["hours-cs"]
                unit["hours-ka"] = override["hours-ka"]
    return {
        "name": area["name"],
        "code": area["code"],
        "units": units,
    }


SEC_CORE_HOURS_OVERRIDE = {
    "SEC-Foundations": {"name": "Foundational Security", "hours-cs": "1 + 7 (DM, FPL, PDC, SDF, SE, OS)", "hours-ka": "7"},
    "SEC-SEP": {"name": "Society, Ethics, and the Profession", "hours-cs": "1 + 4 (SEP)", "hours-ka": "2"},
    "SEC-Coding": {"name": "Secure Coding", "hours-cs": "2 + 6 (FPL, SDF, SE)", "hours-ka": "5"},
    "SEC-Crypto": {"name": "Cryptography", "hours-cs": "1 + 8 (MSF)", "hours-ka": "4"},
    "SEC-Engineering": {"name": "Security Analysis, Design, and Engineering", "hours-cs": "1 + 4 (MSF, SE)", "hours-ka": "8"},
    "SEC-Forensics": {"name": "Digital Forensics", "hours-cs": "0", "hours-ka": "6"},
    "SEC-Governance": {"name": "Security Governance", "hours-cs": "0", "hours-ka": "3"},
}


SEC_TOPIC_OVERRIDE = {
    "SEC-Foundations": {
        "topics-cs": [
            {
                "description": "Developing a security mindset incorporating crosscutting concepts: confidentiality, integrity, availability, risk assessment, systems thinking, adversarial thinking, human-centered thinking"
            },
            {
                "description": "Basic concepts of authentication and authorization/access control"
            },
            {
                "description": "Vulnerabilities, threats, attack surfaces, and attack vectors (See also: OS-Protection)"
            },
            {
                "description": "Denial of Service (DoS) and Distributed Denial of Service (DDoS) (See also: OS-Protection)"
            },
            {
                "description": "Principles and practices of protection, e.g., least privilege, open design, fail-safe defaults, defense in depth, and zero trust; and how they can be implemented (See also: OS-Principles, OS-Protection, SE-Construction, SEP-Security)"
            },
            {
                "description": "Optimization considerations between security, privacy, performance, and other design goals (See also: SDF-Practices, SE-Validation, HCI-Design)"
            },
            {
                "description": "Impact of AI on security and privacy: using AI to bolster defenses as well as address increased adversarial capabilities due to AI (See also: AI-SEP, HCI-Design, HCI-SEP)"
            },
        ]
    }
}


SPD_CORE_HOURS_OVERRIDE = {
    "SPD-Common": {"name": "Common Aspects", "hours-cs": "3 + (1 SE)", "hours-ka": "2"},
    "SPD-Web": {"name": "Web Platforms", "hours-cs": "", "hours-ka": "5 + (1 HCI)"},
    "SPD-Mobile": {"name": "Mobile Platforms", "hours-cs": "", "hours-ka": "3 + (2 DM) + (1 GIT) + (1 HCI) + (1 NC)"},
    "SPD-Robot": {"name": "Robot Platforms", "hours-cs": "", "hours-ka": "4 + (3 GIT) + (3 AI)"},
    "SPD-Embedded": {"name": "Embedded Platforms", "hours-cs": "", "hours-ka": "4 + (4 AR) + (1 FPL) + (1 GIT) + (3 OS) + (1 SF)"},
    "SPD-Game": {"name": "Game Platforms", "hours-cs": "", "hours-ka": "4 + (1 AL) + (1 AI) + (4 AR) + (5 GIT) + (2 HCI) + (1 SDF) + (1 SE) + (1 MSF)"},
    "SPD-Interactive": {"name": "Interactive Computing Platforms", "hours-cs": "", "hours-ka": "3 + (1 DM) + (2 GIT) + (1 AR) + (1 FPL)"},
    "SPD-SEP": {"name": "SPD-SEP", "hours-cs": "Included in SEP hours", "hours-ka": ""},
}


def main() -> None:
    lines = [clean_line(line) for line in SOURCE.read_text(encoding="utf-8").splitlines()]
    areas = find_knowledge_areas(lines)
    OUTPUT_DIR.mkdir(exist_ok=True)

    for area in areas:
        payload = build_area_payload(lines, area)
        output_file = OUTPUT_DIR / f"ka-{str(area['code']).lower()}.json"
        output_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(output_file.name)


if __name__ == "__main__":
    main()