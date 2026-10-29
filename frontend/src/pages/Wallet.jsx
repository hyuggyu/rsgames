import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Plus, CircleCheck } from "lucide-react";
import { useUser, money, getWalletApi, getDepositsApi } from "../lib/wallet";
import { useEffect } from "react";
import { currencies } from "../data/store";
import { useMethods } from "../lib/db";
import { api } from "../lib/api";

export default function Wallet() {
    const localMethods = useMethods();
    const [remoteMethods, setRemoteMethods] = useState([]);
    const user = useUser();
    const notice = useLocation().state?.notice;
    const [copied, setCopied] = useState(false);
    const [remote, setRemote] = useState(null);
    const [deposits, setDeposits] = useState([]);
    useEffect(() => { Promise.all([getWalletApi(), getDepositsApi(), api("/payment-methods")]).then(([w, d, m]) => { setRemote(w); setDeposits(d); setRemoteMethods(m); }).catch(() => {}); }, []);
    const depositMethods = remoteMethods.length ? remoteMethods : localMethods;
    const wallet = remote || user;

    const copy = async () => {
        await navigator.clipboard.writeText(user.walletId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    return (
        <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
            <h1 className="text-xl font-extrabold">محفظتي</h1>

            {notice && (
                <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300" role="status">
                    <CircleCheck className="size-5 shrink-0" /> {notice}
                </p>
            )}

            <section className="mt-4 rounded-3xl border border-gold-600/40 bg-gradient-to-br from-gold-600/25 via-ink-900 to-ink-900 p-5">
                <div className="flex items-center gap-5">
                    <div className="shrink-0 rounded-2xl bg-white p-2.5">
                        <QRCodeSVG value={`rsgames:wallet:${user.walletId}`} size={116} level="M" fgColor="#0c0a07" bgColor="#ffffff" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-mute">صاحب المحفظة</p>
                        <p className="truncate font-bold">{wallet.name || user.name}</p>
                        <p className="mt-3 text-sm text-mute">رقم المحفظة</p>
                        <div className="flex items-center gap-2">
                            <p className="font-mono text-base font-bold tracking-wider text-gold-300" dir="ltr">{wallet.walletId || user.walletId}</p>
                            <button type="button" onClick={copy} aria-label="نسخ رقم المحفظة" className="rounded-lg p-1.5 text-gold-400 hover:bg-ink-800">
                                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                            </button>
                        </div>
                    </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-mute">هذا الباركود خاص بمحفظتك. شاركه فقط لاستقبال الرصيد.</p>
            </section>

            <section className="mt-5 grid grid-cols-3 gap-3" aria-label="الأرصدة">
                {currencies.map((c) => (
                    <div key={c.code} className="rounded-2xl border border-ink-700 bg-ink-900 p-3 text-center">
                        <p className="text-xs text-mute">{c.label}</p>
                        <p className="mt-1.5 text-base font-extrabold text-gold-300" dir="ltr">{money(wallet.balances?.[c.code] || 0, c)}</p>
                    </div>
                ))}
            </section>

            <Link to="/charge" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 py-3.5 font-bold text-ink-950">
                <Plus className="size-5" /> إيداع رصيد
            </Link>

            <section className="mt-8">
                <h2 className="mb-3 text-lg font-bold">طلبات الإيداع</h2>
                {deposits.length ? (
                    <ul className="space-y-2.5">
                        {deposits.map((d) => {
                            const c = currencies.find((x) => x.code === d.currency);
                            return (
                                <li key={d._id || d.id} className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900 p-3.5">
                                    <div>
                                        <p className="font-semibold">{depositMethods.find((m) => (m.slug || m.id) === d.method)?.name ?? "حساب محذوف"}</p>
                                        <p className="text-xs text-mute" dir="ltr">{d.reference || d.ref}</p>
                                    </div>
                                    <div className="text-end">
                                        <p className="font-bold text-gold-300" dir="ltr">{money(d.amount, c)}</p>
                                        <span className={`rounded-full px-2 py-0.5 text-xs ${d.status === "approved" || d.status === "مكتمل" ? "bg-emerald-500/15 text-emerald-300" : d.status === "rejected" || d.status === "مرفوض" ? "bg-red-500/15 text-red-300" : "bg-gold-500/15 text-gold-300"}`}>{d.status === "approved" ? "مقبول" : d.status === "rejected" ? "مرفوض" : d.status === "pending" ? "قيد المراجعة" : d.status}</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="rounded-2xl border border-ink-700 bg-ink-900 p-5 text-mute">لا توجد طلبات إيداع بعد. اضغط «إيداع رصيد» لتبدأ.</p>
                )}
            </section>
        </main>
    );
}
