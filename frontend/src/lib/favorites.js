import { useCallback, useEffect, useState } from "react";
import { api, getToken } from "./api";

const KEY = "rs_guest_favorites";
const readGuest = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const saveGuest = (ids) => { localStorage.setItem(KEY, JSON.stringify(ids)); window.dispatchEvent(new CustomEvent("rs:favorites", { detail: ids })); };
const publish = (ids) => window.dispatchEvent(new CustomEvent("rs:favorites", { detail: ids }));
export const favoriteKey = (product) => String(product?._id || product?.id || product?.slug || "");

export function useFavorites() {
    const authenticated = Boolean(getToken());
    const [ids, setIds] = useState(() => readGuest());
    const [loading, setLoading] = useState(authenticated);

    useEffect(() => {
        const sync = (event) => setIds(Array.isArray(event.detail) ? event.detail : readGuest());
        window.addEventListener("rs:favorites", sync);
        return () => window.removeEventListener("rs:favorites", sync);
    }, []);

    useEffect(() => {
        if (!authenticated) { setIds(readGuest()); setLoading(false); return; }
        let active = true;
        api("/favorites").then((products) => { const next = products.map(favoriteKey).filter(Boolean); if (active) { setIds(next); publish(next); } }).catch(() => {}).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [authenticated]);

    const has = useCallback((product) => ids.includes(favoriteKey(product)), [ids]);
    const toggle = useCallback(async (product) => {
        const id = favoriteKey(product);
        if (!id) return false;
        const exists = ids.includes(id), next = exists ? ids.filter((value) => value !== id) : [...ids, id];
        setIds(next); publish(next);
        if (!authenticated || !product?._id) { saveGuest(next); return !exists; }
        try {
            await api(`/favorites/${product._id}`, { method: exists ? "DELETE" : "POST" });
            return !exists;
        } catch (error) { setIds(ids); publish(ids); throw error; }
    }, [authenticated, ids]);

    return { ids, has, toggle, loading };
}
