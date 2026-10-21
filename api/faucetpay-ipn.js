module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    // FaucetPay sends custom data and paid amount
    const customDataStr = body.custom || body.merchant_custom;
    const paidAmount = parseFloat(body.amount || body.merchant_amount || 0);

    if (!customDataStr || paidAmount <= 0) {
      return res.status(400).json({ error: 'Invalid IPN payload from FaucetPay' });
    }

    let customData;
    try {
      customData = typeof customDataStr === 'string' ? JSON.parse(customDataStr) : customDataStr;
    } catch (e) {
      return res.status(400).json({ error: 'Failed to parse custom user data' });
    }

    const username = customData.account_id;
    if (!username) {
      return res.status(400).json({ error: 'User account ID missing in custom payload' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
    }

    // 1. Fetch the user's current profile from Supabase
    const fetchRes = await fetch(`${supabaseUrl}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=*`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const profiles = await fetchRes.json();
    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ error: 'User profile not found in database' });
    }

    const userProfile = profiles[0];
    const currentBalance = parseFloat(userProfile.vault_balance || 0);
    const newBalance = currentBalance + paidAmount;

    // 2. Update the user's vault balance in Supabase
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userProfile.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ vault_balance: newBalance })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return res.status(400).json({ error: 'Failed to update database balance: ' + errText });
    }

    return res.status(200).json({ success: true, message: 'Vault balance credited successfully!' });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
        
