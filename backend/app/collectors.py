import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from html import unescape
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class CollectedPosting:
    source_url: str
    title: str
    company: str
    location: str
    description: str
    published_at: datetime | None


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data.strip())


class JsonLdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_json_ld = False
        self.blocks: list[str] = []
        self.current: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        self.in_json_ld = tag == "script" and values.get("type", "").casefold() == "application/ld+json"
        if self.in_json_ld:
            self.current = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self.in_json_ld:
            self.blocks.append("".join(self.current))
            self.current = []
            self.in_json_ld = False

    def handle_data(self, data: str) -> None:
        if self.in_json_ld:
            self.current.append(data)


def plain_text(value: str) -> str:
    parser = TextParser()
    parser.feed(unescape(value))
    return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()


def fetch_json(url: str) -> object:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "CareerSignal-Tech-NZ/0.1"})
    try:
        with urlopen(request, timeout=20) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError("Collector source request failed") from exc


def post_json(url: str, payload: dict[str, object]) -> object:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "CareerSignal-Tech-NZ/0.1",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=20) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError("Collector source request failed") from exc


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except ValueError:
        return None


def collect_greenhouse(board: str, company: str) -> list[CollectedPosting]:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", board):
        raise ValueError("Invalid Greenhouse board identifier")
    data = fetch_json(f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true")
    return [
        CollectedPosting(
            source_url=item["absolute_url"], title=item["title"], company=company,
            location=item.get("location", {}).get("name", "New Zealand"),
            description=plain_text(item.get("content", "")), published_at=parse_datetime(item.get("updated_at")),
        )
        for item in data.get("jobs", [])
    ]


def collect_lever(site: str, company: str) -> list[CollectedPosting]:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", site):
        raise ValueError("Invalid Lever site identifier")
    data = fetch_json(f"https://api.lever.co/v0/postings/{site}?mode=json")
    return [
        CollectedPosting(
            source_url=item["hostedUrl"], title=item["text"], company=company,
            location=item.get("categories", {}).get("location", "New Zealand"),
            description=plain_text(f"{item.get('description', '')} {item.get('additional', '')}"), published_at=None,
        )
        for item in data
    ]


def collect_ashby(board: str, company: str) -> list[CollectedPosting]:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", board):
        raise ValueError("Invalid Ashby board identifier")
    data = fetch_json(f"https://api.ashbyhq.com/posting-api/job-board/{board}")
    return [
        CollectedPosting(
            source_url=item["jobUrl"],
            title=item["title"],
            company=company,
            location=item.get("location", "New Zealand"),
            description=item.get("descriptionPlain") or plain_text(item.get("descriptionHtml", "")),
            published_at=parse_datetime(item.get("publishedAt")),
        )
        for item in data.get("jobs", [])
        if item.get("isListed", True)
    ]


def collect_smartrecruiters(company_identifier: str, company: str) -> list[CollectedPosting]:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", company_identifier):
        raise ValueError("Invalid SmartRecruiters company identifier")
    base_url = f"https://api.smartrecruiters.com/v1/companies/{company_identifier}/postings"
    first_page = fetch_json(f"{base_url}?limit=100&offset=0")
    summaries = list(first_page.get("content", []))
    total = min(int(first_page.get("totalFound", len(summaries))), 1000)
    for offset in range(100, total, 100):
        page = fetch_json(f"{base_url}?limit=100&offset={offset}")
        summaries.extend(page.get("content", []))

    postings: list[CollectedPosting] = []
    for summary in summaries:
        summary_location = summary.get("location", {}).get("fullLocation", "")
        if summary_location and not is_new_zealand_location(summary_location):
            continue
        reference = summary.get("ref")
        if not reference:
            continue
        detail = fetch_json(reference)
        if not detail.get("active", True) or detail.get("visibility", "PUBLIC") != "PUBLIC":
            continue
        sections = detail.get("jobAd", {}).get("sections", {})
        description = " ".join(
            section.get("text", "")
            for section in sections.values()
            if isinstance(section, dict)
        )
        location = detail.get("location", {})
        postings.append(CollectedPosting(
            source_url=detail.get("postingUrl") or summary.get("postingUrl") or reference,
            title=detail.get("name") or summary.get("name", "Untitled role"),
            company=company,
            location=location.get("fullLocation") or summary.get("location", {}).get("fullLocation", ""),
            description=plain_text(description),
            published_at=parse_datetime(detail.get("releasedDate") or summary.get("releasedDate")),
        ))
    return postings


def _workday_board(identifier: str) -> tuple[str, str, str]:
    parsed = urlparse(identifier)
    hostname = (parsed.hostname or "").casefold()
    if parsed.scheme != "https" or not hostname.endswith(".myworkdayjobs.com"):
        raise ValueError("Workday identifier must be a public myworkdayjobs.com board URL")
    tenant = hostname.split(".", 1)[0]
    site = parsed.path.strip("/").split("/", 1)[0]
    if not re.fullmatch(r"[a-z0-9_-]+", tenant) or not re.fullmatch(r"[A-Za-z0-9_-]+", site):
        raise ValueError("Invalid Workday board URL")
    return f"{parsed.scheme}://{parsed.netloc}", tenant, site


def collect_workday(identifier: str, company: str) -> list[CollectedPosting]:
    origin, tenant, site = _workday_board(identifier)
    api_root = f"{origin}/wday/cxs/{tenant}/{site}"
    summaries: list[dict] = []
    offset = 0
    while offset < 1000:
        page = post_json(
            f"{api_root}/jobs",
            {"appliedFacets": {}, "limit": 20, "offset": offset, "searchText": ""},
        )
        batch = page.get("jobPostings", [])
        summaries.extend(batch)
        offset += len(batch)
        if not batch or offset >= int(page.get("total", len(summaries))):
            break

    postings: list[CollectedPosting] = []
    for summary in summaries:
        external_path = summary.get("externalPath")
        if not external_path or not external_path.startswith("/job/"):
            continue
        detail = fetch_json(f"{api_root}{external_path}").get("jobPostingInfo", {})
        postings.append(CollectedPosting(
            source_url=detail.get("externalUrl") or f"{origin}/{site}{external_path}",
            title=detail.get("title") or summary.get("title", "Untitled role"),
            company=company,
            location=detail.get("location", ""),
            description=plain_text(detail.get("jobDescription", "")),
            published_at=parse_datetime(detail.get("startDate")),
        ))
    return postings


def collect_workable(account: str, company: str) -> list[CollectedPosting]:
    if not re.fullmatch(r"[a-z0-9-]+", account):
        raise ValueError("Invalid Workable account identifier")
    list_url = f"https://apply.workable.com/api/v3/accounts/{account}/jobs"
    payload: dict[str, object] = {
        "query": "",
        "location": [],
        "department": [],
        "worktype": [],
        "remote": [],
    }
    summaries: list[dict] = []
    for _ in range(100):
        page = post_json(list_url, payload)
        summaries.extend(page.get("results", []))
        token = page.get("nextPage")
        if not token:
            break
        payload["token"] = token

    postings: list[CollectedPosting] = []
    for summary in summaries:
        summary_location = summary.get("location", {})
        if summary_location.get("countryCode", "").upper() != "NZ":
            continue
        shortcode = summary.get("shortcode")
        if not shortcode or not re.fullmatch(r"[A-Za-z0-9]+", shortcode):
            continue
        detail = fetch_json(f"https://apply.workable.com/api/v2/accounts/{account}/jobs/{shortcode}")
        if detail.get("state") != "published" or detail.get("isInternal", False):
            continue
        location = detail.get("location", {})
        location_label = ", ".join(
            filter(None, [location.get("city"), location.get("region"), location.get("country")])
        )
        description = " ".join(
            detail.get(field, "") for field in ("description", "requirements", "benefits")
        )
        postings.append(CollectedPosting(
            source_url=f"https://apply.workable.com/{account}/j/{shortcode}/",
            title=detail.get("title") or summary.get("title", "Untitled role"),
            company=company,
            location=location_label,
            description=plain_text(description),
            published_at=parse_datetime(detail.get("published")),
        ))
    return postings


def collect_schema_org(url: str, company: str) -> list[CollectedPosting]:
    parsed_url = urlparse(url)
    if parsed_url.scheme != "https" or not parsed_url.hostname:
        raise ValueError("Schema.org source must be a public HTTPS URL")
    request = Request(url, headers={"User-Agent": "CareerSignal-Tech-NZ/0.1"})
    try:
        with urlopen(request, timeout=20) as response:
            html = response.read(2_000_000).decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError("Collector source request failed") from exc
    parser = JsonLdParser()
    parser.feed(html)
    postings: list[CollectedPosting] = []
    for block in parser.blocks:
        try:
            value = json.loads(block)
        except json.JSONDecodeError:
            continue
        candidates = value if isinstance(value, list) else value.get("@graph", [value])
        for item in candidates:
            if not isinstance(item, dict):
                continue
            item_types = item.get("@type", [])
            if isinstance(item_types, str):
                item_types = [item_types]
            if "JobPosting" not in item_types:
                continue
            raw_locations = item.get("jobLocation", [])
            if isinstance(raw_locations, dict):
                raw_locations = [raw_locations]
            location_parts: list[str] = []
            for raw_location in raw_locations:
                if not isinstance(raw_location, dict):
                    continue
                address = raw_location.get("address", {})
                if not isinstance(address, dict):
                    continue
                label = ", ".join(
                    filter(
                        None,
                        [address.get("addressLocality"), address.get("addressRegion"), address.get("addressCountry")],
                    )
                )
                if label:
                    location_parts.append(label)
            location = "; ".join(location_parts)
            postings.append(CollectedPosting(
                source_url=item.get("url", url), title=item.get("title", "Untitled role"), company=company,
                location=location or "New Zealand", description=plain_text(item.get("description", "")),
                published_at=parse_datetime(item.get("datePosted")),
            ))
    return postings


def collect(adapter: str, identifier: str, company: str) -> list[CollectedPosting]:
    if adapter == "greenhouse":
        return collect_greenhouse(identifier, company)
    if adapter == "lever":
        return collect_lever(identifier, company)
    if adapter == "ashby":
        return collect_ashby(identifier, company)
    if adapter == "smartrecruiters":
        return collect_smartrecruiters(identifier, company)
    if adapter == "workday":
        return collect_workday(identifier, company)
    if adapter == "workable":
        return collect_workable(identifier, company)
    if adapter == "schema-org":
        return collect_schema_org(identifier, company)
    raise ValueError("Unknown collector adapter")


NZ_LOCATION_TERMS = (
    "new zealand",
    "aotearoa",
    "auckland",
    "wellington",
    "christchurch",
    "hamilton",
    "tauranga",
    "dunedin",
    "palmerston north",
    "napier",
    "nelson",
    "queenstown",
    "remote nz",
    "nz remote",
)


def is_new_zealand_location(location: str) -> bool:
    normalized = re.sub(r"[^a-z0-9]+", " ", location.casefold()).strip()
    if normalized == "nz" or any(term in normalized for term in NZ_LOCATION_TERMS):
        return True
    return bool(re.search(r"(^| )nz($| )", normalized))
