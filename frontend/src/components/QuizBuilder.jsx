import { useState } from 'react';
import { api } from '../api.js';

const blank = () => ({ question: '', options: ['', '', '', ''], answerIndex: 0 });

const fromCourse = (questions) =>
  questions.map((q) => ({
    question: q.question,
    options: [...q.options, '', '', '', ''].slice(0, Math.max(4, q.options.length)),
    answerIndex: q.answerIndex,
  }));

export default function QuizBuilder({ course, onSaved }) {
  const [questions, setQuestions] = useState(fromCourse(course.questions));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (i, patch) => {
    setSaved(false);
    setQuestions(questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };
  const setOption = (i, j, value) =>
    update(i, { options: questions[i].options.map((o, idx) => (idx === j ? value : o)) });

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Drop empty options and re-point the correct answer at the filtered list.
      const payload = questions.map((q) => {
        const kept = q.options.map((text, index) => ({ text: text.trim(), index })).filter((o) => o.text);
        return {
          question: q.question,
          options: kept.map((o) => o.text),
          answerIndex: kept.findIndex((o) => o.index === q.answerIndex),
        };
      });
      await api(`/courses/${course.id}/quiz`, { method: 'PUT', body: { questions: payload } });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="quiz">
      {questions.length === 0 && <p className="muted">No questions yet. Add the first one.</p>}

      {questions.map((q, i) => (
        <fieldset key={i} className="question">
          <legend>Question {i + 1}</legend>
          <input aria-label={`Question ${i + 1} text`} placeholder="Ask something" value={q.question}
            onChange={(e) => update(i, { question: e.target.value })} />
          {q.options.map((option, j) => (
            <div key={j} className="option-row">
              <input type="radio" name={`correct-${i}`} aria-label={`Mark option ${j + 1} as correct`}
                checked={q.answerIndex === j} onChange={() => update(i, { answerIndex: j })} />
              <input aria-label={`Option ${j + 1}`} placeholder={`Option ${j + 1}`} value={option}
                onChange={(e) => setOption(i, j, e.target.value)} />
            </div>
          ))}
          <button type="button" className="btn btn-quiet" onClick={() => { setSaved(false); setQuestions(questions.filter((_, idx) => idx !== i)); }}>
            Remove question
          </button>
        </fieldset>
      ))}

      {error && <p className="notice error" role="alert">{error}</p>}
      {saved && <p className="notice ok" role="status">Quiz saved</p>}
      <div className="row">
        {questions.length < 20 && (
          <button type="button" className="btn" onClick={() => { setSaved(false); setQuestions([...questions, blank()]); }}>Add question</button>
        )}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save quiz'}</button>
      </div>
    </form>
  );
}
