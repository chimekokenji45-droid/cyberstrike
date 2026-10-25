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
    let body = req.body;

    // Robust payload parsing for FaucetPay webhooks
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        const parsed = new URLSearchParams(body);
        body = {};
        for (const [key, value] of parsed.entries()) { body[key] = value; }
      }
    } else if (!body || Object.keys(body).length === 0) {
      const buffers = [];
      for await (const chunk of req) { buffers.push(chunk); }
      const rawData = Buffer.concat(buffers).toString();
      try { body = JSON.parse(rawData); } catch (e) {
        const parsed = new URLSearchParams(rawData);
        body = {};
        for (const [key, value] of parsed.entries()) { body[key] = value; }
      }
    }

    const customDataStr = body.custom || body.merchant_custom;
    const paidAmount = parseFloat(body.amount || body.amount1 || body.merchant_amount || 0);
    const transactionId = body.payment_id || body.txid || body.transaction_id;

    if (!customDataStr || paidAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid IPN payload parameters' });
    }

    let customData;
    try {
      customData = typeof customDataStr === 'string' ? JSON.parse(customDataStr) : customDataStr;
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Failed to parse custom payload' });
    }

    const accountId = customData.account_id;
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'Account ID missing in custom payload' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ success: false, message: 'Missing server environment variables' });
    }

    // 1. Fetch user profile from Supabase to get the latest username and permanent UUID
    const fetchRes = await fetch(`${supabaseUrl}/rest/v1/profiles?username=eq.${encodeURIComponent(accountId)}&select=*`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const profiles = await fetchRes.json();
    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    const userProfile = profiles[0];
    const currentBal = parseFloat(userProfile.vault_balance || 0);
    const finalTxId = transactionId || `dep_${accountId}_${Date.now()}`;

    // 2. Insert into processed_transactions using the LIVE profile username and permanent user_id
    const txInsertRes = await fetch(`${supabaseUrl}/rest/v1/processed_transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        transaction_id: finalTxId,
        user_id: userProfile.id,
        account_id: userProfile.username, // Uses live profile username from database
        username: userProfile.username,     // Uses live profile username from database
        amount: paidAmount,
        type: 'deposit',
        status: 'completed'
      })
    });

    if (!txInsertRes.ok) {
      const errText = await txInsertRes.text();
      if (!errText.includes("duplicate key")) {
        console.error("Failed to log deposit transaction:", errText);
      }
    }

    // 3. Update Vault Balance
    const newBalance = currentBal + paidAmount;
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
      return res.status(400).json({ success: false, message: 'Failed to update database balance.' });
    }

    return res.status(200).json({ success: true, message: 'Deposit processed and credited successfully!' });

  } catch (error) {
    console.error("IPN Error:", error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
    }
