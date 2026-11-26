import { useEffect, useState } from 'react';
import { api } from '../api.js';
import CourseTile from '../components/CourseTile.jsx';
import Skeletons from '../components/Skeletons.jsx';

export default function Courses() {
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api('/courses').then((d) => setCourses(d.courses)).catch((e) => setError(e.message));
  }, []);

  const term = search.trim().toLowerCase();
  const shown = courses && courses.filter((c) => `${c.title} ${c.instructor}`.toLowerCase().includes(term));

  return (
    <>
      <div className="toolbar">
        <h1>All courses</h1>
        {courses && courses.length > 0 && (
          <input type="search" placeholder="Search by title or instructor" aria-label="Search courses"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
      </div>

      {error && <p className="notice error">{error}</p>}
      {!courses && !error && <Skeletons />}

      {courses && courses.length === 0 && (
        <div className="empty">
          <h3>No courses yet</h3>
          <p>Instructors can create the first one from the Teaching page.</p>
        </div>
      )}
      {shown && courses.length > 0 && shown.length === 0 && (
        <div className="empty">
          <h3>No matches</h3>
          <p>Nothing matches “{search.trim()}”. Try another word.</p>
        </div>
      )}
      {shown && shown.length > 0 && (
        <div className="grid">{shown.map((c) => <CourseTile key={c.id} course={c} />)}</div>
      )}
    </>
  );
}
