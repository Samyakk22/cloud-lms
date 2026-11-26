-- Lectern schema. gen_random_uuid() is built in from PostgreSQL 13 (RDS PostgreSQL 15/16 is fine).

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  email         text        NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  role          text        NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'instructor')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  description   text        NOT NULL DEFAULT '',
  instructor_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courses_instructor_idx ON courses (instructor_id);

CREATE TABLE materials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    uuid        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  storage_key  text        NOT NULL,            -- S3 object key (or local file key)
  content_type text        NOT NULL DEFAULT 'application/octet-stream',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX materials_course_idx ON materials (course_id);

CREATE TABLE questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    uuid    NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position     integer NOT NULL,
  text         text    NOT NULL,
  options      text[]  NOT NULL,
  answer_index integer NOT NULL,
  CHECK (cardinality(options) BETWEEN 2 AND 5),
  CHECK (answer_index >= 0 AND answer_index < cardinality(options))
);
CREATE INDEX questions_course_idx ON questions (course_id, position);

CREATE TABLE enrollments (
  user_id    uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  course_id  uuid        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  best_score integer,                              -- best quiz result, percent
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);
CREATE INDEX enrollments_course_idx ON enrollments (course_id);
