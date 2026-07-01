# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

project_root = Path(SPECPATH)

a = Analysis(
    [str(project_root / "engine_runner.py")],
    pathex=[str(project_root)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "payload_revealer",
        "payload_revealer.engine",
        "payload_revealer.engine.sweeper",
        "payload_revealer.engine.classifier",
        "payload_revealer.engine.payload_extractor",
        "payload_revealer.engine.export_engine",
        "payload_revealer.engine.word_counter",
        "payload_revealer.engine.ipc_bridge",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "test", "unittest", "pytest", "setuptools", "pip", "distutils", "PIL", "Pillow",
              "matplotlib", "scipy", "numpy", "pandas"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="payload_revealer_engine",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    contents_directory=".",
)
