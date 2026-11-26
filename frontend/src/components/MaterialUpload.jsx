import { useRef, useState } from 'react';
import { uploadMaterial } from '../api.js';

export default function MaterialUpload({ courseId, onAdded }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(e) {
    e.preventDefault();
    const file = input.current.files[0];
    if (!file) return setError('Choose a file first');
    setError('');
    setBusy(true);
    try {
      await uploadMaterial(courseId, file);
      input.current.value = '';
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="upload" onSubmit={upload}>
      <input ref={input} type="file" aria-label="Course material file" />
      <button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Upload material'}</button>
      {error && <p className="notice error" role="alert">{error}</p>}
    </form>
  );
}
