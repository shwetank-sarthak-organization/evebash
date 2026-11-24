-- Issue #316: one Razorpay payment can switch a plan on only once. The Razorpay webhook and the buyer's page
-- (verify-payment) both report the same payment, often seconds apart; the backend writes the payments row first
-- and treats a duplicate (23505) as "already done". Only captured rows are unique: failed attempts may repeat.
CREATE UNIQUE INDEX IF NOT EXISTS payments_captured_razorpay_payment_id_key
    ON public.payments (razorpay_payment_id)
    WHERE status = 'captured' AND razorpay_payment_id IS NOT NULL;
