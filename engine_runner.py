"""Entry point for PyInstaller bundle - imports and runs the IPC bridge."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from payload_revealer.engine.ipc_bridge import run_ipc

if __name__ == "__main__":
    run_ipc()
