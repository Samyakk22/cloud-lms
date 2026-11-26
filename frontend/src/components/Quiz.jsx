import { useState } from 'react';
import { api } from '../api.js';

export default function Quiz({ course, onDone }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (course.questions.length === 0) {
    return <p className="muted">The instructor has not added a quiz yet.</p>;
  }

  const answered = course.questions.filter((_, i) => answers[i] !== undefined).length;
  const allAnswered = answered === course.questions.length;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api(`/courses/${course.id}/quiz/submit`, {
        method: 'POST',
        body: { answers: course.questions.map((_, i) => answers[i]) },
      });
      setResult(data);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setAnswers({});
    setResult(null);
  }

  return (
    <form onSubmit={submit} className="quiz">
      {course.bestScore != null && !result && <p className="muted">Your best score so far is {course.bestScore}%.</p>}

      {result && (
        <div className="score" role="status">
          <strong>{result.score} of {result.total} correct</strong>
          <span>{result.percent}%</span>
        </div>
      )}

      {course.questions.map((q, i) => (
        <fieldset key={q.id} className="question">
          <legend>{i + 1}. {q.question}</legend>
          {q.options.map((option, j) => {
            let state = '';
            if (result) {
              if (j === result.correct[i]) state = 'right';
              else if (answers[i] === j) state = 'wrong';
            }
            return (
              <label key={j} className={`choice ${state}`}>
                <input type="radio" name={`q${i}`} disabled={!!result} checked={answers[i] === j}
                  onChange={() => setAnswers({ ...answers, [i]: j })} />
                {option}
              </label>
            );
          })}
        </fieldset>
      ))}

      {!result && (
        <div className="progress">
          <div className="bar" aria-hidden="true"><span style={{ width: `${(answered / course.questions.length) * 100}%` }} /></div>
          <small className="muted">{answered} of {course.questions.length} answered</small>
        </div>
      )}

      {error && <p className="notice error" role="alert">{error}</p>}
      {result
        ? <button type="button" className="btn" onClick={retake}>Retake quiz</button>
        : <button className="btn btn-primary" disabled={!allAnswered || busy}>{busy ? 'Checking…' : 'Submit answers'}</button>}
    </form>
  );
}
