from types import SimpleNamespace

from app.main import comparison_skill_demands, saved_job_comparison_facts


def test_saved_job_comparison_extracts_decision_factors_from_short_advert() -> None:
    job = SimpleNamespace(
        title="Software Engineer — Kiwibank",
        company="Employer not specified",
        location="Auckland",
        description=(
            "Kiwibank is hiring a Software Engineer in Auckland CBD on a hybrid 18-month fixed term contract. "
            "Join a digital transformation journey building integrations. Full-time role with salary of "
            "approximately NZ$80,000–$120,000 per year."
        ),
    )

    facts = {fact["label"]: fact["value"] for fact in saved_job_comparison_facts(job)}

    assert facts == {
        "Employer": "Kiwibank",
        "Location": "Auckland",
        "Compensation": "NZ$80,000–$120,000 per year",
        "Work model": "Hybrid",
        "Engagement": "Full-time · fixed term",
        "Advert signal": "Digital transformation and integration delivery",
    }


def test_empty_technical_requirements_use_labelled_role_benchmark() -> None:
    demands, used_benchmark = comparison_skill_demands("software", [])

    assert used_benchmark is True
    assert demands
    assert {item["signal_source"] for item in demands} == {"role_benchmark"}

