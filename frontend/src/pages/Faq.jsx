import { ChevronDown } from "lucide-react";
import { faq } from "../data/content";
import Page, { card } from "../components/Page";

export default function Faq() {
    return (
        <Page title="الأسئلة الشائعة">
            <div className="mt-5 space-y-2.5">
                {faq.map((f) => (
                    <details key={f.q} className={`${card} group p-4`}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                            {f.q}<ChevronDown className="size-5 shrink-0 text-gold-400 transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="mt-3 text-sm leading-relaxed text-mute">{f.a}</p>
                    </details>
                ))}
            </div>
        </Page>
    );
}
