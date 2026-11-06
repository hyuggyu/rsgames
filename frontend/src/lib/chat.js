import { get, update } from "./db";

export const guestId = () => {
    let g = localStorage.getItem("rs_guest");
    if (!g) { g = "G-" + crypto.randomUUID().slice(0, 8); localStorage.setItem("rs_guest", g); }
    return g;
};
export function sendMessage(cid, name, from, text) {
    const t = text.trim().slice(0, 500);
    if (!t) return false;
    const now = Date.now();
    return update("chats", (all) => {
        const chat = all[cid] ?? { id: cid, name, messages: [], seenByAdmin: 0, seenByUser: now };
        const messages = [...chat.messages, { id: now + Math.random().toString(36).slice(2, 6), from, text: t, t: now }].slice(-200);
        return { ...all, [cid]: { ...chat, name: from === "user" ? name : chat.name, messages, ...(from === "admin" ? { seenByAdmin: now } : { seenByUser: now }) } };
    });
}
export function markSeen(cid, who) {
    const chat = get("chats")[cid];
    const k = who === "admin" ? "seenByAdmin" : "seenByUser";
    const last = chat?.messages.at(-1)?.t ?? 0;
    if (!chat || chat[k] >= last) return;
    update("chats", (all) => (all[cid] ? { ...all, [cid]: { ...all[cid], [k]: last } } : all));
}
export const deleteChat = (cid) => update("chats", (all) => { const { [cid]: _gone, ...rest } = all; return rest; });
export const unreadFor = (chat, who) => chat.messages.filter((m) => m.from === (who === "admin" ? "user" : "admin") && m.t > chat[who === "admin" ? "seenByAdmin" : "seenByUser"]).length;
export const timeOf = (t) => new Date(t).toLocaleTimeString("ar-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
