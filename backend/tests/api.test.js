process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = require('os').tmpdir() + '/lectern-test-uploads';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const tokenFor = (role) => jwt.sign({ id: '2d6a1f0e-8c3b-4f57-b1e2-7a9c4d5e6f01', role }, process.env.JWT_SECRET);

describe('API (no database needed)', () => {
  test('GET /api/health responds ok even when the database is unreachable', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('register rejects an invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Asha', email: 'nope', password: 'longenough' });
    expect(res.status).toBe(400);
  });

  test('register rejects a short password', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Asha', email: 'a@b.co', password: 'short' });
    expect(res.status).toBe(400);
  });

  test('register without a body returns 400, not 500', async () => {
    const res = await request(app).post('/api/auth/register');
    expect(res.status).toBe(400);
  });

  test('courses require a token', async () => {
    const res = await request(app).get('/api/courses');
    expect(res.status).toBe(401);
  });

  test('students cannot create courses', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${tokenFor('student')}`)
      .send({ title: 'Intro to AWS' });
    expect(res.status).toBe(403);
  });

  test('instructors cannot enroll', async () => {
    const res = await request(app)
      .post('/api/courses/6f1c2b8e-0d4a-4a7e-9d51-3b2f7c1a9e10/enroll')
      .set('Authorization', `Bearer ${tokenFor('instructor')}`);
    expect(res.status).toBe(403);
  });

  test('bad course ids return 404', async () => {
    const res = await request(app).get('/api/courses/not-an-id').set('Authorization', `Bearer ${tokenFor('student')}`);
    expect(res.status).toBe(404);
  });

  test('unknown routes return 404 json', async () => {
    const res = await request(app).get('/api/nothing');
    expect(res.status).toBe(404);
  });

  test('local file upload and download round-trip', async () => {
    const { urlFor } = require('../src/lib/localFiles');
    const key = 'courses/abc/notes.txt';
    const put = await request(app).put(urlFor(key, 'put')).set('Content-Type', 'text/plain').send('hello lectern');
    expect(put.status).toBe(200);
    const get = await request(app).get(urlFor(key, 'get'));
    expect(get.status).toBe(200);
    expect(get.text).toBe('hello lectern');
  });

  test('local files reject a wrong operation and path escapes', async () => {
    const { urlFor } = require('../src/lib/localFiles');
    const wrongOp = await request(app).get(urlFor('courses/abc/notes.txt', 'put'));
    expect(wrongOp.status).toBe(403);
    const escape = await request(app).put(urlFor('../../evil.txt', 'put')).send('x');
    expect(escape.status).toBe(403);
  });
});
