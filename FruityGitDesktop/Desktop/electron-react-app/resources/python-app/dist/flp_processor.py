import sys
import zipfile
import json
import traceback
import tempfile
import os
import enum
from pathlib import Path

import pyflp


def _patch_pyflp_eventenum_for_py312_plus() -> None:
    """
    pyflp defines a base EventEnum with no members and relies on _missing_.
    Python 3.12+ raises TypeError when calling an Enum with no members, before
    _missing_ can run, which breaks pyflp.parse().

    We do NOT modify the library source; instead we monkeypatch EnumMeta.__call__
    at runtime for this specific class only.
    """

    original_call = enum.EnumMeta.__call__

    # Avoid double-patching in long-lived processes.
    if getattr(enum.EnumMeta.__call__, "_fruitygit_pyflp_patch", False):
        return

    def patched_call(cls, value, *args, **kwargs):  # type: ignore[no-redef]
        try:
            return original_call(cls, value, *args, **kwargs)
        except TypeError as exc:
            # Only intercept the exact pyflp EventEnum "no members" failure.
            if (
                cls.__name__ == "EventEnum"
                and getattr(cls, "__module__", "").endswith("pyflp._events")
                and not getattr(cls, "__members__", {})
                and "has no members" in str(exc)
            ):
                missing = getattr(cls, "_missing_", None)
                if callable(missing):
                    alt = missing(value)
                    if alt is not None:
                        return alt
            raise

    patched_call._fruitygit_pyflp_patch = True  # type: ignore[attr-defined]
    enum.EnumMeta.__call__ = patched_call  # type: ignore[assignment]


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
    samples = []
    try:
        for sampler in project.channels.samplers:
            ref = getattr(sampler, "sample_path", None)
            if ref is None:
                continue
            samples.append(str(ref))
    except Exception:
        samples = []

    metadata = {
        "schemaVersion": 1,
        "flpFile": flp_name,
        "baseBpm": _project_tempo_safe(project),
        "plugins": {
            "generators": _extract_generators(project),
            "effects": _extract_effects(project),
        },
        "samples": samples,
    }
    return metadata


def _resolve_sample_path(sample_ref, flp_path: Path) -> Path | None:
    """Resolve FL sample references to an existing filesystem path."""
    if sample_ref is None:
        return None

    raw = str(sample_ref).strip().strip("\"'")
    if not raw:
        return None

    # Normalize env vars and separators early.
    expanded = raw.replace("\\", "/")
    expanded = str(Path(expanded).expanduser())
    expanded = str(Path(expanded))
    expanded = str(Path(os.path.expandvars(expanded)))

    candidate = Path(expanded)
    candidates = []

    # 1) As-is (absolute or cwd-relative)
    candidates.append(candidate)
    # 2) Relative to FLP location (common for project-local assets)
    candidates.append((flp_path.parent / candidate))
    # 3) Relative to current process directory (fallback)
    candidates.append(Path.cwd() / candidate)

    for p in candidates:
        try:
            resolved = p.expanduser().resolve(strict=False)
        except Exception:
            continue
        if resolved.exists() and resolved.is_file():
            return resolved

    return None


def process_flp(flp_path_str: str) -> Path:
    # Make pyflp compatible with Python 3.12+ enum behavior.
    if sys.version_info >= (3, 12):
        _patch_pyflp_eventenum_for_py312_plus()

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
                    ref = getattr(sampler, "sample_path", None)
                    if ref is None:
                        continue
                    sample_path = _resolve_sample_path(ref, flp_path)
                    if sample_path is not None and sample_path.exists():
                        archive.write(sample_path, arcname=sample_path.name)
                    else:
                        # Print debug candidates to help diagnose why sample isn't included.
                        raw = str(ref)
                        cand1 = Path(os.path.expandvars(raw))
                        cand2 = flp_path.parent / cand1
                        cand3 = Path.cwd() / cand1
                        print(
                            "Warning: Sample file not found. "
                            f"ref={raw!r} "
                            f"candidates={[str(cand1), str(cand2), str(cand3)]}",
                            file=sys.stderr,
                        )
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
