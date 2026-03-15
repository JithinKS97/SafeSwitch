-- CreateTable
CREATE TABLE "user_ai_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiKeyMasked" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ai_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_ai_keys_userId_key" ON "user_ai_keys"("userId");
