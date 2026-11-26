import { Link } from 'react-router-dom';
import Cover from './Cover.jsx';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function CourseTile({ course }) {
  return (
    <Link to={`/courses/${course.id}`} className="tile">
      <Cover title={course.title} />
      <div className="tile-body">
        <h3>{course.title}</h3>
        <p className="muted">{course.instructor}</p>
        <p className="tile-meta">
          {plural(course.materialCount, 'material')}, {plural(course.questionCount, 'question')}
        </p>
        <div className="tile-foot">
          {course.owner && <span className="badge">Your course</span>}
          {course.enrolled && <span className="badge badge-blue">Enrolled</span>}
          {course.bestScore != null && <span className="badge badge-mark">Best score {course.bestScore}%</span>}
        </div>
      </div>
    </Link>
  );
}
