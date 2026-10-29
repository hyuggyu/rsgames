import { useEffect, useState } from "react";
import { DatabaseBackup, Download, FileSpreadsheet, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api";
import { downloadFile, toCsv } from "../../lib/admin";
import { btnGhost, btnGold } from "./ui";

const box = "rounded-2xl border border-ink-700 bg-ink-900 p-5";
const iso = (value) => value ? new Date(value).toISOString().replace("T", " ").slice(0, 16) : "";

export default function DataTab() {
    const [summary, setSummary] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);

    const load = async () => {
        setBusy(true); setMessage(null);
        try { setSummary(await api("/admin/data/summary")); }
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

    const cards = summary ? [
        ["المستخدمون", summary.users], ["المنتجات", summary.products], ["الطلبات", summary.orders],
        ["الإيداعات", summary.deposits], ["الفواتير", summary.invoices], ["سجل الأموال", summary.ledger],
        ["أكواد المخزن", summary.codes], ["تذاكر الدعم", summary.tickets], ["تحويلات الرصيد", summary.transfers]
    ] : [];

    return <div className="space-y-5">
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

        {message && <p className={(message.bad ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300") + " rounded-xl border p-3 text-sm"}>{message.text}</p>}
    </div>;
}
