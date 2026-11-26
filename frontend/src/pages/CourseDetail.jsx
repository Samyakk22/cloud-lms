import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Cover from '../components/Cover.jsx';
import MaterialUpload from '../components/MaterialUpload.jsx';
import Quiz from '../components/Quiz.jsx';
import QuizBuilder from '../components/QuizBuilder.jsx';

const kindOf = (name) => (name.includes('.') ? name.split('.').pop().slice(0, 4).toLowerCase() : 'file');

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api(`/courses/${id}`).then((d) => setCourse(d.course)).catch((e) => setError(e.message)),
    [id]
  );
  useEffect(() => { load(); }, [load]);

  if (!course) return error ? <p className="notice error">{error}</p> : <p className="muted">Loading course…</p>;

  const canView = course.owner || course.enrolled;

  async function enroll() {
    setError('');
    setBusy(true);
    try {
      await api(`/courses/${id}/enroll`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openMaterial(material) {
    setError('');
    const tab = window.open('', '_blank'); // opened first so the popup blocker allows it
    try {
      const { url } = await api(`/courses/${id}/materials/${material.id}/download-url`);
      tab.location.href = url;
    } catch (err) {
      tab?.close();
      setError(err.message);
    }
  }

  return (
    <>
      <Link to="/" className="back">← All courses</Link>
      <section className="course-head">
        <Cover title={course.title} large />
        <div>
          <h1>{course.title}</h1>
          <p className="muted">Taught by {course.instructor}</p>
          <p className="description">{course.description || 'This course has no description yet.'}</p>
          {user.role === 'student' && !course.enrolled && (
            <button className="btn btn-primary" onClick={enroll} disabled={busy}>{busy ? 'Enrolling…' : 'Enroll in this course'}</button>
          )}
          {course.enrolled && <span className="badge badge-blue">You are enrolled</span>}
          {course.owner && <span className="badge">You teach this course</span>}
        </div>
      </section>

      {error && <p className="notice error" role="alert">{error}</p>}

      <section className="block">
        <h2>Materials</h2>
        {!canView && (
          <p className="muted">
            {user.role === 'student'
              ? `Enroll to unlock ${course.materialCount} material${course.materialCount === 1 ? '' : 's'} and ${course.questionCount} quiz question${course.questionCount === 1 ? '' : 's'}.`
              : 'Only enrolled students and the course instructor can see the materials.'}
          </p>
        )}
        {canView && course.materials.length === 0 && <p className="muted">No materials have been added yet.</p>}
        {canView && course.materials.length > 0 && (
          <ul className="materials">
            {course.materials.map((m) => (
              <li key={m.id}>
                <span className="kind">{kindOf(m.name)}</span>
                <span className="name">{m.name}</span>
                <button className="btn" onClick={() => openMaterial(m)}>Open</button>
              </li>
            ))}
          </ul>
        )}
        {course.owner && <MaterialUpload courseId={id} onAdded={load} />}
      </section>

      {canView && (
        <section className="block">
          <h2>{course.owner ? 'Quiz builder' : 'Quiz'}</h2>
          {course.owner
            ? <QuizBuilder course={course} onSaved={load} />
            : <Quiz course={course} onDone={load} />}
        </section>
      )}
    </>
  );
}
