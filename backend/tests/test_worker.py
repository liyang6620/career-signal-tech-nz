from docx import Document
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.extraction import PARSER_VERSION, ParsedDocument, SuggestedEvidence, parse_document, suggest_evidence
from app.models import (
    CandidateSkillEvidence,
    CanonicalSkill,
    DocumentExtraction,
    EvidenceSuggestion,
    EvidenceUpload,
    User,
)
from app.worker import malware_verdict, persist_parsed_evidence, valid_file_signature


def test_file_signatures_match_declared_type() -> None:
    assert valid_file_signature("application/pdf", b"%PDF")
    assert valid_file_signature(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        b"PK\x03\x04",
    )
    assert not valid_file_signature("application/pdf", b"PK\x03\x04")
    assert not valid_file_signature("application/octet-stream", b"%PDF")


def test_trusted_demo_mode_skips_clamav(monkeypatch) -> None:
    class DemoSettings:
        malware_scan_mode = "trusted_demo"
        clamav_host = "must-not-connect"
        clamav_port = 3310

    def fail_if_called(*_args, **_kwargs):
        raise AssertionError("trusted_demo must not connect to ClamAV")

    monkeypatch.setattr("app.worker.clamd.ClamdNetworkSocket", fail_if_called)
    verdict, signature = malware_verdict(object(), "demo-upload", DemoSettings())

    assert verdict == "OK"
    assert signature is None


def test_docx_parsing_and_evidence_suggestions(tmp_path) -> None:
    path = tmp_path / "resume.docx"
    document = Document()
    document.add_heading("Experience", level=1)
    document.add_paragraph("Built a FastAPI service with PostgreSQL and Docker, deployed through GitHub Actions.")
    document.save(path)

    parsed = parse_document(
        path,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    suggestions = {item.skill: item for item in suggest_evidence(parsed.text)}

    assert parsed.character_count > 20
    assert len(parsed.text_sha256) == 64
    assert suggestions["FastAPI"].proposed_level == 5
    assert suggestions["PostgreSQL"].excerpt.startswith("Built")
    assert suggestions["Docker"].confidence > 0.85
    assert "GitHub Actions" in suggestions


def test_cv_extraction_uses_the_strongest_context_instead_of_first_mention() -> None:
    text = """Technical Skills
Python, SQL, Power BI
Projects
Built a Python data pipeline with validation checks for 20,000 records.
Used SQL to query customer orders.
"""
    suggestions = {item.skill: item for item in suggest_evidence(text)}

    assert suggestions["Power BI"].proposed_level == 1
    assert suggestions["Python"].proposed_level == 4
    assert suggestions["Python"].locator.startswith("Projects")
    assert suggestions["SQL"].proposed_level == 2
    assert suggestions["Python"].confidence > suggestions["Power BI"].confidence


def test_project_title_uses_wrapped_description_without_inflating_github_link() -> None:
    text = """KEY PROJECTS
AI Data Workspace | Streamlit · Python | 2026
Developed a data analytics platform for natural language exploration and reporting. GitHub
Key Achievements:
* Built an end-to-end analytics workflow.
"""
    suggestions = {item.skill: item for item in suggest_evidence(text)}

    assert suggestions["Python"].proposed_level == 3
    assert suggestions["Python"].excerpt.startswith("AI Data Workspace")
    assert "Developed a data analytics platform" in suggestions["Python"].excerpt
    assert suggestions["Git"].proposed_level == 1


def test_parser_upgrade_refreshes_confirmed_evidence_without_overriding_review() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    with testing_session() as db:
        user = User(email="candidate@example.com", password_hash="hash", display_name="Candidate", is_verified=True)
        db.add_all([
            user,
            CanonicalSkill(slug="power-bi", name="Power BI", category="Analytics"),
            CanonicalSkill(slug="python", name="Python", category="Programming"),
        ])
        db.flush()
        upload = EvidenceUpload(
            user_id=user.id,
            storage_key="users/example/evidence/resume.pdf",
            original_filename="resume.pdf",
            content_type="application/pdf",
            expected_size=100,
            actual_size=100,
            status="reviewed",
        )
        db.add(upload)
        db.flush()
        extraction = DocumentExtraction(
            upload_id=upload.id,
            parser_version="local-taxonomy-v1",
            text_sha256="a" * 64,
            character_count=100,
            page_count=1,
        )
        db.add(extraction)
        db.flush()
        suggestion = EvidenceSuggestion(
            extraction_id=extraction.id,
            canonical_skill="Power BI",
            category="Analytics",
            excerpt="Power BI",
            locator="line 3",
            confidence=0.75,
            proposed_level=2,
            review_status="confirmed",
        )
        db.add(suggestion)
        db.flush()
        evidence = CandidateSkillEvidence(
            user_id=user.id,
            upload_id=upload.id,
            suggestion_id=suggestion.id,
            skill_slug="power-bi",
            evidence_level=2,
            confidence=0.75,
            excerpt="Power BI",
            locator="line 3",
            source_type="cv",
        )
        db.add(evidence)
        db.commit()

        parsed = ParsedDocument(text="updated", text_sha256="b" * 64, character_count=240, page_count=2)
        refreshed = [
            SuggestedEvidence(
                "Power BI",
                "Analytics",
                "Built a Power BI dashboard for weekly sales reporting",
                "Projects, line 12",
                0.86,
                3,
            ),
            SuggestedEvidence(
                "Python",
                "Programming",
                "Used Python to validate source data",
                "Projects, line 14",
                0.74,
                2,
            ),
        ]
        persist_parsed_evidence(db, upload, parsed, refreshed)
        db.commit()

        assert extraction.parser_version == PARSER_VERSION
        assert evidence.evidence_level == 3
        assert evidence.excerpt.startswith("Built")
        assert suggestion.review_status == "confirmed"
        assert upload.status == "awaiting_review"
        python_suggestion = db.scalar(
            select(EvidenceSuggestion).where(EvidenceSuggestion.canonical_skill == "Python")
        )
        assert python_suggestion is not None
        assert python_suggestion.review_status == "pending"
    Base.metadata.drop_all(engine)
