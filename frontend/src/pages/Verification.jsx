import { useEffect, useState } from "react";
import { BadgeCheck, Upload } from "lucide-react";
import { api } from "../lib/api";
import Page, { card, fieldCls, btnPrimary, Label, Notice } from "../components/Page";

const statusNames = { pending: "قيد المراجعة", approved: "موثّق", rejected: "مرفوض" };

export default function Verification() {
    const [current, setCurrent] = useState(null);
    const [form, setForm] = useState({ fullName: "", nationalId: "", birthDate: "", province: "", idFrontUrl: "", idBackUrl: "", selfieUrl: "" });
    const [files, setFiles] = useState({ idFrontUrl: null, idBackUrl: null, selfieUrl: null });
    const [message, setMessage] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { api("/verification/me").then((v) => { if (v) { setCurrent(v); setForm({ fullName: v.fullName || "", nationalId: v.nationalId || "", birthDate: v.birthDate || "", province: v.province || "", idFrontUrl: v.idFrontUrl || "", idBackUrl: v.idBackUrl || "", selfieUrl: v.selfieUrl || "" }); } }).catch((e) => setMessage({ bad: true, text: e.message })); }, []);
    const upload = async (file) => { const body = new FormData(); body.append("file", file); return api("/uploads", { method: "POST", body }); };
    const submit = async (e) => {
        e.preventDefault(); setMessage(null);
        if (form.fullName.trim().length < 3 || form.nationalId.trim().length < 5 || !form.birthDate || form.province.trim().length < 2) return setMessage({ bad: true, text: "أكمل جميع البيانات المطلوبة." });
        if ((!files.idFrontUrl && !form.idFrontUrl) || (!files.idBackUrl && !form.idBackUrl) || (!files.selfieUrl && !form.selfieUrl)) return setMessage({ bad: true, text: "ارفع صورة الوجهين الأمامي والخلفي للهوية والصورة الشخصية." });
        setBusy(true);
        try {
            const payload = { ...form };
            for (const key of ["idFrontUrl", "idBackUrl", "selfieUrl"]) if (files[key]) payload[key] = (await upload(files[key])).url;
            const result = await api("/verification", { method: "POST", body: JSON.stringify(payload) });
            setCurrent(result); setForm(payload); setMessage({ text: "تم إرسال طلب التوثيق للمراجعة." });
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    const locked = current?.status === "approved" || current?.status === "pending";
    return <Page title="توثيق الحساب">
        <section className={card + " mt-5 p-4"}><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-full bg-gold-500/15 text-gold-300"><BadgeCheck className="size-7"/></span><div><h2 className="font-bold">حالة التوثيق</h2><p className={"text-sm " + (current?.status === "approved" ? "text-emerald-300" : current?.status === "rejected" ? "text-red-300" : "text-gold-300")}>{current ? statusNames[current.status] : "لم يتم تقديم طلب"}</p></div></div>{current?.adminNote && <p className="mt-3 rounded-xl bg-ink-800 p-3 text-sm">ملاحظة الإدارة: {current.adminNote}</p>}</section>
        <form onSubmit={submit} className={card + " mt-5 space-y-4 p-4"}>
            <Label id="fullName" label="الاسم الكامل حسب الهوية"><input disabled={locked} id="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={fieldCls()}/></Label>
            <Label id="nationalId" label="الرقم الوطني / رقم الوثيقة"><input disabled={locked} id="nationalId" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} className={fieldCls()} dir="ltr"/></Label>
            <div className="grid grid-cols-2 gap-3"><Label id="birthDate" label="تاريخ الميلاد"><input disabled={locked} id="birthDate" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={fieldCls()} dir="ltr"/></Label><Label id="province" label="المحافظة"><input disabled={locked} id="province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className={fieldCls()}/></Label></div>
            {[["idFrontUrl","الوجه الأمامي للهوية"],["idBackUrl","الوجه الخلفي للهوية"],["selfieUrl","صورة شخصية واضحة مع الهوية"]].map(([key,label]) => <div key={key}><p className="mb-1.5 text-sm">{label}</p><label className={"flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-700 px-4 py-3 text-sm " + (locked ? "pointer-events-none opacity-60" : "")}><Upload className="size-5 text-gold-400"/><span className="truncate">{files[key]?.name || (form[key] ? "تم رفع الملف سابقًا" : "اختر صورة")}</span><input disabled={locked} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFiles({ ...files, [key]: e.target.files?.[0] || null })}/></label></div>)}
            {!locked && <button disabled={busy} className={btnPrimary}>{busy ? "جارٍ رفع الملفات..." : current?.status === "rejected" ? "إعادة إرسال الطلب" : "إرسال طلب التوثيق"}</button>}
            {message && <Notice bad={message.bad}>{message.text}</Notice>}
            <p className="text-xs leading-relaxed text-mute">تُستخدم الوثائق للتحقق فقط، ولا تظهر لبقية المستخدمين. تأكد أن الصور واضحة وغير مقصوصة.</p>
        </form>
    </Page>;
}
