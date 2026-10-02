# ruff: noqa: E501

from app.role_decoder import decode_role


def test_multi_track_advert_is_not_forced_into_one_family() -> None:
    decoded = decode_role(
        "Engineering Summer Interns",
        """
        Software and AI interns need strong Python and JavaScript or TypeScript fundamentals.
        The AI focus uses LLM APIs, RAG, embeddings and vector databases.
        The web focus builds web applications and REST APIs with SQL and Git.
        Experience with Docker is useful.
        """,
    )

    matches = dict(decoded.role_matches)
    assert decoded.scope_status == "mixed"
    assert matches["ai"] >= 65
    assert matches["software"] >= 50
    assert {signal.slug for signal in decoded.skill_signals} >= {"python", "llm", "rag", "rest-api", "sql"}
    assert all(signal.mention_count > 0 for signal in decoded.skill_signals)


def test_out_of_scope_advert_is_reported_without_false_confidence() -> None:
    decoded = decode_role(
        "Hydraulic Hose Technician",
        "Repair mobile hydraulic hoses, inspect fittings and operate workshop machinery on customer sites.",
    )

    assert decoded.scope_status == "out_of_scope"
    assert decoded.confidence == 0
    assert decoded.role_label == "Outside current role taxonomy"


def test_requirement_context_is_scoped_to_the_skill_sentence() -> None:
    decoded = decode_role(
        "Software Intern",
        "Working knowledge of Git and SQL is required. Bonus exposure to AWS, Docker or data visualisation libraries.",
    )
    signals = {signal.slug: signal for signal in decoded.skill_signals}

    assert signals["git"].importance == "essential"
    assert signals["sql"].importance == "essential"
    assert signals["aws"].importance == "supporting"
    assert signals["data-visualisation"].importance == "supporting"
    assert signals["data-visualisation"].mention_count == 1


def test_eligibility_requirements_are_extracted_without_becoming_skills() -> None:
    decoded = decode_role(
        "Graduate Software Engineer",
        """
        Applicants must be New Zealand citizens and able to obtain a national security clearance.
        A full NZ driver's licence is required. A bachelor's degree in computer science is preferred.
        You must be eligible to work in New Zealand. Experience with Python and Git is essential.
        """,
    )

    requirements = {(item.category, item.importance) for item in decoded.eligibility_requirements}
    assert ("citizenship", "required") in requirements
    assert ("security-clearance", "required") in requirements
    assert ("driver-licence", "required") in requirements
    assert ("qualification", "preferred") in requirements
    assert ("work-authorisation", "required") in requirements
    assert all("Python" not in item.excerpt for item in decoded.eligibility_requirements)


def test_eligibility_extraction_does_not_infer_unstated_requirements() -> None:
    decoded = decode_role(
        "Data Analyst",
        "Build Power BI dashboards, write SQL queries, and explain insights to stakeholders.",
    )

    assert decoded.eligibility_requirements == []


def test_explicit_platform_and_capability_lists_are_not_dropped() -> None:
    decoded = decode_role(
        "Data & Systems Analyst",
        """
        Full Time, Monday to Friday
        - Manukau based

        **Turn complex data into smarter systems and better outcomes.**
        **&#xA0;**&#x57;e’re looking for a Data & Systems Analyst who enjoys getting to the bottom of complex data and systems.

        **Key to your success will be your ability to demonstrate the following skills:**
        - Experience working with complex data, such as geospatial data, big data and ETL (Extract, Transform, Load) processing
        - A strong ability to understand and navigate complex systems
        - A naturally analytical mindset and the ability to identify patterns, inconsistencies and potential issues
        - The ability to spot where data could go wrong before it does and take a proactive approach to problem solving
        - Strong attention to detail and a practical, solutions-focused approach
        - The curiosity and persistence to investigate a problem, understand the root cause and work out how to resolve it

        **An ideal applicant will have experience in one or more of the following platforms:**
        - Typescript/Javascript
        - Ruby on Rails
        - Python
        - Excel
        - MS Access
        - PostgresSQL
        """,
    )

    signals = {signal.slug: signal for signal in decoded.skill_signals}
    expected = {
        "geospatial-data", "big-data", "etl", "systems-analysis", "analytical-reasoning",
        "data-quality", "problem-solving", "attention-to-detail", "root-cause-analysis",
        "typescript", "javascript", "ruby-on-rails", "python", "excel", "ms-access", "postgresql",
    }
    assert expected <= signals.keys()
    assert all(signals[slug].importance == "essential" for slug in {
        "geospatial-data", "big-data", "etl", "systems-analysis", "analytical-reasoning",
        "data-quality", "problem-solving", "attention-to-detail", "root-cause-analysis",
    })
    assert all(signals[slug].importance == "supporting" for slug in {
        "typescript", "javascript", "ruby-on-rails", "python", "excel", "ms-access", "postgresql",
    })
    assert decoded.role_matches[0][0] == "data-analyst"
