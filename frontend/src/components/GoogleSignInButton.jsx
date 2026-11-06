import { useEffect, useRef, useState } from "react";

const scriptId = "google-identity-services";

export default function GoogleSignInButton({ onCredential, disabled = false }) {
    const container = useRef(null);
    const [error, setError] = useState("");
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    useEffect(() => {
        if (!clientId || disabled) return;
        let active = true;
        const render = () => {
            if (!active || !window.google?.accounts?.id || !container.current) return;
            window.google.accounts.id.initialize({ client_id: clientId, callback: (response) => onCredential(response.credential), ux_mode: "popup" });
            container.current.innerHTML = "";
            window.google.accounts.id.renderButton(container.current, { theme: "filled_black", size: "large", shape: "pill", width: Math.min(360, container.current.offsetWidth || 320), text: "continue_with", locale: "ar" });
        };
        const current = document.getElementById(scriptId);
        if (window.google?.accounts?.id) render();
        else if (current) current.addEventListener("load", render, { once: true });
        else {
            const script = document.createElement("script");
            script.id = scriptId;
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.onload = render;
            script.onerror = () => active && setError("تعذر تحميل تسجيل Google.");
            document.head.appendChild(script);
        }
        return () => { active = false; };
    }, [clientId, disabled, onCredential]);

    if (!clientId) return <p className="text-center text-xs text-amber-400">أضف VITE_GOOGLE_CLIENT_ID لتفعيل الدخول عبر Google.</p>;
    return <div><div ref={container} className={disabled ? "pointer-events-none opacity-50" : "flex justify-center"} />{error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}</div>;
}
