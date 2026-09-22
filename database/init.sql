CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS sources (
    id BIGSERIAL PRIMARY KEY,
    canonical_url TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL,
    permission_basis TEXT NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    content_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    role_family TEXT,
    location TEXT,
    seniority TEXT,
    title TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    raw_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS documents_market_filter_idx
    ON documents (role_family, location, seniority, published_at DESC);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS role_profiles (
    id BIGSERIAL PRIMARY KEY,
    role_family TEXT NOT NULL,
    role_name TEXT NOT NULL,
    location TEXT NOT NULL,
    seniority TEXT NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
    profile JSONB NOT NULL,
    UNIQUE (role_family, role_name, location, seniority, valid_from)
);

CREATE TABLE IF NOT EXISTS skill_taxonomy (
    id BIGSERIAL PRIMARY KEY,
    layer TEXT NOT NULL CHECK (layer IN ('domain', 'capability', 'technology')),
    canonical_name TEXT NOT NULL,
    description TEXT,
    aliases TEXT[] NOT NULL DEFAULT '{}',
    parent_id BIGINT REFERENCES skill_taxonomy(id),
    taxonomy_version TEXT NOT NULL,
    UNIQUE (canonical_name, layer, taxonomy_version)
);

CREATE TABLE IF NOT EXISTS skill_relationships (
    parent_skill_id BIGINT NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
    child_skill_id BIGINT NOT NULL REFERENCES skill_taxonomy(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL,
    confidence NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    PRIMARY KEY (parent_skill_id, child_skill_id, relationship)
);

CREATE TABLE IF NOT EXISTS job_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL,
    content TEXT NOT NULL,
    search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    embedding vector(384),
    UNIQUE (document_id, section_type, content)
);

CREATE INDEX IF NOT EXISTS job_chunks_search_idx ON job_chunks USING gin (search_vector);
CREATE INDEX IF NOT EXISTS job_chunks_embedding_idx
    ON job_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS candidate_evidence (
    id BIGSERIAL PRIMARY KEY,
    candidate_id UUID NOT NULL,
    skill_id BIGINT NOT NULL REFERENCES skill_taxonomy(id),
    evidence_level SMALLINT NOT NULL CHECK (evidence_level BETWEEN 0 AND 5),
    source_type TEXT NOT NULL,
    source_reference TEXT,
    excerpt TEXT,
    verification JSONB NOT NULL DEFAULT '{}',
    user_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    observed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_evidence_candidate_idx
    ON candidate_evidence (candidate_id, skill_id, evidence_level DESC);

CREATE TABLE IF NOT EXISTS project_patterns (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role_families TEXT[] NOT NULL,
    capabilities JSONB NOT NULL,
    upgrade_paths JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS market_snapshots (
    id BIGSERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    role_family TEXT NOT NULL,
    location TEXT NOT NULL,
    seniority TEXT NOT NULL,
    posting_count INTEGER NOT NULL CHECK (posting_count >= 0),
    metrics JSONB NOT NULL,
    UNIQUE (snapshot_date, role_family, location, seniority)
);

CREATE TABLE IF NOT EXISTS career_guides (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT NOT NULL REFERENCES sources(id),
    role_family TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384),
    published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS learning_resources (
    id BIGSERIAL PRIMARY KEY,
    skill_id BIGINT REFERENCES skill_taxonomy(id),
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    cost_type TEXT NOT NULL DEFAULT 'free',
    verified_at TIMESTAMPTZ
);
