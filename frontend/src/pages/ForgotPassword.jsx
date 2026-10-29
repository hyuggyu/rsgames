import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import Page, { fieldCls, btnPrimary, card, Label, Notice } from "../components/Page";

export default function ForgotPassword() {
  const [params] = useSearchParams(); const token = params.get("token");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const submit = async (e) => { e.preventDefault(); setError(""); setMessage(""); try { if (token) { await api("/password/reset", { method: "POST", body: JSON.stringify({ token, password }) }); setMessage("تم تغيير كلمة المرور بنجاح"); } else { await api("/password/forgot", { method: "POST", body: JSON.stringify({ email }) }); setMessage("إذا كان البريد مسجلاً، سيصلك رابط الاستعادة"); } } catch (x) { setError(x.message); } };
  return <Page title="استعادة كلمة المرور" back="/login" backLabel="تسجيل الدخول"><form onSubmit={submit} className={`${card} mt-5 space-y-4 p-4`}>{token ? <Label id="password" label="كلمة المرور الجديدة" error={error}><input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={fieldCls(!!error)} dir="ltr" /></Label> : <Label id="email" label="البريد الإلكتروني" error={error}><input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls(!!error)} dir="ltr" /></Label>}<button className={btnPrimary}>{token ? "تعيين كلمة المرور" : "إرسال رابط الاستعادة"}</button>{message && <Notice>{message}</Notice>}</form><Link to="/login" className="mt-4 block text-center text-sm text-gold-400">العودة لتسجيل الدخول</Link></Page>;
}
