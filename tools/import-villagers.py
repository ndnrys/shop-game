"""村人画像ZIPを assets/villagers に展開し、参照用JSONを作る。標準ライブラリのみ。"""
import csv
import io
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "assets" / "villagers"
CATALOG = ROOT / "data" / "villagers.json"
NAME = re.compile(r"^[a-z][a-z0-9_]*_[0-9]+\.png$")


def main(zip_path):
    with zipfile.ZipFile(zip_path) as archive:
        rows = list(csv.DictReader(io.StringIO(archive.read("manifest.csv").decode("utf-8-sig"))))
        if len(rows) != 50:
            raise ValueError(f"50人分ではありません: {len(rows)}")
        names = [row["filename"] for row in rows]
        if len(set(names)) != 50 or any(not NAME.fullmatch(name) for name in names):
            raise ValueError("ファイル名が重複、または不正です")
        images = {}
        for name in names:
            data = archive.read(name)
            if not data.startswith(bytes([137, 80, 78, 71, 13, 10, 26, 10])):
                raise ValueError(f"PNGではありません: {name}")
            images[name] = data

    TARGET.mkdir(parents=True, exist_ok=True)
    for name, data in images.items():
        (TARGET / name).write_bytes(data)
    records = [
        {
            "id": Path(row["filename"]).stem,
            "role": row["role"],
            "image": f"assets/villagers/{row['filename']}",
        }
        for row in rows
    ]
    CATALOG.write_text(json.dumps(records, ensure_ascii=False, indent=2) + chr(10), encoding="utf-8")
    print(f"{len(records)}人を取り込みました: {TARGET.relative_to(ROOT)} / {CATALOG.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("使い方: python3 tools/import-villagers.py villagers_named_50.zip")
    main(sys.argv[1])
