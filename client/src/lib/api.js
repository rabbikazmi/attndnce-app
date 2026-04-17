const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export async function apiRequest(path, options = {}, token) {
  const headers = {
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const targetPath = `${API_BASE}${path}`;

  const response = await fetch(targetPath, {
    ...options,
    headers: options.body instanceof FormData ? headers : { ...headers },
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const error = payload && typeof payload === "object" && payload.error ? payload.error : "Something went wrong.";
    throw new Error(error);
  }

  return payload;
}
