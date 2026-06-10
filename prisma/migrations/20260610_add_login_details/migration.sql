-- CreateTable
CREATE TABLE "LoginDetail" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LoginDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginDetail_userId_idx" ON "LoginDetail"("userId");

-- CreateIndex
CREATE INDEX "LoginDetail_loginAt_idx" ON "LoginDetail"("loginAt");

-- AddForeignKey
ALTER TABLE "LoginDetail" ADD CONSTRAINT "LoginDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
