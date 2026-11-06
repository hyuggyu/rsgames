import { useEffect, useState } from "react";
import { MoonStar, Sun } from "lucide-react";
import { applyTheme, preferredTheme } from "../lib/theme";

export default function ThemeToggle() {
    const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || preferredTheme());
    useEffect(() => {
        const sync = (event) => setTheme(event.detail);
        window.addEventListener("rs:theme", sync);
        return () => window.removeEventListener("rs:theme", sync);
    }, []);
    const light = theme === "light";
    const toggle = () => setTheme(applyTheme(light ? "dark" : "light"));
    return <button type="button" onClick={toggle} aria-label={light ? "تفعيل الوضع الداكن" : "تفعيل الوضع النهاري"} title={light ? "الوضع الداكن" : "الوضع النهاري"} className="theme-toggle fixed left-3 top-3 z-[90] grid size-11 place-items-center rounded-full border border-gold-500/45 bg-ink-900/90 text-gold-400 shadow-lg shadow-black/20 backdrop-blur-md transition hover:scale-105 hover:border-gold-400">
        {light ? <MoonStar className="size-5"/> : <Sun className="size-5"/>}
    </button>;
}
