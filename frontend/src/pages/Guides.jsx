import { useState } from "react";
import { Clock, ChevronLeft } from "lucide-react";
import { guides } from "../data/content";
import Page, { card } from "../components/Page";

export default function Guides() {
    const [sel, setSel] = useState(null);
    const g = guides.find((x) => x.id === sel);
    return (
        <Page title={g ? g.title : "الشروحات والمقالات"}>
            {g ? (
                <>
                    <p className="mt-2 flex items-center gap-1 text-xs text-mute"><Clock className="size-3.5" /> {g.read}</p>
                    <ol className="mt-4 space-y-3">
                        {g.steps.map((s, i) => (
                            <li key={s} className={`${card} flex gap-3 p-4`}>
                                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold-500 text-sm font-extrabold text-ink-950">{i + 1}</span>
                                <p className="text-sm leading-relaxed">{s}</p>
                            </li>
                        ))}
                    </ol>
                    <button type="button" onClick={() => setSel(null)} className="mt-5 text-sm text-gold-400 underline">العودة لكل الشروحات</button>
                </>
            ) : (
                <ul className="mt-5 space-y-2.5">
                    {guides.map((x) => (
                        <li key={x.id}>
                            <button type="button" onClick={() => setSel(x.id)} className={`${card} flex w-full items-center gap-3 p-4 text-start hover:border-gold-500`}>
                                <div className="flex-1"><p className="font-semibold">{x.title}</p><p className="mt-1 flex items-center gap-1 text-xs text-mute"><Clock className="size-3.5" /> {x.read} · {x.steps.length} خطوات</p></div>
                                <ChevronLeft className="size-5 text-gold-400" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Page>
    );
}
