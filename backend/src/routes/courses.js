const express = require('express');
const { query, transaction } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { presignUpload, presignDownload } = require('../lib/storage');
const { wrap, httpError } = require('../lib/util');

const router = express.Router();
router.use(requireAuth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const checkId = (message) => (req, res, next, value) =>
  UUID.test(value) ? next() : next(httpError(404, message));
router.param('id', checkId('Course not found'));
router.param('materialId', checkId('Material not found'));

// ---- shared SQL / helpers -----------------------------------------------------
// $1 is always the signed-in user, so each row also says whether they are enrolled.
const COURSE_SELECT = `
  SELECT c.id, c.title, c.description, c.instructor_id, u.name AS instructor,
         (SELECT count(*)::int FROM materials m WHERE m.course_id = c.id) AS material_count,
         (SELECT count(*)::int FROM questions q WHERE q.course_id = c.id) AS question_count,
         (e.user_id IS NOT NULL) AS enrolled, e.best_score
  FROM courses c
  JOIN users u ON u.id = c.instructor_id
  LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = $1`;

const shape = (row, userId) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  instructor: row.instructor,
  materialCount: row.material_count,
  questionCount: row.question_count,
  owner: row.instructor_id === userId,
  enrolled: row.enrolled,
  bestScore: row.best_score,
});

async function ownedCourse(id, userId) {
  const { rows } = await query('SELECT id, instructor_id FROM courses WHERE id = $1', [id]);
  if (!rows[0]) throw httpError(404, 'Course not found');
  if (rows[0].instructor_id !== userId) throw httpError(403, 'You can only change your own courses');
  return rows[0];
}

// ---- lists ------------------------------------------------------------------
router.get(
  '/',
  wrap(async (req, res) => {
    const { rows } = await query(`${COURSE_SELECT} ORDER BY c.created_at DESC`, [req.user.id]);
    res.json({ courses: rows.map((r) => shape(r, req.user.id)) });
  })
);

// Must stay above '/:id'
router.get(
  '/mine',
  wrap(async (req, res) => {
    const { rows } =
      req.user.role === 'instructor'
        ? await query(`${COURSE_SELECT} WHERE c.instructor_id = $1 ORDER BY c.created_at DESC`, [req.user.id])
        : await query(`${COURSE_SELECT} WHERE e.user_id IS NOT NULL ORDER BY e.created_at DESC`, [req.user.id]);
    res.json({ courses: rows.map((r) => shape(r, req.user.id)) });
  })
);

// ---- course CRUD ------------------------------------------------------------
router.post(
  '/',
  requireRole('instructor'),
  wrap(async (req, res) => {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    if (title.length < 3) throw httpError(400, 'Give the course a title of at least 3 characters');
    const { rows } = await query(
      'INSERT INTO courses (title, description, instructor_id) VALUES ($1, $2, $3) RETURNING id',
      [title.slice(0, 100), description.slice(0, 1000), req.user.id]
    );
    res.status(201).json({ id: rows[0].id });
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const { rows } = await query(`${COURSE_SELECT} WHERE c.id = $2`, [req.user.id, req.params.id]);
    if (!rows[0]) throw httpError(404, 'Course not found');
    const course = shape(rows[0], req.user.id);
    const canView = course.owner || course.enrolled;

    let materials = [];
    let questions = [];
    if (canView) {
      const m = await query(
        'SELECT id, name, content_type FROM materials WHERE course_id = $1 ORDER BY created_at',
        [course.id]
      );
      materials = m.rows.map((r) => ({ id: r.id, name: r.name, contentType: r.content_type }));

      const q = await query(
        'SELECT id, text, options, answer_index FROM questions WHERE course_id = $1 ORDER BY position',
        [course.id]
      );
      // Students never receive the answer key.
      questions = q.rows.map((r) => ({
        id: r.id,
        question: r.text,
        options: r.options,
        ...(course.owner ? { answerIndex: r.answer_index } : {}),
      }));
    }
    res.json({ course: { ...course, materials, questions } });
  })
);

router.post(
  '/:id/enroll',
  requireRole('student'),
  wrap(async (req, res) => {
    const found = await query('SELECT 1 FROM courses WHERE id = $1', [req.params.id]);
    if (!found.rowCount) throw httpError(404, 'Course not found');
    await query(
      'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.id]
    );
    res.status(204).end();
  })
);

// ---- materials (S3 presigned URLs, or local disk in development) ----------------
router.post(
  '/:id/materials/upload-url',
  requireRole('instructor'),
  wrap(async (req, res) => {
    await ownedCourse(req.params.id, req.user.id);
    const filename = String(req.body.filename || '').trim();
    const contentType = String(req.body.contentType || 'application/octet-stream');
    if (!filename) throw httpError(400, 'Choose a file to upload');

    const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(-80);
    const key = `courses/${req.params.id}/${Date.now()}-${safeName}`;
    res.json({ key, uploadUrl: await presignUpload(key, contentType) });
  })
);

router.post(
  '/:id/materials',
  requireRole('instructor'),
  wrap(async (req, res) => {
    await ownedCourse(req.params.id, req.user.id);
    const { name, key, contentType } = req.body;
    if (!name || typeof key !== 'string' || !key.startsWith(`courses/${req.params.id}/`)) {
      throw httpError(400, 'Invalid material');
    }
    const { rows } = await query(
      'INSERT INTO materials (course_id, name, storage_key, content_type) VALUES ($1, $2, $3, $4) RETURNING id, name, content_type',
      [req.params.id, String(name).slice(0, 150), key, String(contentType || 'application/octet-stream')]
    );
    const m = rows[0];
    res.status(201).json({ material: { id: m.id, name: m.name, contentType: m.content_type } });
  })
);

router.get(
  '/:id/materials/:materialId/download-url',
  wrap(async (req, res) => {
    const { rows } = await query(
      `SELECT m.storage_key, c.instructor_id,
              EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.user_id = $1) AS enrolled
       FROM materials m JOIN courses c ON c.id = m.course_id
       WHERE m.id = $2 AND c.id = $3`,
      [req.user.id, req.params.materialId, req.params.id]
    );
    const m = rows[0];
    if (!m) throw httpError(404, 'Material not found');
    if (m.instructor_id !== req.user.id && !m.enrolled) {
      throw httpError(403, 'Enroll in this course to open its materials');
    }
    res.json({ url: await presignDownload(m.storage_key) });
  })
);

// ---- quiz -------------------------------------------------------------------
router.put(
  '/:id/quiz',
  requireRole('instructor'),
  wrap(async (req, res) => {
    await ownedCourse(req.params.id, req.user.id);

    const raw = Array.isArray(req.body.questions) ? req.body.questions : [];
    if (raw.length > 20) throw httpError(400, 'A quiz can have up to 20 questions');
    const quiz = raw.map((q) => ({
      text: String(q.question || '').trim(),
      options: (Array.isArray(q.options) ? q.options : []).map((o) => String(o).trim()),
      answerIndex: Number(q.answerIndex),
    }));
    const valid = quiz.every(
      (q) =>
        q.text &&
        q.options.length >= 2 &&
        q.options.length <= 5 &&
        q.options.every(Boolean) &&
        Number.isInteger(q.answerIndex) &&
        q.answerIndex >= 0 &&
        q.answerIndex < q.options.length
    );
    if (!valid) {
      throw httpError(400, 'Each question needs text, at least two options and a marked correct answer');
    }

    await transaction(async (db) => {
      await db.query('DELETE FROM questions WHERE course_id = $1', [req.params.id]);
      for (const [position, q] of quiz.entries()) {
        await db.query(
          'INSERT INTO questions (course_id, position, text, options, answer_index) VALUES ($1, $2, $3, $4, $5)',
          [req.params.id, position, q.text, q.options, q.answerIndex]
        );
      }
    });
    res.json({ questionCount: quiz.length });
  })
);

router.post(
  '/:id/quiz/submit',
  requireRole('student'),
  wrap(async (req, res) => {
    const enrollment = await query('SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2', [
      req.user.id,
      req.params.id,
    ]);
    if (!enrollment.rowCount) throw httpError(403, 'Enroll in this course to take the quiz');

    const { rows } = await query(
      'SELECT answer_index FROM questions WHERE course_id = $1 ORDER BY position',
      [req.params.id]
    );
    if (!rows.length) throw httpError(400, 'This course has no quiz yet');

    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const correct = rows.map((r) => r.answer_index);
    const score = correct.filter((answer, i) => Number(answers[i]) === answer).length;
    const percent = Math.round((score / correct.length) * 100);

    const updated = await query(
      `UPDATE enrollments SET best_score = GREATEST(COALESCE(best_score, 0), $3)
       WHERE user_id = $1 AND course_id = $2 RETURNING best_score`,
      [req.user.id, req.params.id, percent]
    );
    res.json({ score, total: correct.length, percent, correct, bestScore: updated.rows[0].best_score });
  })
);

module.exports = router;
