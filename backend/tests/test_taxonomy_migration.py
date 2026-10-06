import importlib.util
from pathlib import Path

from app.taxonomy import SKILLS


def load_migration(filename: str, module_name: str):
    migration_path = Path(__file__).parents[1] / "migrations" / "versions" / filename
    spec = importlib.util.spec_from_file_location(module_name, migration_path)
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


def test_latest_taxonomy_migration_contains_every_application_skill() -> None:
    base = load_migration("20260924_11_sync_skill_taxonomy.py", "taxonomy_migration_base")
    backfill = load_migration("20261006_17_backfill_skill_taxonomy.py", "taxonomy_migration_backfill")
    migrated_slugs = {slug for slug, _, _ in (*base.SKILLS, *backfill.SKILLS)}
    assert migrated_slugs == set(SKILLS)


def test_backfill_is_in_a_new_revision_for_already_upgraded_databases() -> None:
    backfill = load_migration("20261006_17_backfill_skill_taxonomy.py", "taxonomy_migration_revision")
    assert backfill.down_revision == "20261005_16"
    assert {slug for slug, _, _ in backfill.SKILLS} == {
        "html", "css", "tailwind", "next-js", "flask", "django",
        "pandas", "numpy", "scikit-learn", "matplotlib", "linux", "bash",
    }
