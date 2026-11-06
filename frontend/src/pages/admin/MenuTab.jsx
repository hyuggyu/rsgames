import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, RefreshCw, RotateCcw, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { refreshPublicSettings } from "../../lib/db";
import { MENU_GROUPS, MENU_ROUTES, groupTitle, menuItems } from "../../lib/menu";
import { Field, Switch, inputCls, btnGold, btnGhost } from "./ui";

const blank = () => ({ items: {}, order: {}, titles: {}, customGroups: [] });

export default function MenuTab() {
    const [menu, setMenu] = useState(blank());
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const load = async () => {
        setBusy(true);
        try { const data = await api("/settings"); setMenu({ ...blank(), ...(data.site?.menu || {}) }); setError(""); }
        catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };
    useEffect(() => { load(); }, []);

    const touch = (next) => { setMenu(next); setSaved(false); };
    const setItem = (id, patch) => {
        const entry = { ...(menu.items[id] || {}), ...patch };
        const items = { ...menu.items };
        if (!String(entry.label || "").trim() && !entry.hidden) delete items[id]; else items[id] = entry;
        touch({ ...menu, items });
    };
    const move = (groupId, id, step) => {
        const ids = menuItems(groupId, menu).map((item) => item.id);
        const from = ids.indexOf(id), to = from + step;
        if (to < 0 || to >= ids.length) return;
        [ids[from], ids[to]] = [ids[to], ids[from]];
        touch({ ...menu, order: { ...menu.order, [groupId]: ids } });
    };
    const addGroup = () => touch({ ...menu, customGroups: [...(menu.customGroups || []), { id: `custom-${crypto.randomUUID()}`, title: "قسم جديد", items: [] }] });
    const updateGroup = (groupId, patch) => touch({ ...menu, customGroups: menu.customGroups.map((group) => group.id === groupId ? { ...group, ...patch } : group) });
    const removeGroup = (groupId) => touch({ ...menu, customGroups: menu.customGroups.filter((group) => group.id !== groupId) });
    const addGroupItem = (groupId) => updateGroup(groupId, { items: [...(menu.customGroups.find((group) => group.id === groupId)?.items || []), { id: `${groupId}-item-${crypto.randomUUID().slice(0, 8)}`, label: MENU_ROUTES[0]?.label || "رابط جديد", to: MENU_ROUTES[0]?.to || "/" }] });
    const updateGroupItem = (groupId, itemId, patch) => updateGroup(groupId, { items: menu.customGroups.find((group) => group.id === groupId).items.map((item) => item.id === itemId ? { ...item, ...patch } : item) });
    const removeGroupItem = (groupId, itemId) => updateGroup(groupId, { items: menu.customGroups.find((group) => group.id === groupId).items.filter((item) => item.id !== itemId) });
    const bottomItems = menu.bottomNav || [
        { id: "home", to: "/", label: "الرئيسية" }, { id: "favorites", to: "/favorites", label: "المفضلة" },
        { id: "orders", to: "/orders", label: "الطلبات" }, { id: "wallet", to: "/wallet", label: "المحفظة" }
    ];
    const updateBottom = (index, patch) => touch({ ...menu, bottomNav: bottomItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
    const addBottom = () => touch({ ...menu, bottomNav: [...bottomItems, { id: `bottom-${Date.now()}`, to: MENU_ROUTES[0]?.to || "/", label: MENU_ROUTES[0]?.label || "رابط جديد" }] });
    const removeBottom = (index) => touch({ ...menu, bottomNav: bottomItems.filter((_, itemIndex) => itemIndex !== index) });
    const resetAll = () => { if (window.confirm("إعادة القائمة إلى الإعدادات الافتراضية؟")) touch(blank()); };
    const save = async (event) => {
        event.preventDefault(); setError(""); setSaved(false); setBusy(true);
        try {
            const result = await api("/admin/settings", { method: "PATCH", body: JSON.stringify({ site: { menu } }) });
            setMenu({ ...blank(), ...(result.site?.menu || {}) });
            await refreshPublicSettings(true);
            setSaved(true);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    return <form onSubmit={save} className="space-y-5">
        <section className="space-y-2 rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <div className="flex items-center justify-between gap-3">
                <div><h2 className="font-bold">إدارة القائمة الجانبية</h2><p className="text-xs text-mute">عدّل أسماء الروابط، أخفِ ما لا تحتاجه، أو غيّر ترتيبها. أضف أقساماً وروابط للصفحات المتاحة.</p></div>
                <button type="button" onClick={load} className={btnGhost} aria-label="تحديث"><RefreshCw className={(busy ? "animate-spin " : "") + "size-4"} /></button>
            </div>
            <p className="text-xs text-mute">يتم حفظ التعديلات في إعدادات الموقع وتظهر للزوار بعد الحفظ.</p>
        </section>
        {MENU_GROUPS.map((group) => {
            const items = menuItems(group.id, menu);
            return <section key={group.id} className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900 p-5">
                <h3 className="font-bold">{groupTitle(group.id, menu)}</h3>
                <Field label="اسم القسم" hint={`الاسم الافتراضي: ${group.title}`}>
                    <input value={menu.titles?.[group.id] || ""} onChange={(e) => touch({ ...menu, titles: { ...menu.titles, [group.id]: e.target.value } })} maxLength="40" placeholder={group.title} className={inputCls()} />
                </Field>
                <ul className="space-y-2">
                    {items.map((item, index) => <li key={item.id} className={(item.hidden ? "opacity-60 " : "") + "flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-ink-800 p-2"}>
                        <div className="flex flex-col">
                            <button type="button" disabled={index === 0} onClick={() => move(group.id, item.id, -1)} className="rounded p-0.5 text-mute hover:text-gold-400 disabled:opacity-30" aria-label="تحريك لأعلى"><ArrowUp className="size-4" /></button>
                            <button type="button" disabled={index === items.length - 1} onClick={() => move(group.id, item.id, 1)} className="rounded p-0.5 text-mute hover:text-gold-400 disabled:opacity-30" aria-label="تحريك لأسفل"><ArrowDown className="size-4" /></button>
                        </div>
                        <input value={menu.items[item.id]?.label || ""} onChange={(e) => setItem(item.id, { label: e.target.value })} maxLength="40" placeholder={item.defaultLabel} aria-label={`اسم ${item.defaultLabel}`} className={inputCls() + " min-w-0 flex-1 !py-2"} />
                        <button type="button" onClick={() => setItem(item.id, { label: "" })} disabled={!menu.items[item.id]?.label} className="rounded p-1 text-mute hover:text-gold-400 disabled:opacity-30" aria-label="استعادة الاسم الافتراضي" title="استعادة الاسم الافتراضي"><RotateCcw className="size-4" /></button>
                        <div className="flex items-center gap-2 text-xs text-mute"><span>{item.hidden ? "مخفي" : "ظاهر"}</span><Switch on={!item.hidden} onChange={(on) => setItem(item.id, { hidden: !on })} label={`إظهار ${item.defaultLabel}`} /></div>
                    </li>)}
                </ul>
            </section>;
        })}
        <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold">الهيدر السفلي</h3><p className="text-xs text-mute">تعديل أسماء أزرار الهيدر وإضافة أو حذف الروابط.</p></div><button type="button" onClick={addBottom} className={btnGhost}><Plus className="me-1 inline size-4"/>إضافة زر</button></div>{bottomItems.map((item, index) => <div key={item.id} className="grid gap-2 rounded-xl border border-ink-700 bg-ink-800 p-3 sm:grid-cols-[1fr_1fr_auto]"><Field label="اسم الزر"><input value={item.label} onChange={(e) => updateBottom(index, { label: e.target.value })} maxLength={30} className={inputCls()}/></Field><Field label="الرابط"><select value={item.to} onChange={(e) => updateBottom(index, { to: e.target.value })} className={inputCls()}>{MENU_ROUTES.map((route) => <option key={route.to} value={route.to}>{route.label} — {route.to}</option>)}</select></Field><button type="button" onClick={() => removeBottom(index)} className="self-end rounded-xl border border-red-500/30 p-3 text-red-300" aria-label="حذف الزر"><Trash2 className="size-4"/></button></div>)}</section>

        <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-bold">الأقسام المخصصة</h3><p className="mt-1 text-xs text-mute">أنشئ أقساماً إضافية واختر لكل رابط صفحة من صفحات المتجر.</p></div>
                <button type="button" onClick={addGroup} className={btnGhost}><span className="flex items-center gap-2"><Plus className="size-4" /> إضافة قسم</span></button>
            </div>
            {(menu.customGroups || []).map((group) => <div key={group.id} className="space-y-3 rounded-xl border border-ink-700 bg-ink-800 p-4">
                <div className="flex items-end gap-2">
                    <Field label="اسم القسم"><input value={group.title} onChange={(e) => updateGroup(group.id, { title: e.target.value })} maxLength={40} className={inputCls()} /></Field>
                    <button type="button" onClick={() => removeGroup(group.id)} className="rounded-xl border border-red-500/30 p-3 text-red-300 hover:bg-red-500/10" aria-label="حذف القسم" title="حذف القسم"><Trash2 className="size-4" /></button>
                </div>
                {group.items.map((item) => <div key={item.id} className="grid gap-2 rounded-lg border border-ink-700 p-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Field label="اسم الرابط"><input value={item.label} onChange={(e) => updateGroupItem(group.id, item.id, { label: e.target.value })} maxLength={40} className={inputCls()} /></Field>
                    <Field label="الصفحة"><select value={item.to} onChange={(e) => updateGroupItem(group.id, item.id, { to: e.target.value })} className={inputCls()}>{MENU_ROUTES.map((route) => <option key={route.to} value={route.to}>{route.label} — {route.to}</option>)}</select></Field>
                    <button type="button" onClick={() => removeGroupItem(group.id, item.id)} className="self-end rounded-xl border border-red-500/30 p-3 text-red-300 hover:bg-red-500/10" aria-label="حذف الرابط" title="حذف الرابط"><Trash2 className="size-4" /></button>
                </div>)}
                <button type="button" onClick={() => addGroupItem(group.id)} className={btnGhost}><span className="flex items-center gap-2"><Plus className="size-4" /> إضافة رابط</span></button>
            </div>)}
            {!(menu.customGroups || []).length && <p className="rounded-xl border border-dashed border-ink-700 p-4 text-center text-sm text-mute">لا توجد أقسام مخصصة بعد.</p>}
        </section>
        {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
            <button disabled={busy} className={btnGold}>{busy ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
            <button type="button" onClick={resetAll} className={btnGhost}>استعادة الإعدادات الافتراضية</button>
            {saved && <span className="flex items-center gap-1 text-sm text-emerald-400"><Check className="size-4" /> تم الحفظ بنجاح</span>}
        </div>
    </form>;
}
