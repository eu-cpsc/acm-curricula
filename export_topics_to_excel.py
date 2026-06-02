from __future__ import annotations

import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font


ROOT = Path(__file__).resolve().parent
JSON_DIR = ROOT / "json"
OUTPUT_PATH = ROOT / "acm_knowledge_topics.xlsx"


def iter_topic_rows(unit: dict, core_key: str, core_label: str):
    def walk(topics: list[dict], is_subtopic: bool = False):
        for topic in topics:
            description = topic.get("description", "")
            if description:
                yield {
                    "ku": unit["code"],
                    "topic": description,
                    "core": core_label,
                    "indent": 1 if is_subtopic else 0,
                }
            children = topic.get("topics") or []
            if children:
                yield from walk(children, is_subtopic=True)

    yield from walk(unit.get(core_key, []))


def build_workbook(json_dir: Path, output_path: Path) -> Path:
    workbook = Workbook()
    default_sheet = workbook.active
    workbook.remove(default_sheet)

    json_paths = sorted(json_dir.glob("ka-*.json"))
    if not json_paths:
        raise FileNotFoundError(f"No JSON files found in {json_dir}")

    for json_path in json_paths:
        data = json.loads(json_path.read_text(encoding="utf-8"))
        sheet_name = data["code"]
        worksheet = workbook.create_sheet(title=sheet_name)

        worksheet.append(["KU", "Topic", "Core", "Evangel Courses"])
        for cell in worksheet[1]:
            cell.font = Font(bold=True)

        for unit in data.get("units", []):
            for core_key, core_label in (
                ("topics-cs", "CS"),
                ("topics-ka", "KA"),
                ("topics-non", "non"),
            ):
                for row in iter_topic_rows(unit, core_key, core_label):
                    worksheet.append([row["ku"], row["topic"], row["core"], ""])
                    topic_cell = worksheet.cell(row=worksheet.max_row, column=2)
                    topic_cell.alignment = Alignment(indent=row["indent"], wrap_text=True)

        worksheet.freeze_panes = "A2"
        worksheet.column_dimensions["A"].width = 18
        worksheet.column_dimensions["B"].width = 100
        worksheet.column_dimensions["C"].width = 10
        worksheet.column_dimensions["D"].width = 20

    workbook.save(output_path)
    return output_path


if __name__ == "__main__":
    path = build_workbook(JSON_DIR, OUTPUT_PATH)
    print(path)