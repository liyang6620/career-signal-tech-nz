import importlib.util
from pathlib import Path

from app.taxonomy import SKILLS


def test_latest_taxonomy_migration_contains_every_application_skill() -> None:
    migration_path = (
        Path(__file__).parents[1]
        / "migrations"
        / "versions"
        / "20260924_11_sync_skill_taxonomy.py"
    )
    spec = importlib.util.spec_from_file_location("taxonomy_migration", migration_path)
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    migrated_slugs = {slug for slug, _, _ in migration.SKILLS}
    assert migrated_slugs == set(SKILLS)
