export const auditLabels = {
    balance_adjusted: "تعديل رصيد مستخدم",
    user_status_changed: "تغيير حالة مستخدم",
    agent_level_changed: "تغيير مستوى وكيل",
    password_reset: "إنشاء كلمة مرور مؤقتة",
    notification_sent: "إرسال إشعار",
    settings_updated: "تحديث إعدادات المتجر",
    order_completed: "إكمال طلب",
    order_cancelled: "إلغاء طلب",
    order_status_changed: "تحديث حالة طلب",
    deposit_reviewed: "مراجعة إيداع",
    verification_reviewed: "مراجعة طلب توثيق",
    support_replied: "الرد على تذكرة دعم",
    ticket_status_changed: "تغيير حالة تذكرة",
    live_chat_replied: "الرد على محادثة مباشرة",
    live_chat_status_changed: "تغيير حالة محادثة مباشرة",
    feedback_replied: "الرد على شكوى أو اقتراح",
    feedback_status_changed: "تغيير حالة شكوى أو اقتراح",
    review_moderated: "مراجعة تقييم منتج",
    product_created: "إضافة منتج",
    product_updated: "تعديل منتج",
    product_disabled: "تعطيل منتج",
    category_created: "إضافة قسم",
    category_updated: "تعديل قسم",
    payment_method_created: "إضافة طريقة دفع",
    payment_method_updated: "تعديل طريقة دفع",
    payment_method_disabled: "تعطيل طريقة دفع",
    coupon_created: "إنشاء كود خصم",
    coupon_updated: "تعديل كود خصم",
    coupon_deleted: "حذف كود خصم",
    offer_created: "إضافة عرض",
    offer_updated: "تعديل عرض",
    offer_deleted: "حذف عرض",
    codes_imported: "استيراد أكواد رقمية",
    code_disabled: "تعطيل كود رقمي",
    code_inventory_updated: "تحديث مخزن الأكواد",
    package_delivery_changed: "تغيير طريقة تسليم باقة",
    admin_change: "إجراء إداري"
};

export const auditText = (item) => {
    let text = auditLabels[item.action] || item.action;
    if (item.action === "balance_adjusted" && item.metadata?.amount) text += " — " + item.metadata.amount + " " + item.metadata.currency;
    if (item.action === "notification_sent") text += item.metadata?.audience === "all" ? " — لجميع المستخدمين" : " — لمستخدم محدد";
    if (item.metadata?.status) text += " — " + item.metadata.status;
    return text;
};
