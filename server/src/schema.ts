// SQLite sxemasi (ishlaydigan versiya). Ishlab chiqarish uchun PostgreSQL varianti: db/postgres/schema.sql
export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS districts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (region_id, name)
);

CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id INTEGER REFERENCES districts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  district_id INTEGER REFERENCES districts(id) ON DELETE SET NULL,
  region_id INTEGER REFERENCES regions(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- tasodifiy token hash (sha256)
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY,            -- 5 yoki 6
  name_uz TEXT NOT NULL, name_ru TEXT NOT NULL, name_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_uz TEXT NOT NULL, name_ru TEXT NOT NULL, name_en TEXT NOT NULL,
  is_core INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade_id INTEGER NOT NULL REFERENCES grades(id),
  slug TEXT NOT NULL UNIQUE,
  section_uz TEXT, section_ru TEXT, section_en TEXT,   -- o'quv bo'limi
  title_uz TEXT NOT NULL, title_ru TEXT, title_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_verified INTEGER NOT NULL DEFAULT 0,  -- rasmiy dasturga moslik tekshirilganmi
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Universal kontent jadvali: dars ishlanmasi, metod, laboratoriya, animatsiya, video, kitob, test, loyiha
CREATE TABLE IF NOT EXISTS content_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('lesson','method','lab','animation','video','ebook','assessment','project')),
  slug TEXT NOT NULL UNIQUE,
  grade_id INTEGER REFERENCES grades(id),
  topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','archived')),
  is_demo INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  lesson_type TEXT,
  duration_min INTEGER,
  format TEXT,                        -- html | pdf | video | text
  source_lang TEXT NOT NULL DEFAULT 'uz',
  interactive_project_id INTEGER,     -- HTML Studio loyihasiga havola
  video_url TEXT,
  file_asset_id INTEGER,
  author_id INTEGER REFERENCES users(id),
  reviewer_id INTEGER REFERENCES users(id),
  approver_id INTEGER REFERENCES users(id),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_kind_status ON content_items(kind, status);
CREATE INDEX IF NOT EXISTS idx_content_grade ON content_items(grade_id);
CREATE INDEX IF NOT EXISTS idx_content_topic ON content_items(topic_id);

CREATE TABLE IF NOT EXISTS content_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('uz','ru','en')),
  title TEXT NOT NULL,
  summary TEXT,
  keywords TEXT,
  body TEXT,                          -- JSON: tuzilmali bo'limlar yoki bloklar
  translation_status TEXT NOT NULL DEFAULT 'draft' CHECK (translation_status IN ('draft','machine','reviewed','final')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (content_id, lang)
);

CREATE TABLE IF NOT EXISTS content_subjects (          -- integratsiya: kontent <-> fan
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, subject_id)
);

CREATE TABLE IF NOT EXISTS content_methods (           -- kontent <-> interaktiv metod
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  method_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, method_id)
);

CREATE TABLE IF NOT EXISTS content_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  snapshot TEXT NOT NULL,             -- JSON
  author_id INTEGER REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (content_id, version_no)
);

CREATE TABLE IF NOT EXISTS content_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL, to_status TEXT NOT NULL,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interactive_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  html TEXT NOT NULL DEFAULT '',
  css TEXT NOT NULL DEFAULT '',
  js TEXT NOT NULL DEFAULT '',
  blocks TEXT,                        -- vizual blok muharriri JSON
  mode TEXT NOT NULL DEFAULT 'code' CHECK (mode IN ('code','blocks')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','archived')),
  is_demo INTEGER NOT NULL DEFAULT 0,
  published_version_id INTEGER,
  author_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES interactive_projects(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  html TEXT NOT NULL, css TEXT NOT NULL, js TEXT NOT NULL, blocks TEXT,
  kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','autosave','published')),
  note TEXT,
  author_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, version_no)
);

CREATE TABLE IF NOT EXISTS media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  alt_uz TEXT, alt_ru TEXT, alt_en TEXT,
  uploader_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL UNIQUE REFERENCES content_items(id) ON DELETE CASCADE,
  pass_percent INTEGER NOT NULL DEFAULT 60
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  q_uz TEXT NOT NULL, q_ru TEXT, q_en TEXT,
  options TEXT NOT NULL,              -- JSON: [{uz,ru,en}]
  correct_index INTEGER NOT NULL,
  explanation_uz TEXT, explanation_ru TEXT, explanation_en TEXT
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_uz TEXT NOT NULL, title_ru TEXT, title_en TEXT,
  body_uz TEXT, body_ru TEXT, body_en TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_demo INTEGER NOT NULL DEFAULT 0,
  author_id INTEGER REFERENCES users(id),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nav_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES nav_items(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  path TEXT,
  icon TEXT,
  label_uz TEXT NOT NULL, label_ru TEXT NOT NULL, label_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS translations (               -- markazlashgan interfeys matnlari
  key TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('uz','ru','en')),
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (key, lang)
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL, stack TEXT, path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
