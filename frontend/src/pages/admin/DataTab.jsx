import { useEffect, useState } from "react";
import { DatabaseBackup, Download, Eye, FileSpreadsheet, RefreshCw, ShieldCheck, X } from "lucide-react";
import { api, apiBlob } from "../../lib/api";
import { downloadFile, toCsv } from "../../lib/admin";
import { btnGhost, btnGold } from "./ui";

const box = "rounded-2xl border border-ink-700 bg-ink-900 p-5";
const iso = (value) => value ? new Date(value).toISOString().replace("T", " ").slice(0, 16) : "";

export default function DataTab() {
    const [summary, setSummary] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    const [preview, setPreview] = useState(null);

    const load = async () => {
        setBusy(true); setMessage(null);
        try {
            const [nextSummary, snapshotData] = await Promise.all([api("/admin/data/summary"), api("/admin/data/snapshots")]);
            setSummary(nextSummary); setSnapshots(snapshotData.items || []);
        }
        catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    useEffect(() => { load(); }, []);

    const exportCsv = async (type) => {
        setBusy(true); setMessage(null);
        try {
            const { items } = await api("/admin/data/export/" + type);
            let csv;
            if (type === "orders") {
                const rows = items.flatMap((order) => order.items.map((item) => [order.orderNumber, iso(order.createdAt), order.user?.name || "", order.user?.email || "", item.name, item.packageTitle, item.quantity, item.price, order.discount, order.totalAmount, order.currency, order.status, order.couponCode || ""]));
                csv = toCsv(["رقم الطلب", "التاريخ", "المستخدم", "البريد", "المنتج", "الباقة", "الكمية", "سعر الوحدة", "الخصم", "الإجمالي", "العملة", "الحالة", "الكوبون"], rows);
            } else if (type === "deposits") {
                csv = toCsv(["التاريخ", "المستخدم", "البريد", "طريقة الإيداع", "العملة", "المبلغ", "المرجع", "الحالة", "ملاحظة الإدارة"], items.map((item) => [iso(item.createdAt), item.user?.name || "", item.user?.email || "", item.methodSlug, item.currency, item.amount, item.reference, item.status, item.adminNote || ""]));
            } else {
                csv = toCsv(["التاريخ", "المستخدم", "البريد", "النوع", "الرسالة", "الرد", "الحالة"], items.map((item) => [iso(item.createdAt), item.user?.name || "", item.user?.email || "", item.kind, item.text, item.reply || "", item.status]));
            }
            downloadFile(`${type}-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
            setMessage({ text: `تم تصدير ${items.length} سجلاً من PostgreSQL.` });
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };

    const backup = async () => {
        setBusy(true); setMessage(null);
        try {
            const data = await api("/admin/data/backup");
            downloadFile(`rs-store-postgresql-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
            setMessage({ text: "تم إنشاء نسخة احتياطية آمنة من قاعدة البيانات." });
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };

    const createSnapshot = async () => {
        setBusy(true); setMessage(null);
        try { await api("/admin/data/snapshots", { method: "POST" }); await load(); setMessage({ text: "تم إنشاء نسخة احتياطية مشفّرة وحفظها في التخزين الخاص." }); }
        catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };
    const downloadSnapshot = async (item) => {
        setBusy(true); setMessage(null);
        try {
            const url = await apiBlob(`/admin/data/snapshots/${item.id}/download`);
            const anchor = document.createElement("a"); anchor.href = url; anchor.download = `rs-store-backup-${String(item.createdAt).slice(0, 10)}.json`; document.body.appendChild(anchor); anchor.click(); anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };

    const previewSnapshot = async (item) => {
        setBusy(true); setMessage(null);
        try {
            const url = await apiBlob(`/admin/data/snapshots/${item.id}/download`);
            const response = await fetch(url);
            if (!response.ok) throw new Error("تعذر قراءة النسخة الاحتياطية");
            const data = await response.json();
            URL.revokeObjectURL(url);
            setPreview({ item, data });
        } catch (error) { setMessage({ bad: true, text: error.message }); }
        finally { setBusy(false); }
    };

    const previewPayload = preview?.data?.data || preview?.data || {};
    const previewCounts = preview ? [
        ["المستخدمون", previewPayload.users?.length], ["الطلبات", previewPayload.orders?.length],
        ["الإيداعات", previewPayload.deposits?.length], ["المنتجات", previewPayload.products?.length],
        ["التذاكر", previewPayload.tickets?.length], ["سجل الحركات", previewPayload.ledger?.length]
    ] : [];

    const cards = summary ? [
        ["المستخدمون", summary.users], ["المنتجات", summary.products], ["الطلبات", summary.orders],
        ["الإيداعات", summary.deposits], ["الفواتير", summary.invoices], ["سجل الأموال", summary.ledger],
        ["أكواد المخزن", summary.codes], ["تذاكر الدعم", summary.tickets], ["تحويلات الرصيد", summary.transfers]
    ] : [];

    return <div className="space-y-5" dir="rtl">
        <section className={box}>
            <div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-5 text-gold-400"/>بيانات PostgreSQL</h2><p className="mt-1 text-sm text-mute">جميع الأرقام والتقارير في هذه الصفحة تُقرأ مباشرة من قاعدة بيانات المتجر.</p></div><button type="button" onClick={load} className={btnGhost} aria-label="تحديث"><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"}/></button></div>
            {!summary && !message && <p className="mt-4 text-sm text-mute">جارِ قراءة الإحصائيات...</p>}
            {summary && <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-xl bg-ink-800 p-3"><p className="text-xs text-mute">{label}</p><p className="mt-1 text-xl font-extrabold text-gold-300" dir="ltr">{Number(value || 0).toLocaleString("en-US")}</p></div>)}</div>}
        </section>

        <section className={box}>
            <h2 className="flex items-center gap-2 font-bold"><FileSpreadsheet className="size-5 text-gold-400"/>تصدير تقارير CSV</h2><p className="mt-1 text-sm text-mute">تقارير حقيقية قابلة للفتح في Excel أو Google Sheets.</p>
            <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} type="button" onClick={() => exportCsv("orders")} className={`${btnGhost} flex items-center gap-2`}><Download className="size-4"/>الطلبات</button><button disabled={busy} type="button" onClick={() => exportCsv("deposits")} className={`${btnGhost} flex items-center gap-2`}><Download className="size-4"/>الإيداعات</button><button disabled={busy} type="button" onClick={() => exportCsv("feedback")} className={`${btnGhost} flex items-center gap-2`}><Download className="size-4"/>الشكاوى والاقتراحات</button></div>
        </section>

        <section className={box}>
            <h2 className="flex items-center gap-2 font-bold"><DatabaseBackup className="size-5 text-gold-400"/>نسخة احتياطية إدارية</h2><p className="mt-1 text-sm text-mute">تتضمن بيانات المتجر المالية والتشغيلية، ولا تتضمن كلمات المرور أو PIN أو رموز التحقق.</p>
            <button disabled={busy} type="button" onClick={backup} className={`${btnGold} mt-4 flex items-center gap-2`}><Download className="size-4"/>{busy ? "جارِ التجهيز..." : "تنزيل النسخة الاحتياطية"}</button>
        </section>

        <section className={box}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-5 text-gold-400"/>النسخ المشفّرة</h2><p className="mt-1 text-sm text-mute">نسخ AES-256-GCM خاصة، مع فحص سلامة SHA-256 قبل التنزيل.</p></div><button disabled={busy} type="button" onClick={createSnapshot} className={`${btnGold} flex items-center gap-2`}><DatabaseBackup className="size-4"/>إنشاء نسخة آمنة</button></div>
            <div className="mt-4 space-y-2">{snapshots.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-ink-800 p-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">{iso(item.createdAt)}</p><p className="truncate text-xs text-mute" dir="ltr">SHA-256: {item.checksum}</p></div><span className="text-xs text-mute" dir="ltr">{(item.sizeBytes / 1024).toFixed(1)} KB</span><button type="button" disabled={busy} onClick={() => downloadSnapshot(item)} className={btnGhost} aria-label="تنزيل النسخة"><Download className="size-4"/></button></div>)}{!snapshots.length && <p className="text-sm text-mute">لا توجد نسخ مشفّرة بعد.</p>}</div>
        </section>

        {preview && <section className={`${box} border-gold-500/40`} dir="rtl" aria-live="polite"><div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold"><Eye className="size-5 text-gold-400"/>معاينة النسخة الاحتياطية</h2><p className="mt-1 text-sm text-mute">هذه معاينة آمنة فقط؛ لم يتم تعديل قاعدة البيانات.</p></div><button type="button" onClick={() => setPreview(null)} className={btnGhost} aria-label="إغلاق المعاينة"><X className="size-4"/></button></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{previewCounts.map(([label, value]) => <div key={label} className="rounded-xl bg-ink-800 p-3"><p className="text-xs text-mute">{label}</p><p className="mt-1 text-xl font-extrabold text-gold-300" dir="ltr">{Number(value || 0).toLocaleString("en-US")}</p></div>)}</div><div className="mt-4 rounded-xl border border-ink-700 bg-ink-950/40 p-3 text-xs text-mute"><p>تاريخ الإنشاء: <span dir="ltr">{iso(preview.item.createdAt)}</span></p><p className="mt-1 break-all">البصمة: <span dir="ltr">{preview.item.checksum}</span></p><p className="mt-1">الحجم: <span dir="ltr">{(preview.item.sizeBytes / 1024).toFixed(1)} KB</span></p></div><p className="mt-3 text-xs text-amber-300">الاستعادة الفعلية ستُفعّل بعد التأكد من اتصال قاعدة البيانات وإضافة تأكيد مزدوج قبل الكتابة.</p></section>}
        {message && <p className={(message.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300") + " rounded-xl border p-3 text-sm"}>{message.text}</p>}
        {snapshots[0] && <button type="button" disabled={busy} onClick={() => previewSnapshot(snapshots[0])} className={`${btnGhost} flex items-center gap-2`}><Eye className="size-4"/>معاينة أحدث نسخة</button>}
    </div>;
}
