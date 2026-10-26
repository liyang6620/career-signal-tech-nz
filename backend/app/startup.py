import logging
import time
from collections.abc import Callable

from sqlalchemy import text

from .config import get_settings
from .database import engine


class DependencyStartupError(RuntimeError):
    """Raised after a required startup dependency exhausts its retry budget."""


def retry_dependency[Result](
    name: str,
    operation: Callable[[], Result],
    *,
    logger: logging.Logger,
    attempts: int | None = None,
    initial_delay_seconds: float | None = None,
    max_delay_seconds: float | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> Result:
    settings = get_settings()
    total_attempts = attempts or settings.startup_retry_attempts
    delay = initial_delay_seconds or settings.startup_retry_initial_seconds
    max_delay = max_delay_seconds or settings.startup_retry_max_seconds
    last_error: Exception | None = None

    for attempt in range(1, total_attempts + 1):
        try:
            result = operation()
            if attempt > 1:
                logger.info("%s became available on startup attempt %s/%s", name, attempt, total_attempts)
            return result
        except Exception as exc:  # dependency libraries raise different connection errors
            last_error = exc
            if attempt == total_attempts:
                break
            logger.warning(
                "%s is unavailable on startup attempt %s/%s (%s). Retrying in %.1fs.",
                name,
                attempt,
                total_attempts,
                exc,
                delay,
            )
            sleep(delay)
            delay = min(max_delay, delay * 1.5)

    message = f"{name} remained unavailable after {total_attempts} startup attempts"
    raise DependencyStartupError(message) from last_error


def wait_for_database(*, logger: logging.Logger) -> None:
    def check() -> None:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except Exception:
            engine.dispose()
            raise

    retry_dependency("database", check, logger=logger)
