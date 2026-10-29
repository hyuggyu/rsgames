import { useEffect, useState } from "react";
import { api } from "./api";

const KEY = "rs_currency_settings";
const defaults = { selected: "SYP", rates: { USD: 1, SYP: 15000, TRY: 35 } };

export const readCurrency = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        return { ...defaults, ...saved, rates: { ...defaults.rates, ...(saved?.rates || {}) } };
    } catch { return defaults; }
};
export const saveCurrency = (value) => {
    localStorage.setItem(KEY, JSON.stringify(value));
    window.dispatchEvent(new Event("rs:currency"));
};
export const syncCurrency = async () => {
    try { const data = await api("/settings"); if (data.currency) saveCurrency(data.currency); return data; }
    catch { return null; }
};
export const convertPrice = (usd, code = readCurrency().selected) => Number(usd || 0) * Number(readCurrency().rates[code] || 1);
export const formatPrice = (usd, code = readCurrency().selected) => {
    const value = convertPrice(usd, code), digits = code === "USD" ? 2 : 0;
    const amount = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);
    return code === "SYP" ? amount + " ل.س" : code === "TRY" ? amount + " ₺" : "$" + amount;
};
export function useCurrency() {
    const [state, setState] = useState(readCurrency());
    useEffect(() => { const update = () => setState(readCurrency()); window.addEventListener("rs:currency", update); return () => window.removeEventListener("rs:currency", update); }, []);
    return state;
}
