// POST /api/create-order
// Creates a Razorpay order. The price is fixed here on the server so it
// cannot be changed from the browser.
const PRICE_PAISE = 149900; // ₹1,499
const MAX_QTY = 5;
const COLOURS = ['Wine Lily', 'Pink Orchid', 'Rose Lotus'];

const clean = (v, max) => String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(500).json({ error: 'Payments are not set up yet. Please try again later.' });
  }

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const name = clean(b.name, 80);
  const phone = clean(b.phone, 10);
  const email = clean(b.email, 100);
  const address = clean(b.address, 240);
  const city = clean(b.city, 60);
  const pincode = clean(b.pincode, 6);
  const colour = COLOURS.includes(b.colour) ? b.colour : COLOURS[0];
  const qty = Math.min(MAX_QTY, Math.max(1, parseInt(b.qty, 10) || 1));

  const pin = parseInt(pincode, 10);
  if (name.length < 2) return res.status(400).json({ error: 'Enter your full name' });
  if (!/^[6-9][0-9]{9}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
  if (address.length < 8 || city.length < 2) return res.status(400).json({ error: 'Enter your full delivery address' });
  if (!/^[1-9][0-9]{5}$/.test(pincode) || pin < 670000 || pin > 695999) {
    return res.status(400).json({ error: 'We currently deliver only within Kerala' });
  }

  const amount = PRICE_PAISE * qty;
  try {
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: 'thr_' + Date.now(),
        // These show up on the order in your Razorpay dashboard
        notes: {
          product: 'Thiraala Kerala Cotton Saree',
          colour,
          quantity: String(qty),
          customer_name: name,
          phone: '+91' + phone,
          email: email || '-',
          address: address,
          city_pincode: `${city} - ${pincode}`,
        },
      }),
    });
    const order = await r.json();
    if (!r.ok) {
      console.error('Razorpay order error', order);
      return res.status(502).json({ error: 'Could not start payment. Please try again.' });
    }
    return res.status(200).json({ orderId: order.id, amount: order.amount, key: keyId });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Could not reach the payment server. Please try again.' });
  }
};
