from types import SimpleNamespace

from app.storage import ensure_bucket


class FakeClient:
    class exceptions:
        ClientError = RuntimeError

    def __init__(self) -> None:
        self.cors_calls = 0

    def head_bucket(self, **_kwargs) -> None:
        pass

    def put_bucket_cors(self, **_kwargs) -> None:
        self.cors_calls += 1


def test_ensure_bucket_skips_cors_when_platform_manages_it(monkeypatch) -> None:
    client = FakeClient()
    settings = SimpleNamespace(
        storage_bucket="career-signal-private",
        storage_manage_cors=False,
        allowed_origins=["https://career-signal-tech-nz.pages.dev"],
    )
    monkeypatch.setattr("app.storage.get_settings", lambda: settings)
    monkeypatch.setattr("app.storage.internal_client", lambda: client)

    ensure_bucket()

    assert client.cors_calls == 0


def test_ensure_bucket_configures_cors_by_default(monkeypatch) -> None:
    client = FakeClient()
    settings = SimpleNamespace(
        storage_bucket="career-signal-private",
        storage_manage_cors=True,
        allowed_origins=["http://localhost:5173"],
    )
    monkeypatch.setattr("app.storage.get_settings", lambda: settings)
    monkeypatch.setattr("app.storage.internal_client", lambda: client)

    ensure_bucket()

    assert client.cors_calls == 1
