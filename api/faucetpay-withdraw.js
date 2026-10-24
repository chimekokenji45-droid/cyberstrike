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
    const { account_id, email, amount, currency } = req.body;

    const numAmount = parseFloat(amount);
    if (!email || isNaN(numAmount) || numAmount < 2.0 || !account_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid parameters or amount below 2 POL minimum limit.' 
      });
    }

    const apiKey = process.env.FAUCETPAY_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ 
        success: false, 
        message: 'Missing server environment variables (API Key or Supabase Credentials).' 
      });
    }

    // 1. Fetch user profile securely via Supabase REST API
    const fetchRes = await fetch(`${supabaseUrl}/rest/v1/profiles?username=eq.${encodeURIComponent(account_id)}&select=*`, {
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

    if (currentBal < numAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient Vault Balance in database.' });
    }

    // 2. Convert amount to satoshis (1 POL = 100,000,000 units) for FaucetPay API
    const amountInSatoshis = Math.round(numAmount * 100000000);

    const params = new URLSearchParams();
    params.append('api_key', apiKey);
    params.append('to', email);
    params.append('amount', amountInSatoshis);
    params.append('currency', currency || 'POL');

    // 3. Send payout request to FaucetPay
    const faucetResponse = await fetch('https://faucetpay.io/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const result = await faucetResponse.json();

    if (result.status === 200) {
      // 4. Deduct balance from Supabase using Service Role Key
      const newBalance = Math.max(0, currentBal - numAmount);

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
        console.error("Failed to deduct database balance after withdrawal");
      }

      // 5. INSERT RECORD INTO processed_transactions FOR WITHDRAWAL HISTORY
      const finalTxId = result.payout_id || `withdraw_${account_id}_${Date.now()}`;
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
          account_id: account_id,
          username: account_id, // <-- FIXED: Added to satisfy NOT NULL constraint
          amount: numAmount,
          type: 'withdraw',
          status: 'completed'
        })
      });

      if (!txInsertRes.ok) {
        const insertErrText = await txInsertRes.text();
        console.error("Failed to log withdrawal transaction to database:", insertErrText);
      }

      return res.status(200).json({ 
        success: true, 
        newBalance: newBalance,
        message: 'Payout sent successfully via FaucetPay!' 
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        message: result.message || 'FaucetPay API error' 
      });
    }
  } catch (error) {
    console.error("Withdrawal Error:", error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Network error connecting to FaucetPay gateway.' 
    });
  }
}
  
