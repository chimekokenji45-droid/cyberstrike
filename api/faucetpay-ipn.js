import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://btugwhcoypxtlgmsxqci.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { token, custom, amount1 } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Missing token' });
    }

    // 1. Verify transaction with FaucetPay Merchant API
    const verifyRes = await fetch('https://faucetpay.io/api/v1/merchant/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_key: process.env.FAUCETPAY_MERCHANT_TOKEN,
        token: token
      })
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.valid) {
      return res.status(400).json({ message: 'Invalid payment token' });
    }

    // 2. Parse User Account Data from custom payload
    const customData = typeof custom === 'string' ? JSON.parse(custom) : custom;
    const userAccountId = customData.account_id;
    const depositAmount = parseFloat(amount1);

    // 3. Fetch current user balance from Supabase
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('vault_balance')
      .eq('username', userAccountId)
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 4. Update balance in Supabase
    const newBalance = parseFloat(profile.vault_balance) + depositAmount;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ vault_balance: newBalance })
      .eq('username', userAccountId);

    if (updateError) {
      return res.status(500).json({ message: 'Failed to update balance' });
    }

    return res.status(200).json({ status: 'success', message: 'Balance credited' });
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
      }
        
