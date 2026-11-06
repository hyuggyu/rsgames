import { useEffect, useState } from "react";
import { Download, LoaderCircle, Paperclip } from "lucide-react";
import { apiBlob } from "../lib/api";

export default function PrivateAttachment({ item }) {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

    const load = async () => {
        if (url || loading) return;
        setLoading(true);
        try { setUrl(await apiBlob(String(item.url || "").replace(/^.*\/api/, ""))); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    if (url && item.type?.startsWith("image/")) return <img src={url} alt={item.name || "صورة مرفقة"} className="mt-2 max-h-64 max-w-full rounded-xl object-contain" />;
    if (url && item.type?.startsWith("audio/")) return <audio src={url} controls preload="metadata" className="mt-2 max-w-full" />;
    if (url) return <a href={url} download={item.name || "attachment"} className="mt-2 flex items-center gap-1 text-xs underline"><Download className="size-3" />تنزيل {item.name || "المرفق"}</a>;

    return <button type="button" onClick={load} className="mt-2 flex max-w-full items-center gap-2 rounded-lg border border-current/30 px-2.5 py-1.5 text-xs">
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Paperclip className="size-4" />}<span className="truncate">{error || item.name || "فتح المرفق"}</span>
    </button>;
}
