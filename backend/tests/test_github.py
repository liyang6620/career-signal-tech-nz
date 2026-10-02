from app.github import GithubSnapshot, suggest_github_evidence


def test_repository_structure_produces_implementation_and_verification_evidence() -> None:
    snapshot = GithubSnapshot(
        owner="candidate",
        repository="product-app",
        canonical_url="https://github.com/candidate/product-app",
        description="Customer workflow product",
        default_branch="main",
        stars=4,
        language="TypeScript",
        topics=["react"],
        readme="Built and deployed a customer-facing application.",
        files=(
            "package.json",
            "src/App.tsx",
            "src/api.ts",
            "tests/App.test.tsx",
            ".github/workflows/ci.yml",
            "Dockerfile",
        ),
        artifacts={
            "package.json": '{"dependencies":{"react":"latest"},"devDependencies":{"typescript":"latest"}}',
            ".github/workflows/ci.yml": "steps:\n  - run: npm test",
            "Dockerfile": "FROM node:22-alpine",
        },
    )

    suggestions = {item[0]: item for item in suggest_github_evidence(snapshot)}

    assert suggestions["React"][4] == 4
    assert suggestions["TypeScript"][4] == 4
    assert suggestions["Automated Testing"][4] == 4
    assert suggestions["Docker"][4] == 3
    assert suggestions["GitHub Actions"][4] == 3
