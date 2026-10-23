export default async function handler(req, res) {
  // Allow CORS
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

    if (!email || !amount || amount < 2.0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid parameters or amount below 2 POL minimum limit.' 
      });
    }

    const apiKey = process.env.FAUCETPAY_API_KEY;
    if (!apiKey) {
      console.error("FAUCETPAY_API_KEY is missing in Vercel environment variables.");
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error: Missing FAUCETPAY_API_KEY on Vercel.' 
      });
    }

    // FaucetPay API requires urlencoded form data
    const params = new URLSearchParams();
    params.append('api_key', apiKey);
    params.append('to', email);
    params.append('amount', amount);
    params.append('currency', currency || 'POL');

    const faucetResponse = await fetch('https://faucetpay.io/api/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
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
        message: result.message || 'FaucetPay API error: Check API key or pool balance.' 
      });
    }
  } catch (error) {
    console.error("Withdrawal Endpoint Error:", error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Network error connecting to FaucetPay gateway: ' + error.message 
    });
  }
  }
  
