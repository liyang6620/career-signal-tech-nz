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


def test_dependency_manifests_surface_data_and_backend_stack() -> None:
    snapshot = GithubSnapshot(
        owner="candidate",
        repository="analytics-api",
        canonical_url="https://github.com/candidate/analytics-api",
        description="Analytics API",
        default_branch="main",
        stars=0,
        language="Python",
        topics=["analytics"],
        readme="",
        files=("requirements.txt", "src/main.py", "src/model.py", "tests/test_model.py"),
        artifacts={"requirements.txt": "fastapi\npandas\nnumpy\nscikit-learn\nmatplotlib\n"},
    )
    suggestions = {item[0]: item for item in suggest_github_evidence(snapshot)}
    assert suggestions["FastAPI"][4] == 3
    assert suggestions["Pandas"][4] == 3
    assert suggestions["NumPy"][4] == 3
    assert suggestions["scikit-learn"][4] == 3
    assert suggestions["Matplotlib"][4] == 3


def test_infrastructure_files_surface_cloud_and_terraform_evidence() -> None:
    snapshot = GithubSnapshot(
        owner="candidate",
        repository="infra-service",
        canonical_url="https://github.com/candidate/infra-service",
        description="",
        default_branch="main",
        stars=0,
        language="HCL",
        topics=[],
        readme="",
        files=("main.tf", "variables.tf", "serverless.yml", ".github/workflows/deploy.yml"),
        artifacts={
            "main.tf": 'provider "aws" {}\nresource "aws_lambda_function" "api" {}',
            "serverless.yml": "provider: aws",
        },
    )
    suggestions = {item[0]: item for item in suggest_github_evidence(snapshot)}
    assert suggestions["AWS"][4] == 3
    assert suggestions["Terraform"][4] == 3
