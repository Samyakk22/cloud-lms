import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import CourseTile from '../components/CourseTile.jsx';
import Skeletons from '../components/Skeletons.jsx';
import Stats from '../components/Stats.jsx';

function NewCourse() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { id } = await api('/courses', { method: 'POST', body: form });
      navigate(`/courses/${id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Create a course</h2>
      <label>Title
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={100} required />
      </label>
      <label>Description
        <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
      </label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create course'}</button>
    </form>
  );
}

function statsFor(courses, teaching) {
  if (teaching) {
    return [
      { label: courses.length === 1 ? 'Course' : 'Courses', value: courses.length },
      { label: 'Materials', value: courses.reduce((n, c) => n + c.materialCount, 0) },
      { label: 'Quiz questions', value: courses.reduce((n, c) => n + c.questionCount, 0) },
    ];
  }
  const scored = courses.filter((c) => c.bestScore != null);
  const average = scored.length ? `${Math.round(scored.reduce((n, c) => n + c.bestScore, 0) / scored.length)}%` : '–';
  return [
    { label: 'Enrolled', value: courses.length },
    { label: 'Quizzes taken', value: scored.length },
    { label: 'Average best score', value: average },
  ];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState('');
  const teaching = user.role === 'instructor';

  useEffect(() => {
    api('/courses/mine').then((d) => setCourses(d.courses)).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <h1>{teaching ? 'Teaching' : 'My learning'}</h1>
      {error && <p className="notice error">{error}</p>}
      {!courses && !error && <Skeletons />}
      {courses && courses.length > 0 && <Stats items={statsFor(courses, teaching)} />}

      {courses && courses.length === 0 && !teaching && (
        <div className="empty">
          <h3>You have not enrolled in anything yet</h3>
          <p><Link to="/">Browse all courses</Link> and enroll in one to see it here.</p>
        </div>
      )}
      {courses && courses.length > 0 && (
        <div className="grid">{courses.map((c) => <CourseTile key={c.id} course={c} />)}</div>
      )}

      {teaching && (
        <div className="stack-top">
          <NewCourse />
        </div>
      )}
    </>
  );
}
