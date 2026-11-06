import { useEffect, useMemo, useRef, useState } from "react";
import {
    Camera, CheckCircle2, Printer, QrCode, ReceiptText, RefreshCw,
    Search, Send, ShieldCheck, WalletCards, X,
} from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Field, inputCls, btnGold, btnGhost } from "./ui";

const money = (value, currency) => `${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: currency === "SYP" ? 0 : 2 })} ${currency}`;
const newKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const errorText = (message) => ({
    "Incorrect owner PIN": "رمز PIN الخاص بالمالك غير صحيح.",
    "Owner wallet balance is insufficient": "رصيد محفظة المالك غير كافٍ.",
    "Active recipient wallet not found": "لم يتم العثور على محفظة مستخدم فعّالة.",
    "Cannot transfer to the same wallet": "لا يمكن التحويل إلى محفظة المالك نفسها.",
    "Invalid transfer data": "بيانات التحويل غير صحيحة.",
}[message] || message || "تعذّر تنفيذ العملية.");

function TransferReceipt({ receipt, onClose }) {
    if (!receipt) return null;
    const recipient = receipt.toUser || receipt.recipient || {};
    return (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/80 p-3" role="dialog" aria-modal="true">
            <div className="receipt-card w-full max-w-md overflow-hidden rounded-3xl border border-gold-500/50 bg-ink-900 shadow-2xl">
                <div className="bg-gradient-to-l from-gold-600 to-gold-300 p-5 text-ink-950">
                    <div className="flex items-center justify-between">
                        <div><p className="text-xs font-semibold">RS STORE</p><h3 className="text-xl font-black">إيصال تحويل رصيد</h3></div>
                        <ReceiptText className="size-10" />
                    </div>
                </div>
                <div className="space-y-4 p-5">
                    <div className="rounded-2xl border border-gold-500/25 bg-gold-500/10 p-4 text-center">
                        <p className="text-xs text-mute">المبلغ المحوّل</p>
                        <p className="mt-1 text-2xl font-black text-gold-300" dir="ltr">{money(receipt.amount, receipt.currency)}</p>
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                        <dt className="text-mute">رقم العملية</dt><dd className="text-left font-semibold" dir="ltr">{receipt.transferNumber}</dd>
                        <dt className="text-mute">المستلم</dt><dd className="text-left font-semibold">{recipient.name || "—"}</dd>
                        <dt className="text-mute">رمز المحفظة</dt><dd className="text-left font-semibold" dir="ltr">{recipient.walletId || "—"}</dd>
                        <dt className="text-mute">التاريخ</dt><dd className="text-left" dir="ltr">{new Date(receipt.createdAt).toLocaleString("ar-SY")}</dd>
                        {receipt.note && <><dt className="text-mute">الملاحظة</dt><dd className="text-left">{receipt.note}</dd></>}
                    </dl>
                    <div className="flex items-center justify-center gap-2 border-t border-dashed border-ink-700 pt-4 text-xs text-emerald-400"><CheckCircle2 className="size-4" />تم التحويل بنجاح</div>
                    <div className="receipt-actions grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => window.print()} className={btnGold + " flex items-center justify-center gap-2"}><Printer className="size-4" />طباعة</button>
                        <button type="button" onClick={onClose} className={btnGhost}>إغلاق</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function WalletTransferTab() {
    const [owner, setOwner] = useState(null);
    const [history, setHistory] = useState([]);
    const [walletId, setWalletId] = useState("");
    const [recipient, setRecipient] = useState(null);
    const [form, setForm] = useState({ currency: "USD", amount: "", note: "", pin: "" });
    const [idempotencyKey, setIdempotencyKey] = useState(newKey);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [receipt, setReceipt] = useState(null);
    const [filter, setFilter] = useState({ search: "", currency: "all" });
    const videoRef = useRef(null), streamRef = useRef(null), timerRef = useRef(null);

    const load = async () => {
        setBusy(true);
        try {
            const [account, transfers] = await Promise.all([api("/auth/me"), api("/admin/wallet-transfers")]);
            setOwner(account); setHistory(transfers);
        } catch (error) { setMessage({ bad: true, text: errorText(error.message) }); }
        finally { setBusy(false); }
    };
    useEffect(() => { load(); return stopCamera; }, []);

    const shownHistory = useMemo(() => history.filter((item) => {
        const query = filter.search.trim().toLowerCase();
        const matchesCurrency = filter.currency === "all" || item.currency === filter.currency;
        const haystack = `${item.transferNumber} ${item.toUser?.name || ""} ${item.toUser?.walletId || ""}`.toLowerCase();
        return matchesCurrency && (!query || haystack.includes(query));
    }), [history, filter]);

    const lookup = async (value = walletId) => {
        const normalized = String(value || "").trim().toUpperCase();
        if (!normalized) return;
        setBusy(true); setMessage(null); setRecipient(null);
        try {
            const user = await api("/admin/wallet-transfers/lookup?walletId=" + encodeURIComponent(normalized));
            setWalletId(user.walletId); setRecipient(user);
        } catch (error) { setMessage({ bad: true, text: errorText(error.message) }); }
        finally { setBusy(false); }
    };

    function stopCamera() {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null; setCameraOpen(false);
    }
    const startCamera = async () => {
        setMessage(null);
        if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
            return setMessage({ bad: true, text: "المتصفح لا يدعم ماسح الباركود. استخدم Chrome أو Edge، أو أدخل رمز المحفظة يدويًا." });
        }
        try {
            setCameraOpen(true);
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
            streamRef.current = stream;
            await new Promise((resolve) => window.setTimeout(resolve, 50));
            if (!videoRef.current) return stopCamera();
            videoRef.current.srcObject = stream; await videoRef.current.play();
            const supported = await window.BarcodeDetector.getSupportedFormats?.() || [];
            const wanted = ["qr_code", "code_128", "code_39", "ean_13", "ean_8"].filter((format) => !supported.length || supported.includes(format));
            const detector = new window.BarcodeDetector(wanted.length ? { formats: wanted } : undefined);
            timerRef.current = window.setInterval(async () => {
                try {
                    const found = await detector.detect(videoRef.current);
                    const raw = found[0]?.rawValue?.trim(); if (!raw) return;
                    const value = raw.match(/RS-[A-Z0-9-]+/i)?.[0] || raw;
                    stopCamera(); setWalletId(value.toUpperCase()); await lookup(value);
                } catch { /* تستمر المحاولة حتى قراءة الرمز */ }
            }, 500);
        } catch (error) {
            stopCamera();
            setMessage({ bad: true, text: error.name === "NotAllowedError" ? "يجب السماح باستخدام الكاميرا لمسح الباركود." : "تعذّر تشغيل الكاميرا." });
        }
    };

    const transfer = async (event) => {
        event.preventDefault();
        const amount = Number(form.amount);
        if (!recipient || !(amount > 0)) return setMessage({ bad: true, text: "اختر مستخدمًا وأدخل مبلغًا صحيحًا." });
        if (owner?.hasPin && !/^\d{4,8}$/.test(form.pin)) return setMessage({ bad: true, text: "أدخل رمز PIN الخاص بالمالك من 4 إلى 8 أرقام." });
        if (!window.confirm(`تأكيد تحويل ${money(amount, form.currency)} إلى ${recipient.name} (${recipient.walletId})؟`)) return;
        setBusy(true); setMessage(null);
        try {
            const result = await api("/admin/wallet-transfers", { method: "POST", body: JSON.stringify({ walletId: recipient.walletId, currency: form.currency, amount, note: form.note.trim(), pin: form.pin, idempotencyKey }) });
            const completed = { ...result.transfer, toUser: result.transfer.toUser || recipient };
            if (result.owner) setOwner(result.owner);
            setHistory((list) => [completed, ...list.filter((item) => item._id !== completed._id)]);
            setReceipt(completed);
            setMessage({ text: `تم التحويل بنجاح. رقم العملية: ${completed.transferNumber}` });
            setWalletId(""); setRecipient(null);
            setForm((current) => ({ ...current, amount: "", note: "", pin: "" }));
            setIdempotencyKey(newKey());
        } catch (error) { setMessage({ bad: true, text: errorText(error.message) }); }
        finally { setBusy(false); }
    };

    return <section className="space-y-5">
        <div className="grid grid-cols-3 gap-2">{["USD", "SYP", "TRY"].map((currency) => <div key={currency} className="rounded-2xl border border-ink-700 bg-ink-900 p-3 text-center"><p className="text-xs text-mute">رصيد المالك</p><p className="mt-1 font-bold text-gold-300" dir="ltr">{money(owner?.balances?.[currency], currency)}</p></div>)}</div>

        <form onSubmit={transfer} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-gold-500/15 text-gold-400"><WalletCards className="size-6" /></span><div><h3 className="font-bold">تحويل رصيد مباشر</h3><p className="text-xs text-mute">امسح باركود المستخدم أو أدخل رمز المحفظة يدويًا.</p></div></div>
            <Field label="رمز محفظة المستخدم"><div className="flex gap-2"><div className="relative flex-1"><QrCode className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-gold-400" /><input value={walletId} onChange={(event) => { setWalletId(event.target.value.toUpperCase()); setRecipient(null); }} placeholder="RS-XXXXXXXXXXXX" dir="ltr" className={inputCls() + " ps-10"} /></div><button type="button" onClick={() => lookup()} disabled={busy || !walletId.trim()} className={btnGhost} aria-label="بحث"><Search className="size-5" /></button><button type="button" onClick={startCamera} className={btnGold + " flex items-center gap-2"}><Camera className="size-5" /><span className="hidden sm:inline">مسح</span></button></div></Field>
            {recipient && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3"><div className="flex items-center gap-3"><CheckCircle2 className="size-6 shrink-0 text-emerald-400" /><div className="min-w-0 flex-1"><p className="font-bold">{recipient.name}</p><p className="truncate text-xs text-mute" dir="ltr">{recipient.email} · {recipient.walletId}</p></div><p className="text-xs text-emerald-300">حساب فعّال</p></div><div className="mt-3 grid grid-cols-3 gap-2 border-t border-emerald-500/20 pt-3 text-center text-xs">{["USD", "SYP", "TRY"].map((currency) => <span key={currency} dir="ltr">{money(recipient.balances?.[currency], currency)}</span>)}</div></div>}
            <div className="grid gap-3 sm:grid-cols-2"><Field label="العملة"><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} className={inputCls()}><option value="USD">دولار USD</option><option value="SYP">ليرة سورية SYP</option><option value="TRY">ليرة تركية TRY</option></select></Field><Field label="المبلغ"><input required type="number" min="0.01" step={form.currency === "SYP" ? "1" : "0.01"} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={inputCls()} dir="ltr" /></Field></div>
            <Field label="ملاحظة التحويل" hint="اختياري، وتظهر في السجل المالي"><input maxLength="300" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className={inputCls()} placeholder="مثال: تحويل مباشر من إدارة المتجر" /></Field>
            {owner?.hasPin && <Field label="رمز PIN الخاص بالمالك" hint="مطلوب لحماية التحويلات المالية"><div className="relative"><ShieldCheck className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-gold-400" /><input required type="password" inputMode="numeric" autoComplete="off" minLength="4" maxLength="8" pattern="[0-9]{4,8}" value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, "") })} className={inputCls() + " ps-10"} placeholder="••••" dir="ltr" /></div></Field>}
            {!owner?.hasPin && owner && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">ننصح بتعيين رمز PIN لحساب المالك من صفحة الحساب لحماية التحويلات.</p>}
            {message && <p className={(message.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300") + " rounded-xl border p-3 text-sm"}>{message.text}</p>}
            <button disabled={busy || !recipient || !(Number(form.amount) > 0)} className={btnGold + " flex w-full items-center justify-center gap-2 py-3"}><Send className="size-4" />{busy ? "جارٍ تنفيذ التحويل..." : "تنفيذ التحويل الآن"}</button>
        </form>

        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">سجل التحويلات</h3><button type="button" onClick={load} className={btnGhost} aria-label="تحديث"><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"} /></button></div>
            <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_150px]"><div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-mute" /><input value={filter.search} onChange={(event) => setFilter({ ...filter, search: event.target.value })} className={inputCls() + " ps-9"} placeholder="بحث بالاسم أو المحفظة أو رقم العملية" /></div><select value={filter.currency} onChange={(event) => setFilter({ ...filter, currency: event.target.value })} className={inputCls()}><option value="all">كل العملات</option><option value="USD">USD</option><option value="SYP">SYP</option><option value="TRY">TRY</option></select></div>
            {!shownHistory.length ? <Empty>لا توجد تحويلات مطابقة.</Empty> : <div className="space-y-2">{shownHistory.map((item) => <article key={item._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 p-3"><span className="grid size-10 place-items-center rounded-xl bg-gold-500/10 text-gold-400"><WalletCards className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.toUser?.name} · <span dir="ltr">{item.toUser?.walletId}</span></p><p className="text-xs text-mute" dir="ltr">{item.transferNumber} · {new Date(item.createdAt).toLocaleString("ar-SY")}</p></div><p className="font-bold text-gold-300" dir="ltr">{money(item.amount, item.currency)}</p><button type="button" onClick={() => setReceipt(item)} className="rounded-lg border border-ink-700 p-2 text-gold-400" aria-label="عرض الإيصال"><ReceiptText className="size-4" /></button></article>)}</div>}
        </div>

        {cameraOpen && <div className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4"><div className="w-full max-w-md rounded-2xl border border-gold-500/50 bg-ink-900 p-4"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-bold">مسح رمز المحفظة</h3><p className="text-xs text-mute">وجّه الكاميرا نحو الباركود أو رمز QR.</p></div><button type="button" onClick={stopCamera} className="rounded-lg p-2 text-red-400"><X className="size-5" /></button></div><div className="relative overflow-hidden rounded-xl bg-black"><video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" /><div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-gold-400 shadow-[0_0_0_999px_rgba(0,0,0,.25)]" /></div></div></div>}
        <TransferReceipt receipt={receipt} onClose={() => setReceipt(null)} />
    </section>;
}
