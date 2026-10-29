// يصغّر الصورة ويحوّلها JPEG مضغوطة لتناسب التخزين المحلي
export function fileToDataUrl(file, max = 640, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) return reject(new Error("الملف ليس صورة."));
        if (file.size > 10 * 1024 * 1024) return reject(new Error("حجم الصورة أكبر من 10 ميغابايت."));
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const s = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * s);
            c.height = Math.round(img.height * s);
            const ctx = c.getContext("2d");
            ctx.fillStyle = "#1d1910";
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            resolve(c.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("تعذّر قراءة الصورة.")); };
        img.src = url;
    });
}
