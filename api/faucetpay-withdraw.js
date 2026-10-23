export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { email, amount, currency } = req.body;

    const numAmount = parseFloat(amount);
    if (!email || isNaN(numAmount) || numAmount < 2.0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid parameters or amount below 2 POL minimum limit.' 
      });
    }

    const apiKey = process.env.FAUCETPAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        message: 'Missing FAUCETPAY_API_KEY environment variable on Vercel.' 
      });
    }

    // IMPORTANT FIX: FaucetPay API requires amount in satoshis (1 POL = 100,000,000 satoshis)
    const amountInSatoshis = Math.round(numAmount * 100000000);

    const params = new URLSearchParams();
    params.append('api_key', apiKey);
    params.append('to', email);
    params.append('amount', amountInSatoshis); // Pass converted satoshi integer
    params.append('currency', currency || 'POL');

    const faucetResponse = await fetch('https://faucetpay.io/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const result = await faucetResponse.json();

    if (result.status === 200) {
      return res.status(200).json({ 
        success: true, 
        message: 'Payout sent successfully via FaucetPay!' 
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        message: result.message || 'FaucetPay API error' 
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Network error connecting to FaucetPay gateway.' 
    });
  }
      }
                  
