import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import Page, { fieldCls, btnPrimary, card, Label, Notice } from "../components/Page";

export default function ForgotPassword() {
  const [params] = useSearchParams();
  const [step, setStep] = useState(params.get("token") ? 2 : 1);
  const [email, setEmail] = useState(""); const [code, setCode] = useState(params.get("token") || "");
  const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const submit = async (e) => { e.preventDefault(); setError(""); setMessage(""); try { if (step === 1) { await api("/password/forgot", { method: "POST", body: JSON.stringify({ email }) }); setStep(2); setMessage("تم إرسال رمز التحقق إلى بريدك الإلكتروني"); } else { await api("/password/reset", { method: "POST", body: JSON.stringify({ token: code, password }) }); setMessage("تم تغيير كلمة المرور بنجاح"); setStep(3); } } catch (x) { setError(x.message); } };
  return <Page title="استرجاع كلمة المرور" back="/login" backLabel="العودة لتسجيل الدخول"><form onSubmit={submit} className={`${card} mt-5 space-y-4 p-4`}>{step === 1 && <Label id="email" label="البريد الإلكتروني" error={error}><input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls(!!error)} dir="ltr" /></Label>}{step === 2 && <><Label id="code" label="رمز التحقق المرسل إلى Gmail" error={error}><input id="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={fieldCls(!!error)} dir="ltr" /></Label><Label id="password" label="كلمة المرور الجديدة" error={error}><input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className={fieldCls(!!error)} dir="ltr" /></Label></>}{step < 3 && <button className={btnPrimary}>{step === 1 ? "إرسال رمز التحقق" : "تغيير كلمة المرور"}</button>}{message && <Notice>{message}</Notice>}</form><Link to="/login" className="mt-4 block text-center text-sm text-gold-400">العودة لتسجيل الدخول</Link></Page>;
}
