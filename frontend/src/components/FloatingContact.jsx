import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, MessagesSquare, Send } from "lucide-react";
import { api, getToken } from "../lib/api";
import { useContact } from "../lib/db";
import ChatPanel from "./ChatPanel";

export default function FloatingContact() {
    const { pathname } = useLocation();
    const contact = useContact();
    const authenticated = Boolean(getToken());
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(0);

    useEffect(() => { const handler = () => setOpen(true); window.addEventListener("rs:open-chat", handler); return () => window.removeEventListener("rs:open-chat", handler); }, []);
    useEffect(() => {
        if (!authenticated || open || pathname.startsWith("/admin")) return undefined;
        const load = () => api("/live-chat").then((data) => setUnread(data.unread || 0)).catch(() => {});
        load();
        const timer = window.setInterval(load, 10000);
        return () => window.clearInterval(timer);
    }, [authenticated, open, pathname]);

    if (pathname.startsWith("/admin")) return null;
    const base = "grid size-12 place-items-center rounded-full text-white shadow-lg shadow-black/50 transition-transform hover:scale-105";
    return (
        <>
            <div className="fixed left-4 bottom-24 z-30 flex flex-col gap-3">
                {contact.telegram && <a href={contact.telegram} target="_blank" rel="noreferrer" aria-label="تليغرام" className={`${base} bg-[#2a8bd0]`}><Send className="size-5 -ms-0.5" /></a>}
                {contact.whatsapp && <a href={contact.whatsappUrl} target="_blank" rel="noreferrer" aria-label="واتساب" className={`${base} bg-[#25a95a]`}><MessageCircle className="size-6" /></a>}
                <button type="button" onClick={() => setOpen((value) => !value)} aria-label="محادثة الدعم" aria-expanded={open} className={`${base} relative bg-gold-500 text-ink-950`}>
                    <MessagesSquare className="size-6" />
                    {!open && unread > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-red-500 text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
                </button>
            </div>
            {open && <ChatPanel onClose={() => setOpen(false)} onUnreadChange={setUnread} />}
        </>
    );
}
