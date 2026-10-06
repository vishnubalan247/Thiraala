// POST /api/verify-payment
// Confirms the payment really came from Razorpay by checking its signature.
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ verified: false });
  }
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = b;

  if (!secret || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false });
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const s = Buffer.from(String(razorpay_signature));
  const verified = a.length === s.length && crypto.timingSafeEqual(a, s);
  return res.status(verified ? 200 : 400).json({ verified, paymentId: verified ? razorpay_payment_id : undefined });
};
