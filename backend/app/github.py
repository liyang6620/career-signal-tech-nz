import base64
import json
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .taxonomy import SKILLS


@dataclass(frozen=True)
class GithubSnapshot:
    owner: str
    repository: str
    canonical_url: str
    description: str | None
    default_branch: str | None
    stars: int
    language: str | None
    topics: list[str]
    readme: str
    files: tuple[str, ...] = ()
    artifacts: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class GithubRepositoryCandidate:
    name: str
    url: str
    description: str | None
    language: str | None
    stars: int
    updated_at: str | None


def parse_repo_url(value: str) -> tuple[str, str]:
    profile_match = re.fullmatch(r"https?://github\.com/([^/]+)/?", value.strip())
    if profile_match:
        raise ValueError(
            "Use a GitHub repository URL, not a personal profile URL. Example: https://github.com/user/repository"
        )
    match = re.fullmatch(r"https?://github\.com/([^/]+)/([^/#?]+?)/?", value.strip())
    if not match or match.group(2).endswith(".git"):
        if match and match.group(2).endswith(".git"):
            return match.group(1), match.group(2)[:-4]
        raise ValueError("Use a public GitHub repository URL")
    return match.group(1), match.group(2)


def _get_json(url: str) -> Any:
    request = Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "CareerSignal-Tech-NZ"})
    try:
        with urlopen(request, timeout=12) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise ValueError("GitHub repository could not be fetched") from exc


def _optional_json(url: str) -> Any | None:
    try:
        return _get_json(url)
    except ValueError:
        return None


def _repository_structure(owner: str, repository: str, branch: str | None) -> tuple[tuple[str, ...], dict[str, str]]:
    if not branch:
        return (), {}
    tree = _optional_json(f"https://api.github.com/repos/{owner}/{repository}/git/trees/{branch}?recursive=1")
    if not isinstance(tree, dict) or not isinstance(tree.get("tree"), list):
        return (), {}
    blobs = [item for item in tree["tree"] if item.get("type") == "blob" and item.get("path")]
    files = tuple(str(item["path"]) for item in blobs[:5000])
    priority_names = {
        "package.json": 0, "package-lock.json": 0, "yarn.lock": 0, "pnpm-lock.yaml": 0,
        "pyproject.toml": 0, "requirements.txt": 0, "requirements-dev.txt": 0,
        "poetry.lock": 0, "pipfile": 0, "pipfile.lock": 0,
        "dockerfile": 1, "docker-compose.yml": 1, "docker-compose.yaml": 1,
        "dbt_project.yml": 1, "tsconfig.json": 1, "vite.config.ts": 1, "vite.config.js": 1,
        "makefile": 2,
    }
    candidates = []
    for item in blobs:
        path = str(item["path"])
        lower = path.casefold()
        name = lower.rsplit("/", 1)[-1]
        priority = priority_names.get(name)
        if priority is None and lower.startswith(".github/workflows/") and lower.endswith((".yml", ".yaml")):
            priority = 2
        if priority is not None and item.get("sha"):
            candidates.append((priority, path.count("/"), path, str(item["sha"])))
    artifacts: dict[str, str] = {}
    for _, _, path, sha in sorted(candidates)[:16]:
        payload = _optional_json(f"https://api.github.com/repos/{owner}/{repository}/git/blobs/{sha}")
        if not isinstance(payload, dict) or payload.get("encoding") != "base64" or not payload.get("content"):
            continue
        try:
            artifacts[path] = base64.b64decode(payload["content"]).decode("utf-8", errors="replace")[:30000]
        except (TypeError, ValueError):
            continue
    return files, artifacts


def list_public_repositories(profile_url: str) -> list[GithubRepositoryCandidate]:
    match = re.fullmatch(r"https?://github\.com/([^/]+)/?", profile_url.strip())
    if not match:
        raise ValueError("Use a GitHub profile URL such as https://github.com/username")
    values = _get_json(f"https://api.github.com/users/{match.group(1)}/repos?per_page=100&sort=updated&type=owner")
    if not isinstance(values, list):
        raise ValueError("GitHub profile repositories could not be loaded")
    return [
        GithubRepositoryCandidate(
            name=item["name"],
            url=item["html_url"],
            description=item.get("description"),
            language=item.get("language"),
            stars=int(item.get("stargazers_count", 0)),
            updated_at=item.get("updated_at"),
        )
        for item in values
        if not item.get("fork") and not item.get("archived")
    ]


def fetch_snapshot(url: str) -> GithubSnapshot:
    owner, repository = parse_repo_url(url)
    repo = _get_json(f"https://api.github.com/repos/{owner}/{repository}")
    if not isinstance(repo, dict):
        raise ValueError("GitHub repository could not be fetched")
    if repo.get("private") or repo.get("archived"):
        raise ValueError("Repository must be public and active")
    readme_data = _optional_json(f"https://api.github.com/repos/{owner}/{repository}/readme")
    encoded = readme_data.get("content", "") if isinstance(readme_data, dict) else ""
    readme = base64.b64decode(encoded).decode("utf-8", errors="replace") if encoded else ""
    files, artifacts = _repository_structure(owner, repository, repo.get("default_branch"))
    return GithubSnapshot(
        owner=owner,
        repository=repository,
        canonical_url=repo["html_url"],
        description=repo.get("description"),
        default_branch=repo.get("default_branch"),
        stars=int(repo.get("stargazers_count", 0)),
        language=repo.get("language"),
        topics=repo.get("topics", [])[:20],
        readme=readme[:12000],
        files=files,
        artifacts=artifacts,
    )


def _structure_signals(snapshot: GithubSnapshot) -> dict[str, tuple[int, float, str]]:
    paths = [path.casefold() for path in snapshot.files]
    artifact_text = "\n".join(snapshot.artifacts.values())
    signals: dict[str, tuple[int, float, str]] = {}

    def add(slug: str, level: int, confidence: float, excerpt: str) -> None:
        current = signals.get(slug)
        if current is None or level * confidence > current[0] * current[1]:
            signals[slug] = (level, confidence, excerpt)

    extension_rules = {
        "python": (".py",),
        "javascript": (".js", ".jsx"),
        "typescript": (".ts", ".tsx"),
        "java": (".java",),
        "c-sharp": (".cs",),
        "sql": (".sql",),
        "terraform": (".tf",),
    }
    for slug, extensions in extension_rules.items():
        matching = [path for path in paths if path.endswith(extensions)]
        if len(matching) >= 2:
            add(slug, 3, 0.85, f"Repository contains {len(matching)} implementation files ({', '.join(matching[:3])})")

    package_text = "\n".join(
        value for path, value in snapshot.artifacts.items() if path.casefold().endswith("package.json")
    )
    python_manifest = "\n".join(
        value
        for path, value in snapshot.artifacts.items()
        if path.casefold().endswith(("pyproject.toml", "requirements.txt", "requirements-dev.txt", "poetry.lock", "pipfile", "pipfile.lock"))
    )
    if re.search(r'["\']react["\']', package_text, re.I) and any(path.endswith((".jsx", ".tsx")) for path in paths):
        add("react", 3, 0.9, "React dependency is supported by JSX/TSX implementation files")
    if re.search(r'["\']typescript["\']', package_text, re.I) and any(path.endswith((".ts", ".tsx")) for path in paths):
        add("typescript", 3, 0.9, "TypeScript dependency is supported by TS/TSX implementation files")
    if re.search(r"\bfastapi\b", python_manifest, re.I) and any(path.endswith(".py") for path in paths):
        add("fastapi", 3, 0.9, "FastAPI dependency is supported by Python implementation files")
    dependency_rules = {
        "flask": r"\bflask\b", "django": r"\bdjango\b", "pandas": r"\bpandas\b",
        "numpy": r"\bnumpy\b", "scikit-learn": r"\b(?:scikit[- ]learn|sklearn)\b",
        "matplotlib": r"\bmatplotlib\b", "next-js": r"[\"']next(?:\.js)?[\"']",
        "node-js": r"[\"']node(?:\.js)?[\"']", "tailwind": r"[\"']tailwindcss[\"']",
    }
    for slug, pattern in dependency_rules.items():
        manifest = package_text if slug in {"next-js", "node-js", "tailwind"} else python_manifest
        if not re.search(pattern, manifest, re.I):
            continue
        source_extensions = (".js", ".jsx", ".ts", ".tsx") if slug in {"next-js", "node-js", "tailwind"} else (".py",)
        if any(path.endswith(source_extensions) for path in paths):
            add(slug, 3, 0.9, f"{SKILLS[slug][0]} is declared in a dependency manifest and supported by implementation files")

    docker_files = [
        path for path in paths if path.rsplit("/", 1)[-1] in {"dockerfile", "docker-compose.yml", "docker-compose.yaml"}
    ]
    if docker_files:
        add("docker", 3, 0.95, f"Container configuration found ({', '.join(docker_files[:3])})")
    workflow_files = [
        path for path in paths if path.startswith(".github/workflows/") and path.endswith((".yml", ".yaml"))
    ]
    if workflow_files:
        add("github-actions", 3, 0.95, f"GitHub Actions workflow found ({workflow_files[0]})")
        add("ci-cd", 3, 0.85, f"Automated delivery workflow found ({workflow_files[0]})")
    test_files = [
        path
        for path in paths
        if path.startswith(("tests/", "test/", "__tests__/"))
        or "/tests/" in path
        or "/__tests__/" in path
        or re.search(r"(?:^|/)(?:test_|.*\.(?:test|spec))\w*\.(?:py|js|jsx|ts|tsx)$", path)
    ]
    if test_files:
        test_level = 4 if workflow_files else 3
        add(
            "automated-testing",
            test_level,
            0.95 if workflow_files else 0.9,
            f"{len(test_files)} test files found" + (" with CI workflow" if workflow_files else ""),
        )
    if "dbt_project.yml" in {path.rsplit("/", 1)[-1] for path in paths} and any(
        "models/" in path and path.endswith(".sql") for path in paths
    ):
        add("dbt", 3, 0.95, "dbt project configuration and SQL models found")
    if any("k8s" in path or "kubernetes" in path for path in paths) and re.search(
        r"\bkind:\s*(deployment|service)\b", artifact_text, re.I
    ):
        add("kubernetes", 3, 0.9, "Kubernetes deployment manifests found")

    # Cloud and infrastructure skills are often present only in repository
    # structure/configuration, not in the README. Keep these signals tied to
    # concrete files so a generic word in prose cannot create a false positive.
    aws_files = [
        path for path in paths
        if path.endswith((".tf", ".tfvars", "serverless.yml", "serverless.yaml"))
        or path.rsplit("/", 1)[-1].casefold() in {"template.yaml", "template.yml", "samconfig.toml"}
    ]
    if aws_files and re.search(r"\b(aws|amazonaws|serverless|cloudformation|sam)\b", artifact_text + "\n" + "\n".join(paths), re.I):
        add("aws", 3, 0.88, f"AWS infrastructure configuration found ({', '.join(aws_files[:3])})")
    terraform_files = [path for path in paths if path.endswith((".tf", ".tfvars"))]
    if terraform_files:
        add("terraform", 3, 0.9, f"Terraform configuration found ({', '.join(terraform_files[:3])})")

    if test_files and workflow_files:
        for slug in ("python", "javascript", "typescript", "react", "fastapi"):
            current = signals.get(slug)
            if current and current[0] >= 3:
                add(slug, 4, 0.9, f"{current[2]}; implementation is backed by tests and CI")
    return signals


def suggest_github_evidence(snapshot: GithubSnapshot) -> list[tuple[str, str, str, float, int]]:
    text = "\n".join(
        [
            snapshot.description or "",
            snapshot.language or "",
            " ".join(snapshot.topics),
            snapshot.readme,
            *snapshot.artifacts.values(),
        ]
    )
    structure_signals = _structure_signals(snapshot)
    results = []
    action_pattern = r"\b(built|developed|implemented|deployed|designed|created|automated|integrated|tested)\b"
    for slug, (name, category, patterns) in SKILLS.items():
        matching_lines = [
            line.strip()
            for line in text.splitlines()
            if line.strip() and any(re.search(pattern, line, re.I) for pattern in patterns)
        ]
        structural = structure_signals.get(slug)
        if not matching_lines and structural is None:
            continue
        excerpt = matching_lines[0] if matching_lines else structural[2]
        level = 3 if re.search(action_pattern, excerpt, re.I) else 2
        confidence = 0.85 if level == 3 else 0.72
        if structural and structural[0] * structural[1] > level * confidence:
            level, confidence, excerpt = structural
        results.append((name, category, excerpt[:400], confidence, level))
    return results
