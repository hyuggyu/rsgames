-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('customer', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'blocked');

-- CreateEnum
CREATE TYPE "AgentLevel" AS ENUM ('silver', 'gold', 'platinum', 'api');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'SYP', 'TRY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'payment_review', 'paid', 'processing', 'completed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'answered', 'closed');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('complaint', 'suggestion');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('pending', 'answered', 'closed');

-- CreateEnum
CREATE TYPE "CodeStatus" AS ENUM ('available', 'reserved', 'sold', 'disabled');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('manual', 'code');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('general', 'order', 'deposit', 'balance', 'verification', 'support');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'customer',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "walletId" TEXT,
    "balanceUSD" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "balanceSYP" DECIMAL(24,2) NOT NULL DEFAULT 0,
    "balanceTRY" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "affiliateCode" TEXT,
    "referredBy" TEXT,
    "affiliatePoints" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "affiliateSales" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "affiliateOrders" INTEGER NOT NULL DEFAULT 0,
    "agentLevel" "AgentLevel" NOT NULL DEFAULT 'silver',
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneCodeHash" TEXT,
    "phoneCodeExpires" TIMESTAMP(3),
    "phoneAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailCodeHash" TEXT,
    "emailCodeExpires" TIMESTAMP(3),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "pinHash" TEXT,
    "resetHash" TEXT,
    "resetExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categorySlug" TEXT,
    "description" TEXT,
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "ratingAverage" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","productId")
);

-- CreateTable
CREATE TABLE "ProductPackage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "retailPrice" DECIMAL(18,6),
    "agentPrice" DECIMAL(18,6),
    "wholesalePrice" DECIMAL(18,6),
    "deliveryType" "DeliveryType" NOT NULL DEFAULT 'manual',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "hint" TEXT,
    "currencies" "Currency"[],
    "minimums" JSONB NOT NULL,
    "appIcon" TEXT,
    "walletImage" TEXT,
    "extraFields" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "userId" TEXT NOT NULL,
    "customerData" JSONB,
    "totalAmount" DECIMAL(18,6) NOT NULL,
    "subtotal" DECIMAL(18,6) NOT NULL,
    "discount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "couponCode" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "deliveryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "packageId" TEXT,
    "name" TEXT NOT NULL,
    "packageTitle" TEXT NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "methodSlug" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(24,6) NOT NULL,
    "reference" TEXT NOT NULL,
    "receiptUrl" TEXT NOT NULL,
    "extraData" JSONB,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL DEFAULT 'percent',
    "value" DECIMAL(18,6) NOT NULL,
    "minOrder" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "firstOnly" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponUse" (
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponUse_pkey" PRIMARY KEY ("couponId","userId")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "badge" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "depositId" TEXT,
    "amount" DECIMAL(24,6) NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" TEXT NOT NULL,
    "items" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(24,6) NOT NULL,
    "currency" "Currency" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'general',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "campaignId" TEXT,
    "createdById" TEXT,
    "audience" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "method" TEXT,
    "path" TEXT,
    "targetId" TEXT,
    "statusCode" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalCode" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "packageTitle" TEXT,
    "codeHash" TEXT NOT NULL,
    "cipherText" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "preview" TEXT,
    "status" "CodeStatus" NOT NULL DEFAULT 'available',
    "reservedOrderId" TEXT,
    "reservedAt" TIMESTAMP(3),
    "soldOrderId" TEXT,
    "soldAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "device" TEXT,
    "browser" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sharedWith" TEXT[],
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "nationalId" TEXT,
    "birthDate" TEXT,
    "province" TEXT,
    "idFrontUrl" TEXT,
    "idBackUrl" TEXT,
    "selfieUrl" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ChatStatus" NOT NULL DEFAULT 'open',
    "userReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminReadAt" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:00+00'::timestamptz,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveChatMessage" (
    "id" TEXT NOT NULL,
    "liveChatId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "text" TEXT NOT NULL,
    "reply" TEXT NOT NULL DEFAULT '',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'pending',
    "repliedById" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" VARCHAR(1000) NOT NULL DEFAULT '',
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "adminNote" VARCHAR(500) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'main',
    "site" JSONB NOT NULL,
    "contact" JSONB NOT NULL,
    "currency" JSONB NOT NULL,
    "affiliate" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletId_key" ON "User"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "User_affiliateCode_key" ON "User"("affiliateCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_affiliateCode_idx" ON "User"("affiliateCode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_active_featured_idx" ON "Product"("active", "featured");

-- CreateIndex
CREATE INDEX "Product_categorySlug_idx" ON "Product"("categorySlug");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Favorite_productId_idx" ON "Favorite"("productId");

-- CreateIndex
CREATE INDEX "ProductPackage_productId_active_idx" ON "ProductPackage"("productId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_slug_key" ON "PaymentMethod"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "Deposit_userId_createdAt_idx" ON "Deposit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Deposit_status_idx" ON "Deposit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_methodSlug_reference_key" ON "Deposit"("methodSlug", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_depositId_key" ON "Invoice"("depositId");

-- CreateIndex
CREATE INDEX "Invoice_userId_createdAt_idx" ON "Invoice"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Ledger_userId_createdAt_idx" ON "Ledger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Ledger_reference_idx" ON "Ledger"("reference");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_campaignId_idx" ON "Notification"("campaignId");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_createdAt_idx" ON "AuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalCode_codeHash_key" ON "DigitalCode"("codeHash");

-- CreateIndex
CREATE INDEX "DigitalCode_productId_packageId_status_idx" ON "DigitalCode"("productId", "packageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_jti_key" ON "AuthSession"("jti");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UploadAsset_filename_key" ON "UploadAsset"("filename");

-- CreateIndex
CREATE INDEX "UploadAsset_ownerId_idx" ON "UploadAsset"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_userId_key" ON "Verification"("userId");

-- CreateIndex
CREATE INDEX "Ticket_userId_createdAt_idx" ON "Ticket"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveChat_userId_key" ON "LiveChat"("userId");

-- CreateIndex
CREATE INDEX "LiveChat_status_lastMessageAt_idx" ON "LiveChat"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "LiveChatMessage_liveChatId_createdAt_idx" ON "LiveChatMessage"("liveChatId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Review_productId_status_idx" ON "Review"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSettings_key_key" ON "StoreSettings"("key");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categorySlug_fkey" FOREIGN KEY ("categorySlug") REFERENCES "Category"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPackage" ADD CONSTRAINT "ProductPackage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ProductPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_methodSlug_fkey" FOREIGN KEY ("methodSlug") REFERENCES "PaymentMethod"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUse" ADD CONSTRAINT "CouponUse_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUse" ADD CONSTRAINT "CouponUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCode" ADD CONSTRAINT "DigitalCode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCode" ADD CONSTRAINT "DigitalCode_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ProductPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCode" ADD CONSTRAINT "DigitalCode_reservedOrderId_fkey" FOREIGN KEY ("reservedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCode" ADD CONSTRAINT "DigitalCode_soldOrderId_fkey" FOREIGN KEY ("soldOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalCode" ADD CONSTRAINT "DigitalCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadAsset" ADD CONSTRAINT "UploadAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveChat" ADD CONSTRAINT "LiveChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_liveChatId_fkey" FOREIGN KEY ("liveChatId") REFERENCES "LiveChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_repliedById_fkey" FOREIGN KEY ("repliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


