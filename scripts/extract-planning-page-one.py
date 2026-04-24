from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


KNOWN_CODES = {
    19,
    21,
    22,
    30,
    31,
    32,
    33,
    34,
    35,
    36,
    37,
    38,
    39,
    40,
    41,
    42,
    43,
    44,
    45,
    46,
    47,
    48,
    49,
    51,
    52,
    54,
    55,
    60,
    61,
    62,
    65,
    66,
    67,
    68,
    69,
}


def clean_number(value: str) -> int | None:
    digits = re.sub(r"\D", "", value)

    if not digits:
        return None

    return int(digits)


def parse_first_page(pdf_path: Path) -> dict[str, object]:
    reader = PdfReader(str(pdf_path))

    if not reader.pages:
        raise ValueError("PDF bevat geen pagina's.")

    page_text = reader.pages[0].extract_text() or ""
    lines = [line.strip() for line in page_text.splitlines() if line.strip()]
    date_match = re.search(r"(\d{2}/\d{2}/\d{4})\s+\d{2}:\d{2}:\d{2}", page_text)
    document_date = date_match.group(1) if date_match else None

    start_index = next((index for index, line in enumerate(lines) if line.isdigit() and int(line) in KNOWN_CODES), -1)

    if start_index < 0:
        raise ValueError("Geen artikelcodes gevonden op pagina 1.")

    codes: list[int] = []
    cursor = start_index

    while cursor < len(lines):
        line = lines[cursor]

        if not line.isdigit():
            break

        code = int(line)

        if code not in KNOWN_CODES:
            break

        codes.append(code)
        cursor += 1

    descriptions: list[str] = []

    while cursor < len(lines) and len(descriptions) < len(codes):
        descriptions.append(lines[cursor])
        cursor += 1

    quantities: list[int] = []

    while cursor < len(lines) and len(quantities) < len(codes):
        quantity = clean_number(lines[cursor])

        if quantity is None:
            cursor += 1
            continue

        quantities.append(quantity)
        cursor += 1

    if len(descriptions) != len(codes) or len(quantities) != len(codes):
        raise ValueError("Kon codes, omschrijvingen en aantallen niet betrouwbaar uitlijnen.")

    groups = [
        {
            "code": code,
            "description": description,
            "colli": quantity,
        }
        for code, description, quantity in zip(codes, descriptions, quantities, strict=True)
    ]

    return {
        "documentDate": document_date,
        "groups": groups,
    }


def main() -> None:
    if len(sys.argv) < 2:
        raise ValueError("Gebruik: extract-planning-page-one.py <pdf-pad>")

    pdf_path = Path(sys.argv[1])

    if not pdf_path.exists():
        raise FileNotFoundError(f"Bestand niet gevonden: {pdf_path}")

    result = parse_first_page(pdf_path)
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
