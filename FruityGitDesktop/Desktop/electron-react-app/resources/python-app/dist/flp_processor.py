import sys
import zipfile
import json
import traceback
import tempfile
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
    try:
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
                continue
    except Exception:
        return []
    return sorted(set(generators), key=str.lower)


def _extract_effects(project):
    """Collect mixer effect names. Skips inserts that pyflp cannot iterate (missing params)."""
    effects = []
    try:
        for insert in project.mixer:
            try:
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
                        continue
            except (KeyError, TypeError, AttributeError):
                # Insert without Mixer params: Insert.__iter__ uses _kw["params"].
                continue
            except Exception:
                continue
    except Exception:
        return []
    return sorted(set(effects), key=str.lower)


def _project_tempo_safe(project):
    try:
        return project.tempo
    except Exception:
        return None


def _build_metadata(project, flp_name: str) -> dict:
    """Best-effort metadata; never raises (zip creation must still succeed)."""
    metadata = {
        "schemaVersion": 1,
        "flpFile": flp_name,
        "baseBpm": _project_tempo_safe(project),
        "plugins": {
            "generators": _extract_generators(project),
            "effects": _extract_effects(project),
        },
    }
    return metadata


def process_flp(flp_path_str: str) -> Path:
    flp_path = Path(flp_path_str).expanduser().resolve()
    if not flp_path.exists():
        raise FileNotFoundError(f"FLP file not found: {flp_path}")

    # Write output zip into a known-writable location. The input FLP directory
    # may be read-only or inaccessible from the Electron process even if it can
    # read the file (e.g., network drives, permissions, sandboxing).
    out_dir = Path(tempfile.gettempdir()) / "fruitygit"
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = (out_dir / flp_path.name).with_suffix(".zip")

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        # Always zip the FLP itself first. If pyflp fails to parse the project
        # (pyflp/lib errors, unsupported FLP variants), we still want the
        # Electron app to receive a zip path.
        archive.write(flp_path, arcname=flp_path.name)

        project = None
        try:
            project = pyflp.parse(flp_path)
        except Exception:
            print("Warning: pyflp.parse() failed; continuing without samples/metadata.", file=sys.stderr)
            print(traceback.format_exc(), file=sys.stderr)

        try:
            if project is not None:
                metadata = _build_metadata(project, flp_path.name)
                archive.writestr(
                    ".fruitygit-flp-meta.json",
                    json.dumps(metadata, ensure_ascii=True, indent=2),
                )
        except Exception as exc:
            print(f"Warning: Could not write project metadata: {exc}", file=sys.stderr)

        try:
            if project is not None:
                for sampler in project.channels.samplers:
                    if sampler.sample_path is None:
                        continue
                    sample_path = Path(sampler.sample_path)
                    if sample_path.exists():
                        archive.write(sample_path, arcname=sample_path.name)
                    else:
                        print(f"Warning: Sample file not found - {sample_path}", file=sys.stderr)
        except Exception:
            # If sampler iteration fails due to a pyflp edge case, keep zip creation successful.
            print("Warning: Could not extract samples from parsed project.", file=sys.stderr)
            print(traceback.format_exc(), file=sys.stderr)

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
