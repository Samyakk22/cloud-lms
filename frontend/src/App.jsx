import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Courses from './pages/Courses.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CourseDetail from './pages/CourseDetail.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <main className="page">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Courses /></Protected>} />
          <Route path="/my" element={<Protected><Dashboard /></Protected>} />
          <Route path="/courses/:id" element={<Protected><CourseDetail /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
