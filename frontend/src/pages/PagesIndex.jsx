import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { api } from "../lib/api";

export default function PagesIndex() {
  const [pages, setPages] = useState([]); const [error, setError] = useState("");
  useEffect(() => { api("/pages").then(setPages).catch((e) => setError(e.message)); }, []);
  return <main dir="rtl" className="mx-auto max-w-5xl px-4 py-8 pb-28"><div className="mb-8"><h1 className="text-2xl font-extrabold text-gold-300">صفحات الموقع</h1><p className="mt-2 text-sm text-mute">كل المعلومات والأدلة والإعلانات المنشورة من الإدارة.</p></div>{error && <p className="rounded-xl border border-red-500/40 p-4 text-red-300">تعذر تحميل الصفحات.</p>}{!error && !pages.length && <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8 text-center text-mute">لا توجد صفحات منشورة حاليًا.</div>}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{pages.map((page) => <Link key={page.id} to={`/page/${encodeURIComponent(page.slug)}`} className="group overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 transition hover:-translate-y-1 hover:border-gold-500/60"><img src={page.coverImage || "/assets/rs-logo.jpg"} alt="" className="h-36 w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }}/><div className="p-4"><div className="flex items-center gap-2"><FileText className="size-4 text-gold-400"/><h2 className="font-bold group-hover:text-gold-300">{page.title}</h2></div>{page.excerpt && <p className="mt-2 line-clamp-2 text-sm text-mute">{page.excerpt}</p>}<span className="mt-4 inline-flex items-center gap-1 text-xs text-gold-400">قراءة الصفحة <ArrowLeft className="size-3"/></span></div></Link>)}</div></main>;
}
