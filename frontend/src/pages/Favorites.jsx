import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import Page, { card } from "../components/Page";
import ProductCard from "../components/ProductCard";
import { api } from "../lib/api";
import { useFavorites } from "../lib/favorites";

const normalize = (product) => ({ ...product, id: product.slug, cat: product.category, from: product.packages?.[0]?.retailPrice ?? product.packages?.[0]?.price ?? 0 });

export default function Favorites() {
    const favorites = useFavorites();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => { api("/products").then((items) => setProducts(items.map(normalize))).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
    const items = products.filter((product) => favorites.has(product));

    return <Page title="منتجاتي المفضلة">
        {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {(loading || favorites.loading) && <p className={`${card} mt-4 p-5 text-center text-sm text-mute`}>جارٍ تحميل المفضلة...</p>}
        {!loading && !favorites.loading && items.length === 0 && <div className={`${card} mt-4 flex flex-col items-center gap-3 p-8 text-center`}><Heart className="size-10 text-gold-400" /><div><p className="font-bold">لا توجد منتجات مفضلة</p><p className="mt-1 text-sm text-mute">اضغط علامة القلب على أي منتج ليظهر هنا.</p></div></div>}
        {items.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map((product) => <ProductCard key={product._id} product={product} favorite onFavorite={(item) => favorites.toggle(item).catch(() => {})} />)}</div>}
    </Page>;
}
