const API_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "rs_access_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function api(path, options = {}) {
  const headers = { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) };
  const token = getToken(); if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "حدث خطأ في الاتصال بالخادم");
  return data;
}

export async function apiBlob(path) {
  const token = getToken();
  const response = await fetch(API_URL + path, { headers: token ? { Authorization: "Bearer " + token } : {} });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "تعذر تحميل الملف"); }
  return URL.createObjectURL(await response.blob());
}
