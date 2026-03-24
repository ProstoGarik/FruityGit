import sys
import zipfile
import json
from pathlib import Path

import pyflp


def _clean_name(*values):
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _extract_generators(project):
    generators = []
    for channel in project.channels:
        try:
            plugin_obj = getattr(channel, "plugin", None)
            plugin_name = _clean_name(
                getattr(plugin_obj, "name", None),
                getattr(channel, "display_name", None),
                getattr(channel, "name", None),
                getattr(channel, "internal_name", None),
            )
            if not plugin_name:
                continue
            generators.append(plugin_name)
        except Exception:
            # Best-effort extraction; skip malformed channels.
            continue
    return sorted(set(generators), key=str.lower)


def _extract_effects(project):
    effects = []
    for insert in project.mixer:
        for slot in insert:
            try:
                plugin_obj = getattr(slot, "plugin", None)
                plugin_name = _clean_name(
                    getattr(plugin_obj, "name", None),
                    getattr(slot, "name", None),
                    getattr(slot, "internal_name", None),
                )
                if not plugin_name:
                    continue
                effects.append(plugin_name)
            except Exception:
                # Best-effort extraction; skip malformed slots.
                continue
    return sorted(set(effects), key=str.lower)


def process_flp(flp_path_str: str) -> Path:
    flp_path = Path(flp_path_str).expanduser().resolve()
    if not flp_path.exists():
        raise FileNotFoundError(f"FLP file not found: {flp_path}")

    project = pyflp.parse(flp_path)
    zip_path = flp_path.with_suffix(".zip")

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(flp_path, arcname=flp_path.name)

        # Persist FL project metadata so Git commit diffs can track semantic changes
        # like base BPM (tempo), not only file-level A/D/M.
        metadata = {
            "schemaVersion": 1,
            "flpFile": flp_path.name,
            "baseBpm": project.tempo,
            "plugins": {
                "generators": _extract_generators(project),
                "effects": _extract_effects(project),
            },
        }
        archive.writestr(".fruitygit-flp-meta.json", json.dumps(metadata, ensure_ascii=True, indent=2))

        for sampler in project.channels.samplers:
            sample_ref = getattr(sampler, "sample_path", None)
            if not sample_ref:
                continue

            sample_path = Path(sample_ref)
            if sample_path.exists():
                # Keep folder structure inside archive to avoid duplicate names.
                archive.write(sample_path, arcname=sample_path.name)
            else:
                print(f"Warning: Sample file not found - {sample_path}", file=sys.stderr)

    return zip_path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python flp_processor.py <path-to-flp>", file=sys.stderr)
        return 1

    flp_arg = sys.argv[1]
    try:
        zip_path = process_flp(flp_arg)
        # Keep last stdout line as zip path for Electron parser.
        print(str(zip_path))
        return 0
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
