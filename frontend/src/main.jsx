import { createRoot } from 'react-dom/client'
import React from 'react'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { syncCurrency } from './lib/currency.js'

class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div dir="rtl" className="grid min-h-screen place-items-center bg-ink-950 p-6 text-center text-sand"><div><h1 className="text-xl font-bold text-gold-300">حدث خطأ غير متوقع</h1><p className="mt-2 text-sm text-mute">أعد تحميل الصفحة للمتابعة.</p><button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-gold-400 px-5 py-3 font-bold text-ink-950">إعادة المحاولة</button></div></div>;
  }
}

syncCurrency();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
}

createRoot(document.getElementById('root')).render(
    <AppErrorBoundary>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </AppErrorBoundary>,
)
