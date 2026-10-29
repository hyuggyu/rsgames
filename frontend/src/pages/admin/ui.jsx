import { useEffect } from "react";
import { X } from "lucide-react";

export const inputCls = (bad) => `w-full rounded-xl border bg-ink-800 px-4 py-3 text-sm text-sand placeholder:text-mute focus:border-gold-500 focus:outline-none ${bad ? "border-red-500" : "border-ink-700"}`;
export const btnGold = "rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2.5 text-sm font-bold text-ink-950 disabled:opacity-50";
export const btnGhost = "rounded-xl border border-ink-700 px-4 py-2.5 text-sm text-sand transition-colors hover:border-gold-500";

export function Field({ label, error, hint, children }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-sand/90">{label}</span>
            {children}
            {hint && !error && <span className="mt-1 block text-xs text-mute">{hint}</span>}
            {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
        </label>
    );
}

export function Modal({ title, onClose, children }) {
    useEffect(() => {
        const esc = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-[60] grid place-items-center p-3" role="dialog" aria-modal="true" aria-label={title}>
            <div onClick={onClose} className="absolute inset-0 bg-black/75" />
            <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gold-600/40 bg-ink-900 p-5">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold">{title}</h2>
                    <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 text-mute hover:text-sand"><X className="size-5" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function Switch({ on, onChange, label }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-gold-500" : "bg-ink-700"}`}>
            <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${on ? "end-0.5" : "start-0.5"}`} />
        </button>
    );
}

export const Empty = ({ children }) => <p className="rounded-2xl border border-ink-700 bg-ink-900 p-5 text-mute">{children}</p>;
