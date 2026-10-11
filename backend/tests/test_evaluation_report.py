from app.evaluation_report import build_report


def test_labelled_evaluation_report_stays_machine_readable() -> None:
    report = build_report()

    assert report["jd_case_count"] >= 4
    assert report["cv_case_count"] >= 4
    for name, value in report.items():
        if name.endswith(("accuracy", "recall")):
            assert value == 1.0, name
