import { Bell, Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

const installed = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

export default function PwaPrompts() {
  const [installEvent, setInstallEvent] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const onInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      if (!installed() && localStorage.getItem("rs_install_dismissed") !== "1") setShowInstall(true);
    };
    const onInstalled = () => {
      setShowInstall(false);
      localStorage.setItem("rs_app_installed", "1");
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = isIos && !installed() && localStorage.getItem("rs_install_dismissed") !== "1"
      ? setTimeout(() => setShowInstall(true), 1800)
      : null;
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    if (localStorage.getItem("rs_notifications_dismissed") === "1") return;
    const timer = setTimeout(() => setShowNotifications(true), showInstall ? 9000 : 3500);
    return () => clearTimeout(timer);
  }, [showInstall]);

  const dismissInstall = () => {
    setShowInstall(false);
    localStorage.setItem("rs_install_dismissed", "1");
  };
  const requestInstall = async () => {
    if (!installEvent) {
      setIosHelp(true);
      return;
    }
    await installEvent.prompt();
    const result = await installEvent.userChoice;
    if (result.outcome === "accepted") setShowInstall(false);
    setInstallEvent(null);
  };
  const dismissNotifications = () => {
    setShowNotifications(false);
    localStorage.setItem("rs_notifications_dismissed", "1");
  };
  const enableNotifications = async () => {
    const permission = await Notification.requestPermission();
    setShowNotifications(false);
    if (permission === "granted") {
      const registration = await navigator.serviceWorker?.ready;
      registration?.showNotification("تم تفعيل إشعارات RS Store", {
        body: "ستصلك تحديثات الطلبات والرصيد فوراً.",
        icon: "/assets/rs-logo.jpg",
        badge: "/assets/rs-logo.jpg",
        data: { url: "/notifications" },
        tag: "rs-notifications-enabled"
      });
    }
  };

  if (!showInstall && !showNotifications) return null;
  const notificationPrompt = showNotifications && !showInstall;
  return <aside className="fixed inset-x-3 bottom-24 z-[90] mx-auto max-w-xl rounded-2xl border border-gold-500/40 bg-ink-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl" role="dialog" aria-live="polite">
    <button type="button" onClick={notificationPrompt ? dismissNotifications : dismissInstall} className="absolute left-3 top-3 rounded-lg p-1 text-mute hover:text-sand" aria-label="إغلاق"><X className="size-5" /></button>
    <div className="flex items-start gap-3 pe-7">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-ink-950">{notificationPrompt ? <Bell className="size-6" /> : <Download className="size-6" />}</span>
      <div className="min-w-0 flex-1">
        <h2 className="font-extrabold">{notificationPrompt ? "تفعيل الإشعارات الفورية؟" : "تثبيت تطبيق RS Store؟"}</h2>
        <p className="mt-1 text-xs leading-5 text-mute">{notificationPrompt ? "استلم تحديثات طلباتك وحركة رصيدك فوراً." : "ثبّت المتجر على هاتفك للوصول السريع وتجربة أفضل."}</p>
      </div>
    </div>
    {iosHelp && <p className="mt-3 flex items-center gap-2 rounded-xl bg-ink-800 p-3 text-xs text-gold-200"><Share2 className="size-4 shrink-0" />من Safari اضغط مشاركة ثم اختر «إضافة إلى الشاشة الرئيسية».</p>}
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button type="button" onClick={notificationPrompt ? dismissNotifications : dismissInstall} className="rounded-xl border border-ink-700 px-4 py-2.5 text-sm font-bold text-mute">ليس الآن</button>
      <button type="button" onClick={notificationPrompt ? enableNotifications : requestInstall} className="rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-4 py-2.5 text-sm font-extrabold text-ink-950">{notificationPrompt ? "موافق" : "تثبيت"}</button>
    </div>
  </aside>;
}
