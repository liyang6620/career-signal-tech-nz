import logging

import pytest

from app.startup import DependencyStartupError, retry_dependency


def test_retry_dependency_uses_bounded_backoff_and_recovers() -> None:
    attempts = 0
    delays: list[float] = []

    def operation() -> str:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise ConnectionError("database is starting")
        return "ready"

    result = retry_dependency(
        "database",
        operation,
        logger=logging.getLogger("test"),
        attempts=5,
        initial_delay_seconds=1,
        max_delay_seconds=2,
        sleep=delays.append,
    )

    assert result == "ready"
    assert attempts == 3
    assert delays == [1, 1.5]


def test_retry_dependency_exits_after_the_configured_attempts() -> None:
    attempts = 0
    delays: list[float] = []

    def operation() -> None:
        nonlocal attempts
        attempts += 1
        raise ConnectionError("database is unavailable")

    with pytest.raises(DependencyStartupError, match="database remained unavailable after 3 startup attempts"):
        retry_dependency(
            "database",
            operation,
            logger=logging.getLogger("test"),
            attempts=3,
            initial_delay_seconds=2,
            max_delay_seconds=3,
            sleep=delays.append,
        )

    assert attempts == 3
    assert delays == [2, 3]
