import base64
import json
import re
from dataclasses import dataclass
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


def parse_repo_url(value: str) -> tuple[str, str]:
    match = re.fullmatch(r"https?://github\.com/([^/]+)/([^/#?]+?)/?", value.strip())
    if not match or match.group(2).endswith(".git"):
        if match and match.group(2).endswith(".git"):
            return match.group(1), match.group(2)[:-4]
        raise ValueError("Use a public GitHub repository URL")
    return match.group(1), match.group(2)


def _get_json(url: str) -> dict:
    request = Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "CareerSignal-Tech-NZ"})
    try:
        with urlopen(request, timeout=12) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise ValueError("GitHub repository could not be fetched") from exc


def fetch_snapshot(url: str) -> GithubSnapshot:
    owner, repository = parse_repo_url(url)
    repo = _get_json(f"https://api.github.com/repos/{owner}/{repository}")
    if repo.get("private") or repo.get("archived"):
        raise ValueError("Repository must be public and active")
    readme_data = _get_json(f"https://api.github.com/repos/{owner}/{repository}/readme")
    encoded = readme_data.get("content", "")
    readme = base64.b64decode(encoded).decode("utf-8", errors="replace") if encoded else ""
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
    )


def suggest_github_evidence(snapshot: GithubSnapshot) -> list[tuple[str, str, str, float, int]]:
    text = "\n".join([snapshot.description or "", snapshot.language or "", " ".join(snapshot.topics), snapshot.readme])
    results = []
    for _, (name, category, patterns) in SKILLS.items():
        if any(re.search(pattern, text, re.I) for pattern in patterns):
            matching_lines = (
                line.strip()
                for line in text.splitlines()
                if any(re.search(pattern, line, re.I) for pattern in patterns)
            )
            excerpt = next(matching_lines, name)
            results.append((name, category, excerpt[:400], 0.7, 2))
    return results
