// Full-flow test against a real PostgreSQL. Skipped unless TEST_DATABASE_URL is set, e.g.
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/lms_test npm test
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Lectern flow (PostgreSQL)', () => {
  let request, app, db;
  const bearer = (token) => ({ Authorization: `Bearer ${token}` });
  let teacher, student, courseId, materialId;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    process.env.UPLOAD_DIR = require('os').tmpdir() + '/lectern-test-uploads';
    delete process.env.S3_BUCKET;
    request = require('supertest');
    db = require('../src/db');
    await require('../src/db/migrate').migrate();
    await db.query('TRUNCATE users, courses, materials, questions, enrollments CASCADE');
    app = require('../src/app');
  });

  afterAll(async () => {
    await db.close();
  });

  test('health reports the database', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toEqual({ status: 'ok', db: true });
    expect((await request(app).get('/api/ready')).status).toBe(200);
  });

  test('migrations are idempotent', async () => {
    await require('../src/db/migrate').migrate();
    const { rows } = await db.query('SELECT count(*)::int AS n FROM schema_migrations');
    expect(rows[0].n).toBe(1);
  });

  test('register and login', async () => {
    const t = await request(app).post('/api/auth/register').send({ name: 'Tara', email: 'Tara@Example.com', password: 'password123', role: 'instructor' });
    expect(t.status).toBe(201);
    teacher = t.body.token;
    const s = await request(app).post('/api/auth/register').send({ name: 'Sam', email: 'sam@example.com', password: 'password123' });
    student = s.body.token;
    expect(s.body.user.role).toBe('student');

    const dup = await request(app).post('/api/auth/register').send({ name: 'Tara', email: 'tara@example.com', password: 'password123' });
    expect(dup.status).toBe(409);

    const bad = await request(app).post('/api/auth/login').send({ email: 'tara@example.com', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    const ok = await request(app).post('/api/auth/login').send({ email: 'tara@example.com', password: 'password123' });
    expect(ok.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(bearer(ok.body.token))).body.user.name).toBe('Tara');
  });

  test('instructor creates a course with a material and a quiz', async () => {
    const c = await request(app).post('/api/courses').set(bearer(teacher)).send({ title: 'Intro to AWS', description: 'VPC, EC2, S3' });
    expect(c.status).toBe(201);
    courseId = c.body.id;

    const up = await request(app).post(`/api/courses/${courseId}/materials/upload-url`).set(bearer(teacher)).send({ filename: 'week 1.txt', contentType: 'text/plain' });
    expect(up.status).toBe(200);
    const put = await request(app).put(up.body.uploadUrl).set('Content-Type', 'text/plain').send('week one notes');
    expect(put.status).toBe(200);
    const saved = await request(app).post(`/api/courses/${courseId}/materials`).set(bearer(teacher)).send({ name: 'week 1.txt', key: up.body.key, contentType: 'text/plain' });
    expect(saved.status).toBe(201);
    materialId = saved.body.material.id;

    const forged = await request(app).post(`/api/courses/${courseId}/materials`).set(bearer(teacher)).send({ name: 'x', key: 'courses/other/x.txt' });
    expect(forged.status).toBe(400);

    const quiz = await request(app).put(`/api/courses/${courseId}/quiz`).set(bearer(teacher)).send({
      questions: [
        { question: 'Which service stores objects?', options: ['EC2', 'S3', 'VPC'], answerIndex: 1 },
        { question: 'Which gives a private network?', options: ['VPC', 'SNS'], answerIndex: 0 },
      ],
    });
    expect(quiz.status).toBe(200);
    expect(quiz.body.questionCount).toBe(2);

    const invalid = await request(app).put(`/api/courses/${courseId}/quiz`).set(bearer(teacher)).send({ questions: [{ question: 'Q', options: ['a'], answerIndex: 0 }] });
    expect(invalid.status).toBe(400);
  });

  test('student cannot see locked content before enrolling', async () => {
    const res = await request(app).get(`/api/courses/${courseId}`).set(bearer(student));
    expect(res.body.course.enrolled).toBe(false);
    expect(res.body.course.materials).toEqual([]);
    expect(res.body.course.questions).toEqual([]);
    expect(res.body.course.materialCount).toBe(1);
    const dl = await request(app).get(`/api/courses/${courseId}/materials/${materialId}/download-url`).set(bearer(student));
    expect(dl.status).toBe(403);
  });

  test('student enrolls, downloads, and takes the quiz without seeing answers', async () => {
    expect((await request(app).post(`/api/courses/${courseId}/enroll`).set(bearer(student))).status).toBe(204);
    expect((await request(app).post(`/api/courses/${courseId}/enroll`).set(bearer(student))).status).toBe(204); // idempotent

    const detail = await request(app).get(`/api/courses/${courseId}`).set(bearer(student));
    expect(detail.body.course.enrolled).toBe(true);
    expect(detail.body.course.questions).toHaveLength(2);
    expect(detail.body.course.questions[0]).not.toHaveProperty('answerIndex');
    expect(detail.body.course.questions[0].question).toBe('Which service stores objects?');

    const dl = await request(app).get(`/api/courses/${courseId}/materials/${materialId}/download-url`).set(bearer(student));
    expect(dl.status).toBe(200);
    const file = await request(app).get(dl.body.url);
    expect(file.text).toBe('week one notes');

    const half = await request(app).post(`/api/courses/${courseId}/quiz/submit`).set(bearer(student)).send({ answers: [1, 1] });
    expect(half.body).toMatchObject({ score: 1, total: 2, percent: 50, correct: [1, 0], bestScore: 50 });
    const full = await request(app).post(`/api/courses/${courseId}/quiz/submit`).set(bearer(student)).send({ answers: [1, 0] });
    expect(full.body.bestScore).toBe(100);
    const worse = await request(app).post(`/api/courses/${courseId}/quiz/submit`).set(bearer(student)).send({ answers: [0, 1] });
    expect(worse.body.bestScore).toBe(100); // best score never goes down
  });

  test('owner sees the answer key; lists and role rules hold', async () => {
    const owner = await request(app).get(`/api/courses/${courseId}`).set(bearer(teacher));
    expect(owner.body.course.owner).toBe(true);
    expect(owner.body.course.questions[0].answerIndex).toBe(1);

    const mineStudent = await request(app).get('/api/courses/mine').set(bearer(student));
    expect(mineStudent.body.courses).toHaveLength(1);
    expect(mineStudent.body.courses[0]).toMatchObject({ enrolled: true, bestScore: 100 });
    const mineTeacher = await request(app).get('/api/courses/mine').set(bearer(teacher));
    expect(mineTeacher.body.courses[0]).toMatchObject({ owner: true, materialCount: 1, questionCount: 2 });
    const all = await request(app).get('/api/courses').set(bearer(student));
    expect(all.body.courses[0]).toMatchObject({ title: 'Intro to AWS', instructor: 'Tara' });

    const otherTeacher = await request(app).post('/api/auth/register').send({ name: 'Omar', email: 'omar@example.com', password: 'password123', role: 'instructor' });
    const hijack = await request(app).put(`/api/courses/${courseId}/quiz`).set(bearer(otherTeacher.body.token)).send({ questions: [] });
    expect(hijack.status).toBe(403);
    expect((await request(app).get('/api/courses/00000000-0000-0000-0000-000000000000').set(bearer(student))).status).toBe(404);
  });
});
