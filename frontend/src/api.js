const TOKEN_KEY = 'lectern_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

// All calls use a relative /api path: Vite proxy in dev, CloudFront behavior in production.
export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/auth/')) {
      setToken(null);
      window.location.assign('/login');
    }
    throw new Error(data.message || 'Something went wrong. Try again');
  }
  return data;
}

// Browser uploads straight to S3 with a presigned URL, so files never pass through the servers.
export async function uploadMaterial(courseId, file) {
  const contentType = file.type || 'application/octet-stream';
  const { uploadUrl, key } = await api(`/courses/${courseId}/materials/upload-url`, {
    method: 'POST',
    body: { filename: file.name, contentType },
  });
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!put.ok) throw new Error('The upload to storage failed. Check the bucket CORS settings');
  return api(`/courses/${courseId}/materials`, {
    method: 'POST',
    body: { name: file.name, key, contentType },
  });
}
