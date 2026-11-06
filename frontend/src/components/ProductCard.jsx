import { Heart, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { catIcon } from "../data/store";
import { formatPrice, useCurrency } from "../lib/currency";

export default function ProductCard({ product: p, categoryLabel, favorite = false, onFavorite }) {
    const Icon = catIcon(p.cat || p.category);
    const currency = useCurrency();
    return (
        <div className="relative flex flex-col rounded-2xl border border-ink-700 bg-ink-900 p-4">
            <button type="button" onClick={() => onFavorite?.(p)} aria-label={favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} aria-pressed={favorite} className={`absolute end-6 top-6 z-10 grid size-9 place-items-center rounded-full border backdrop-blur ${favorite ? "border-red-400/60 bg-red-500 text-white" : "border-white/20 bg-black/55 text-white"}`}>
                <Heart className="size-5" fill={favorite ? "currentColor" : "none"} />
            </button>
            {p.image ? <img src={p.image} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" /> : <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-gold-500/10"><Icon className="size-10 text-gold-400" /></div>}
            <h3 className="mt-3 font-semibold" dir="auto">{p.name}</h3>
            <p className="text-xs text-mute">{categoryLabel || p.cat || p.category}</p>
            {p.ratingCount > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-gold-300"><Star className="size-3.5" fill="currentColor" />{Number(p.ratingAverage || 0).toFixed(1)} <span className="text-mute">({p.ratingCount})</span></p>}
            {p.purchaseCount > 0 && <p className="mt-1 text-[11px] text-mute">تم شراؤه {p.purchaseCount} مرة</p>}
            <p className="mt-3 text-sm text-mute">يبدأ من <span className="font-bold text-gold-400" dir="ltr">{formatPrice(p.from, currency.selected)}</span></p>
            <Link to={`/product/${p.id || p.slug}`} className="mt-3 rounded-xl border border-gold-500/60 py-2 text-center text-sm font-semibold text-gold-300 transition-colors hover:bg-gold-500 hover:text-ink-950">اشترِ الآن</Link>
        </div>
    );
}
