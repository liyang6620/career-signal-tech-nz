import logging
import signal
import subprocess
import sys
import threading
from pathlib import Path

from .config import get_settings
from .startup import DependencyStartupError, wait_for_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run() -> int:
    ready_file = Path(get_settings().api_ready_file)
    ready_file.unlink(missing_ok=True)
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    )

    def stop_server(signum: int, _frame: object) -> None:
        if server.poll() is None:
            server.send_signal(signum)

    signal.signal(signal.SIGTERM, stop_server)
    signal.signal(signal.SIGINT, stop_server)

    def initialize() -> None:
        try:
            wait_for_database(logger=logger)
            logger.info("Database is reachable; applying Alembic migrations.")
            subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
            ready_file.write_text("ready\n", encoding="ascii")
            logger.info("API startup dependencies and migrations are ready.")
        except (DependencyStartupError, subprocess.CalledProcessError) as exc:
            logger.critical("API startup failed: %s", exc, exc_info=True)
            if server.poll() is None:
                server.terminate()

    threading.Thread(target=initialize, name="api-bootstrap", daemon=True).start()

    try:
        return server.wait()
    finally:
        ready_file.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(run())
