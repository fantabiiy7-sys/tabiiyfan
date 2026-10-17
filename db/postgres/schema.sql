-- Tabiiy fan — PostgreSQL 16 sxemasi (ishlab chiqarish nishoni) + Row-Level Security.
-- HOLAT: sxema psql orqali tekshirilgan (yaratiladi, RLS siyosatlari sinov so'rovlari bilan sinalgan).
--        Ilova serveri hozircha node:sqlite bilan ishlaydi; PostgreSQL drayveriga o'tish alohida ish (docs/DEPLOY.md).
-- Ulanish modeli: ilova `tf_app` roli (BYPASSRLS yo'q, egasi emas) bilan ulanadi va har tranzaksiyada
--   SELECT set_config('app.user_id', '<id>', true), set_config('app.role', '<rol kaliti>', true);
-- chaqiradi. Foydalanuvchi aniqlanmagan (mehmon) so'rovda app.user_id bo'sh qoladi.

CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tf_app') THEN CREATE ROLE tf_app NOLOGIN; END IF;
END $$;

-- ---------- yordamchi funksiyalar (RLS siyosatlari uchun) ----------
CREATE OR REPLACE FUNCTION app_uid() RETURNS integer LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::integer $$;
CREATE OR REPLACE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), 'guest') $$;
-- kontentni boshqarish huquqi bor rollar (ruxsatlar matritsasi ilovada; bu yerda qo'pol, "oxirgi himoya chizig'i")
CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT app_role() IN ('super_admin','republic_editor','regional_moderator','district_moderator') $$;
CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT app_role() IN ('super_admin','republic_editor') $$;
CREATE OR REPLACE FUNCTION app_can_write() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT app_role() IN ('super_admin','republic_editor','regional_moderator','district_moderator','school_admin','teacher') $$;

-- ---------- rollar va ruxsatlar ----------
CREATE TABLE roles (id serial PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, level integer NOT NULL);
CREATE TABLE permissions (id serial PRIMARY KEY, key text NOT NULL UNIQUE);
CREATE TABLE role_permissions (role_id integer NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id integer NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, PRIMARY KEY (role_id, permission_id));

CREATE TABLE regions (id serial PRIMARY KEY, name text NOT NULL UNIQUE);
CREATE TABLE districts (id serial PRIMARY KEY, region_id integer NOT NULL REFERENCES regions(id) ON DELETE CASCADE, name text NOT NULL, UNIQUE (region_id, name));
CREATE TABLE schools (id serial PRIMARY KEY, district_id integer REFERENCES districts(id) ON DELETE SET NULL, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE users (
  id serial PRIMARY KEY, email citext NOT NULL UNIQUE, password_hash text NOT NULL, full_name text NOT NULL,
  role_id integer NOT NULL REFERENCES roles(id),
  school_id integer REFERENCES schools(id) ON DELETE SET NULL, district_id integer REFERENCES districts(id) ON DELETE SET NULL, region_id integer REFERENCES regions(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true, failed_logins integer NOT NULL DEFAULT 0, locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  id text PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, ip inet, user_agent text
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ---------- o'quv strukturasi ----------
CREATE TABLE grades (id integer PRIMARY KEY CHECK (id IN (5,6)), name_uz text NOT NULL, name_ru text NOT NULL, name_en text NOT NULL);
CREATE TABLE subjects (id serial PRIMARY KEY, slug text NOT NULL UNIQUE, name_uz text NOT NULL, name_ru text NOT NULL, name_en text NOT NULL, is_core boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0);
CREATE TABLE topics (
  id serial PRIMARY KEY, grade_id integer NOT NULL REFERENCES grades(id), slug text NOT NULL UNIQUE,
  section_uz text, section_ru text, section_en text, title_uz text NOT NULL, title_ru text, title_en text,
  sort_order integer NOT NULL DEFAULT 0, is_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- kontent ----------
CREATE TABLE content_items (
  id serial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('lesson','method','lab','animation','video','ebook','assessment','project')),
  slug text NOT NULL UNIQUE,
  grade_id integer REFERENCES grades(id), topic_id integer REFERENCES topics(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','archived')),
  is_demo boolean NOT NULL DEFAULT false, is_hidden boolean NOT NULL DEFAULT false,
  lesson_type text, duration_min integer CHECK (duration_min BETWEEN 1 AND 240), format text, source_lang text NOT NULL DEFAULT 'uz' CHECK (source_lang IN ('uz','ru','en')),
  interactive_project_id integer, video_url text, file_asset_id integer,
  author_id integer REFERENCES users(id), reviewer_id integer REFERENCES users(id), approver_id integer REFERENCES users(id),
  published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_kind_status ON content_items(kind, status);
CREATE INDEX idx_content_grade ON content_items(grade_id);
CREATE INDEX idx_content_topic ON content_items(topic_id);

CREATE TABLE content_translations (
  id serial PRIMARY KEY, content_id integer NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('uz','ru','en')), title text NOT NULL, summary text, keywords text, body jsonb,
  translation_status text NOT NULL DEFAULT 'draft' CHECK (translation_status IN ('draft','machine','reviewed','final')),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (content_id, lang)
);
CREATE TABLE content_subjects (content_id integer NOT NULL REFERENCES content_items(id) ON DELETE CASCADE, subject_id integer NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, PRIMARY KEY (content_id, subject_id));
CREATE TABLE content_methods (content_id integer NOT NULL REFERENCES content_items(id) ON DELETE CASCADE, method_id integer NOT NULL REFERENCES content_items(id) ON DELETE CASCADE, PRIMARY KEY (content_id, method_id));
CREATE TABLE content_versions (
  id serial PRIMARY KEY, content_id integer NOT NULL REFERENCES content_items(id) ON DELETE CASCADE, version_no integer NOT NULL,
  snapshot jsonb NOT NULL, author_id integer REFERENCES users(id), note text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (content_id, version_no)
);
CREATE TABLE content_reviews (
  id serial PRIMARY KEY, content_id integer NOT NULL REFERENCES content_items(id) ON DELETE CASCADE, from_status text NOT NULL, to_status text NOT NULL,
  actor_id integer NOT NULL REFERENCES users(id), comment text, created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- HTML Studio ----------
CREATE TABLE interactive_projects (
  id serial PRIMARY KEY, name text NOT NULL, html text NOT NULL DEFAULT '', css text NOT NULL DEFAULT '', js text NOT NULL DEFAULT '', blocks jsonb,
  mode text NOT NULL DEFAULT 'code' CHECK (mode IN ('code','blocks')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','archived')),
  is_demo boolean NOT NULL DEFAULT false, published_version_id integer, author_id integer REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE project_versions (
  id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES interactive_projects(id) ON DELETE CASCADE, version_no integer NOT NULL,
  html text NOT NULL, css text NOT NULL, js text NOT NULL, blocks jsonb, kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','autosave','published')),
  note text, author_id integer REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (project_id, version_no)
);
CREATE TABLE media_assets (
  id serial PRIMARY KEY, filename text NOT NULL, stored_name text NOT NULL UNIQUE, mime text NOT NULL, size integer NOT NULL CHECK (size <= 10485760), sha256 text NOT NULL,
  alt_uz text, alt_ru text, alt_en text, uploader_id integer REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE content_items ADD FOREIGN KEY (interactive_project_id) REFERENCES interactive_projects(id) ON DELETE SET NULL;
ALTER TABLE content_items ADD FOREIGN KEY (file_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;

-- ---------- testlar ----------
CREATE TABLE assessments (id serial PRIMARY KEY, content_id integer NOT NULL UNIQUE REFERENCES content_items(id) ON DELETE CASCADE, pass_percent integer NOT NULL DEFAULT 60 CHECK (pass_percent BETWEEN 1 AND 100));
CREATE TABLE questions (
  id serial PRIMARY KEY, assessment_id integer NOT NULL REFERENCES assessments(id) ON DELETE CASCADE, sort_order integer NOT NULL DEFAULT 0,
  q_uz text NOT NULL, q_ru text, q_en text, options jsonb NOT NULL, correct_index integer NOT NULL,
  explanation_uz text, explanation_ru text, explanation_en text
);

-- ---------- platforma ----------
CREATE TABLE announcements (
  id serial PRIMARY KEY, title_uz text NOT NULL, title_ru text, title_en text, body_uz text, body_ru text, body_en text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')), is_demo boolean NOT NULL DEFAULT false,
  author_id integer REFERENCES users(id), published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE nav_items (
  id serial PRIMARY KEY, parent_id integer REFERENCES nav_items(id) ON DELETE CASCADE, key text NOT NULL UNIQUE, path text, icon text,
  label_uz text NOT NULL, label_ru text NOT NULL, label_en text NOT NULL, sort_order integer NOT NULL DEFAULT 0, is_visible boolean NOT NULL DEFAULT true
);
CREATE TABLE translations (key text NOT NULL, lang text NOT NULL CHECK (lang IN ('uz','ru','en')), value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (key, lang));
CREATE TABLE platform_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY, actor_id integer REFERENCES users(id) ON DELETE SET NULL, actor_email text, action text NOT NULL, entity text, entity_id text,
  detail jsonb, ip inet, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE TABLE error_logs (id bigserial PRIMARY KEY, message text NOT NULL, stack text, path text, created_at timestamptz NOT NULL DEFAULT now());

-- ======================= ROW-LEVEL SECURITY =======================
-- Barcha jadvallarda RLS yoqiladi va jadval egasiga ham qo'llanadi (FORCE).
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','sessions','content_items','content_translations','content_subjects','content_methods','content_versions','content_reviews',
    'interactive_projects','project_versions','media_assets','assessments','questions','announcements','audit_logs','error_logs','platform_settings']
  LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t); END LOOP;
END $$;

-- users: har kim faqat o'zini, administratorlar hammasini ko'radi; o'zgartirish faqat administrator (parol almashtirish — ilova funksiyasi orqali)
CREATE POLICY users_select ON users FOR SELECT USING (id = app_uid() OR app_is_admin());
CREATE POLICY users_write ON users FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());
-- sessions: faqat egasi (login paytida ilova app.user_id ni sozlagandan keyin yaratadi)
CREATE POLICY sessions_own ON sessions FOR ALL USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());

-- content_items: mehmon faqat nashr etilgan va yashirilmagan materialni ko'radi; muallif o'zinikini; xodimlar hammasini
CREATE POLICY content_read ON content_items FOR SELECT USING ((status = 'published' AND NOT is_hidden) OR author_id = app_uid() OR app_is_staff());
CREATE POLICY content_insert ON content_items FOR INSERT WITH CHECK (app_can_write() AND (author_id = app_uid() OR app_is_staff()) AND (status = 'draft' OR app_is_staff()));
CREATE POLICY content_update ON content_items FOR UPDATE USING (app_is_staff() OR (author_id = app_uid() AND status IN ('draft'))) WITH CHECK (app_is_staff() OR (author_id = app_uid() AND status IN ('draft','in_review')));
CREATE POLICY content_delete ON content_items FOR DELETE USING (app_is_admin() OR (author_id = app_uid() AND status = 'draft'));

-- bog'liq jadvallar ota yozuvning ko'rinishiga ergashadi
CREATE POLICY ct_read ON content_translations FOR SELECT USING (EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id));
CREATE POLICY ct_write ON content_translations FOR ALL USING (EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id AND (app_is_staff() OR (c.author_id = app_uid() AND c.status = 'draft'))))
  WITH CHECK (EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id AND (app_is_staff() OR (c.author_id = app_uid() AND c.status = 'draft'))));
CREATE POLICY cs_read ON content_subjects FOR SELECT USING (EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id));
CREATE POLICY cs_write ON content_subjects FOR ALL USING (EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id AND (app_is_staff() OR (c.author_id = app_uid() AND c.status = 'draft'))))
  WITH CHECK (EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id AND (app_is_staff() OR (c.author_id = app_uid() AND c.status = 'draft'))));
CREATE POLICY cm_read ON content_methods FOR SELECT USING (EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id));
CREATE POLICY cm_write ON content_methods FOR ALL USING (EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id AND (app_is_staff() OR (c.author_id = app_uid() AND c.status = 'draft'))))
  WITH CHECK (EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id AND (app_is_staff() OR (c.author_id = app_uid() AND c.status = 'draft'))));
-- versiyalar va ko'rib chiqish jurnali: faqat muallif/xodimlar; qo'shish mumkin, o'zgartirish/o'chirish yo'q
CREATE POLICY cv_read ON content_versions FOR SELECT USING (app_is_staff() OR EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id AND c.author_id = app_uid()));
CREATE POLICY cv_insert ON content_versions FOR INSERT WITH CHECK (app_can_write());
CREATE POLICY cr_read ON content_reviews FOR SELECT USING (app_is_staff() OR EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id AND c.author_id = app_uid()));
CREATE POLICY cr_insert ON content_reviews FOR INSERT WITH CHECK (app_can_write() AND actor_id = app_uid());

-- HTML Studio: loyiha egasi yoki xodimlar; nashr etilgan loyiha hamma uchun o'qiladi (embed uchun)
CREATE POLICY ip_read ON interactive_projects FOR SELECT USING (status = 'published' OR author_id = app_uid() OR app_is_staff());
CREATE POLICY ip_write ON interactive_projects FOR ALL USING (author_id = app_uid() OR app_is_staff()) WITH CHECK (author_id = app_uid() OR app_is_staff());
CREATE POLICY pv_read ON project_versions FOR SELECT USING (EXISTS (SELECT 1 FROM interactive_projects p WHERE p.id = project_id AND (p.author_id = app_uid() OR app_is_staff())) OR EXISTS (SELECT 1 FROM interactive_projects p WHERE p.id = project_id AND p.published_version_id = project_versions.id));
CREATE POLICY pv_insert ON project_versions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM interactive_projects p WHERE p.id = project_id AND (p.author_id = app_uid() OR app_is_staff())));
CREATE POLICY pv_delete ON project_versions FOR DELETE USING (kind = 'autosave' AND EXISTS (SELECT 1 FROM interactive_projects p WHERE p.id = project_id AND (p.author_id = app_uid() OR app_is_staff())));

-- media: nashr etilgan materiallarga biriktirilgani ommaviy; qolganini yuklagan yoki xodim ko'radi
CREATE POLICY media_read ON media_assets FOR SELECT USING (uploader_id = app_uid() OR app_is_staff() OR EXISTS (SELECT 1 FROM content_items c WHERE c.file_asset_id = media_assets.id AND c.status = 'published'));
CREATE POLICY media_insert ON media_assets FOR INSERT WITH CHECK (app_can_write() AND uploader_id = app_uid());
CREATE POLICY media_update ON media_assets FOR UPDATE USING (uploader_id = app_uid() OR app_is_staff()) WITH CHECK (uploader_id = app_uid() OR app_is_staff());
CREATE POLICY media_delete ON media_assets FOR DELETE USING (app_is_admin());

-- testlar: savol/javoblar faqat xodim va muallifga ochiq (to'g'ri javob o'quvchiga hech qachon yuborilmaydi — tekshiruv serverda)
CREATE POLICY as_read ON assessments FOR SELECT USING (EXISTS (SELECT 1 FROM content_items c WHERE c.id = content_id));
CREATE POLICY as_write ON assessments FOR ALL USING (app_is_staff()) WITH CHECK (app_is_staff());
CREATE POLICY q_read ON questions FOR SELECT USING (app_is_staff() OR EXISTS (SELECT 1 FROM assessments a JOIN content_items c ON c.id = a.content_id WHERE a.id = assessment_id AND c.author_id = app_uid()));
CREATE POLICY q_write ON questions FOR ALL USING (app_is_staff()) WITH CHECK (app_is_staff());

CREATE POLICY ann_read ON announcements FOR SELECT USING (status = 'published' OR app_is_staff());
CREATE POLICY ann_write ON announcements FOR ALL USING (app_is_staff()) WITH CHECK (app_is_staff());

-- audit jurnali: har kim qo'sha oladi, faqat xodimlar o'qiydi, hech kim o'zgartira/o'chira olmaydi (UPDATE/DELETE siyosati yo'q)
CREATE POLICY audit_insert ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY audit_read ON audit_logs FOR SELECT USING (app_is_admin());
CREATE POLICY err_insert ON error_logs FOR INSERT WITH CHECK (true);
CREATE POLICY err_read ON error_logs FOR SELECT USING (app_is_admin());
CREATE POLICY settings_read ON platform_settings FOR SELECT USING (true);
CREATE POLICY settings_write ON platform_settings FOR ALL USING (app_is_admin()) WITH CHECK (app_is_admin());

-- ---------- huquqlar ----------
GRANT USAGE ON SCHEMA public TO tf_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tf_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tf_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM tf_app;      -- audit jurnali o'zgarmas
REVOKE UPDATE, DELETE, TRUNCATE ON content_versions, content_reviews FROM tf_app;
