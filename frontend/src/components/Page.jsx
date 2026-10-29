import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export const fieldCls = (bad) => `w-full rounded-xl border bg-ink-800 px-4 py-3.5 text-sm text-sand placeholder:text-mute focus:border-gold-500 focus:outline-none ${bad ? "border-red-500" : "border-ink-700"}`;
export const btnPrimary = "w-full rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 py-3.5 text-center font-bold text-ink-950 disabled:opacity-50";
export const card = "rounded-2xl border border-ink-700 bg-ink-900";

export function Notice({ children, bad }) {
    return <p role="status" className={`mt-4 rounded-xl border p-3 text-sm ${bad ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>{children}</p>;
}

export function Label({ id, label, error, children }) {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm">{label}</label>
            {children}
            {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>
    );
}

export default function Page({ title, back = "/", backLabel = "الرئيسية", children }) {
    return (
        <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
            <Link to={back} className="mb-3 flex w-fit items-center gap-1 text-sm text-mute hover:text-sand"><ArrowRight className="size-4" /> {backLabel}</Link>
            <h1 className="text-xl font-extrabold">{title}</h1>
            {children}
        </main>
    );
}
