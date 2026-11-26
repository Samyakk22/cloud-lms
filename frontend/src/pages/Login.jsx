import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { user, signIn } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const isLogin = mode === 'login';

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(isLogin ? '/auth/login' : '/auth/register', form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth">
      <div className="auth-intro">
        <h1>Courses, materials and quizzes in one place.</h1>
        <p>Instructors publish lessons and check understanding. Students enroll, read, and see where they stand.</p>
        <ul className="points">
          <li>Upload PDFs and videos to each course</li>
          <li>Build multiple-choice quizzes in minutes</li>
          <li>See your best score on every course</li>
        </ul>
      </div>

      <form className="panel form" onSubmit={submit}>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={isLogin} className={isLogin ? 'on' : ''} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" role="tab" aria-selected={!isLogin} className={!isLogin ? 'on' : ''} onClick={() => setMode('register')}>Create account</button>
        </div>

        {!isLogin && (
          <label>Name
            <input value={form.name} onChange={set('name')} autoComplete="name" required />
          </label>
        )}
        <label>Email
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </label>
        <label>Password
          <input type="password" value={form.password} onChange={set('password')} minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? 'current-password' : 'new-password'} required />
          {!isLogin && <small className="muted">At least 8 characters</small>}
        </label>

        {!isLogin && (
          <fieldset>
            <legend>I am joining as</legend>
            <label className="choice"><input type="radio" name="role" value="student" checked={form.role === 'student'} onChange={set('role')} /> A student</label>
            <label className="choice"><input type="radio" name="role" value="instructor" checked={form.role === 'instructor'} onChange={set('role')} /> An instructor</label>
          </fieldset>
        )}

        {error && <p className="notice error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}</button>
      </form>
    </section>
  );
}
