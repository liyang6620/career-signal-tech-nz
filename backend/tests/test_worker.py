from app.worker import valid_file_signature


def test_file_signatures_match_declared_type() -> None:
    assert valid_file_signature("application/pdf", b"%PDF")
    assert valid_file_signature(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        b"PK\x03\x04",
    )
    assert not valid_file_signature("application/pdf", b"PK\x03\x04")
    assert not valid_file_signature("application/octet-stream", b"%PDF")
