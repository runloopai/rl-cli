import os
import re
import tarfile
import tempfile
from pathlib import Path

import pytest
import zstandard
from unittest.mock import patch

from rl_cli.main import run



def _make_text(path: Path, content: str = "hello world") -> Path:
    path.write_text(content)
    return path


def _make_json(path: Path) -> Path:
    path.write_text('{"k": "v"}')
    return path


def _make_zip(path: Path) -> Path:
    import zipfile

    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("a.txt", "A")
        zf.writestr("b/b.txt", "B")
    return path


def _make_targz(path: Path, tmpdir: Path) -> Path:
    root = tmpdir / "tgz_root"
    root.mkdir()
    (root / "a.txt").write_text("A")
    (root / "b").mkdir()
    (root / "b" / "b.txt").write_text("B")
    with tarfile.open(path, "w:gz") as tf:
        tf.add(root, arcname=".")
    return path


def _make_zst(path: Path, source: Path) -> Path:
    cctx = zstandard.ZstdCompressor()
    with source.open("rb") as src, path.open("wb") as dst:
        cctx.copy_stream(src, dst)
    return path


def _make_tar_then_zst(path: Path, tmpdir: Path) -> Path:
    tmp_tar = tmpdir / (path.stem + ".tar")
    root = tmpdir / "tar_root"
    root.mkdir()
    (root / "a.txt").write_text("A")
    with tarfile.open(tmp_tar, "w") as tf:
        tf.add(root, arcname=".")
    return _make_zst(path, tmp_tar)


@pytest.mark.asyncio
async def test_upload_various_types_and_cleanup(tmp_path: Path, capsys):
    # Require an API key
    api_key = os.environ.get("RUNLOOP_API_KEY")
    if not api_key:
        pytest.fail("RUNLOOP_API_KEY is required for end-to-end tests. Set it in the environment.")
    # Build sample files
    files = []
    files.append(("sample.txt", _make_text(tmp_path / "sample.txt")))
    files.append(("sample.json", _make_json(tmp_path / "sample.json")))
    files.append(("sample.zip", _make_zip(tmp_path / "sample.zip")))
    files.append(("sample.tar.gz", _make_targz(tmp_path / "sample.tar.gz", tmp_path)))

    # single-file zst (of a text file)
    text_src = tmp_path / "plain.txt"
    text_src.write_text("ZSTD")
    files.append(("sample.txt.zst", _make_zst(tmp_path / "sample.txt.zst", text_src)))

    # tar.zst
    files.append(("sample.tar.zst", _make_tar_then_zst(tmp_path / "sample.tar.zst", tmp_path)))

    created_ids = []

    try:
        for name, path in files:
            # 1) Upload; rely on shell-provided environment variables
            argv = [
                "rl",
                "object",
                "upload",
                "--path",
                str(path),
                "--name",
                name,
            ]
            with patch("sys.argv", argv):
                await run()

            captured = capsys.readouterr()
            # Parse object id from stdout
            m = re.search(r"Created object\s+(\S+)\s+in UPLOADING state", captured.out)
            assert m, f"did not find object id in output for {name}:\n{captured.out}"
            obj_id = m.group(1)
            created_ids.append(obj_id)
            # Ensure completion message present
            assert f"Object {obj_id} ({name}) transitioned to READ_ONLY state" in captured.out

            # 2) Download (and extract for archives)
            is_archive = any(name.endswith(ext) for ext in (".zip", ".tar.gz", ".tgz", ".zst", ".tar.zst"))
            if is_archive:
                extract_dir = tmp_path / f"extract_{name.replace('.', '_')}"
                dl_argv = [
                    "rl",
                    "object",
                    "download",
                    "--id",
                    obj_id,
                    "--path",
                    str(extract_dir),
                    "--extract",
                ]
                with patch("sys.argv", dl_argv):
                    await run()

                # Validate extracted contents based on type
                if name.endswith(".zip"):
                    assert (extract_dir / "a.txt").is_file()
                    assert (extract_dir / "b" / "b.txt").is_file()
                    assert (extract_dir / "a.txt").read_text() == "A"
                    assert (extract_dir / "b" / "b.txt").read_text() == "B"
                elif name.endswith((".tar.gz", ".tgz")):
                    assert (extract_dir / "a.txt").is_file()
                    assert (extract_dir / "b" / "b.txt").is_file()
                    assert (extract_dir / "a.txt").read_text() == "A"
                    assert (extract_dir / "b" / "b.txt").read_text() == "B"
                elif name.endswith(".tar.zst"):
                    # tar contained a.txt at root
                    assert (extract_dir / "a.txt").is_file()
                    assert (extract_dir / "a.txt").read_text() == "A"
                elif name.endswith(".zst"):
                    # single-file zst decompresses to file without .zst
                    out_name = name[: -len(".zst")]  # strip suffix
                    assert (extract_dir / out_name).is_file()
                    # We created plain.txt -> sample.txt.zst with content "ZSTD" for the test case
                    if out_name.endswith(".txt"):
                        assert (extract_dir / out_name).read_text() in ("ZSTD", "hello world", "A")
            else:
                # Non-archive: download to a file path
                dest_file = tmp_path / f"download_{name}"
                dl_argv = [
                    "rl",
                    "object",
                    "download",
                    "--id",
                    obj_id,
                    "--path",
                    str(dest_file),
                ]
                with patch("sys.argv", dl_argv):
                    await run()
                assert dest_file.is_file()
                # spot-check text and json
                if name.endswith(".txt"):
                    assert dest_file.read_text() == "hello world"
                if name.endswith(".json"):
                    assert "\"k\": \"v\"" in dest_file.read_text()

    finally:
        # Cleanup: delete created objects
        for obj_id in created_ids:
            argv = ["rl", "object", "delete", "--id", obj_id]
            with patch("sys.argv", argv):
                await run()


@pytest.mark.asyncio
async def test_missing_api_key_fails_fast():
    # Ensure key absent and any command fails fast before network calls
    with patch.dict(os.environ, {"RUNLOOP_API_KEY": ""}, clear=False):
        argv = ["rl", "object", "list"]
        with patch("sys.argv", argv), pytest.raises(RuntimeError, match="API key not found"):
            await run()


@pytest.mark.asyncio
async def test_upload_nonexistent_file_errors(tmp_path: Path):
    # Require a key so we exercise the upload path (file check happens before network)
    api_key = os.environ.get("RUNLOOP_API_KEY")
    if not api_key:
        pytest.fail("RUNLOOP_API_KEY is required for integration error tests.")

    missing = tmp_path / "does_not_exist.txt"
    argv = [
        "rl",
        "object",
        "upload",
        "--path",
        str(missing),
        "--name",
        "missing.txt",
    ]
    with patch("sys.argv", argv), pytest.raises(RuntimeError, match="File not found"):
        await run()


@pytest.mark.asyncio
async def test_download_extract_unsupported_for_plain_text(tmp_path: Path):
    # Require a key for live API
    api_key = os.environ.get("RUNLOOP_API_KEY")
    if not api_key:
        pytest.fail("RUNLOOP_API_KEY is required for integration error tests.")

    # Create and upload a plain text file
    src = _make_text(tmp_path / "plain.txt", "hello world")
    obj_id = None
    try:
        up_argv = [
            "rl",
            "object",
            "upload",
            "--path",
            str(src),
            "--name",
            "plain.txt",
        ]
        with patch("sys.argv", up_argv):
            await run()

        # Parse object id from stdout is handled in other test; we just need the id here
        # So list and search by name to retrieve latest id
        # For simplicity, call list and pick the first matching name
        # (Assumes low contention in test env)
        from rl_cli.utils import runloop_api_client

        objs = await runloop_api_client().objects.list(limit=10)
        for o in objs.objects:
            if o.name == "plain.txt":
                obj_id = o.id
                break
        assert obj_id, "failed to resolve uploaded object id"

        # Attempt to download with --extract into a dir; should fail as not an archive
        extract_dir = tmp_path / "extract_plain"
        dl_argv = [
            "rl",
            "object",
            "download",
            "--id",
            obj_id,
            "--path",
            str(extract_dir),
            "--extract",
        ]
        with patch("sys.argv", dl_argv), pytest.raises(RuntimeError, match="not a supported archive type"):
            await run()
    finally:
        if obj_id:
            del_argv = ["rl", "object", "delete", "--id", obj_id]
            with patch("sys.argv", del_argv):
                await run()


@pytest.mark.asyncio
async def test_download_extract_bad_zst_magic(tmp_path: Path):
    # Require a key for live API
    api_key = os.environ.get("RUNLOOP_API_KEY")
    if not api_key:
        pytest.fail("RUNLOOP_API_KEY is required for integration error tests.")

    # Create a file with .zst extension but no zstd compression
    bad_zst = tmp_path / "fake.zst"
    bad_zst.write_bytes(b"NOT_ZSTD")

    obj_id = None
    try:
        up_argv = [
            "rl",
            "object",
            "upload",
            "--path",
            str(bad_zst),
            "--name",
            "fake.zst",
        ]
        with patch("sys.argv", up_argv):
            await run()

        from rl_cli.utils import runloop_api_client
        objs = await runloop_api_client().objects.list(limit=10)
        for o in objs.objects:
            if o.name == "fake.zst":
                obj_id = o.id
                break
        assert obj_id, "failed to resolve uploaded object id"

        extract_dir = tmp_path / "extract_bad_zst"
        dl_argv = [
            "rl",
            "object",
            "download",
            "--id",
            obj_id,
            "--path",
            str(extract_dir),
            "--extract",
        ]
        with patch("sys.argv", dl_argv), pytest.raises(RuntimeError, match="zstd-compressed"):
            await run()
    finally:
        if obj_id:
            del_argv = ["rl", "object", "delete", "--id", obj_id]
            with patch("sys.argv", del_argv):
                await run()
