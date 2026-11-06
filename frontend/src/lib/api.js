const API_URL = "/api";
const TOKEN_KEY = "rs_access_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new Error("انتهت مهلة الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مجدداً.");
    }
    throw new Error("تعذر الاتصال بالخادم. تحقق من نشر واجهة API وإعدادات Supabase في Vercel.");
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 404 && !data.message) {
    throw new Error("خدمة الخادم (API) غير متاحة على هذا الرابط. تأكد من نشر مجلد api على Vercel ثم أعد النشر.");
  }
  if (!response.ok) {
    if (data.code === "PASSWORD_CHANGE_REQUIRED" && !window.location.pathname.startsWith("/admin")) {
      window.location.assign("/admin");
    }
    throw new Error(data.message || "تعذر إكمال الطلب إلى الخادم.");
  }
  return data;
}

export async function apiBlob(path) {
  const token = getToken();
  const response = await fetch(API_URL + path, {
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "تعذر تنزيل الملف.");
  }
  return URL.createObjectURL(await response.blob());
}
