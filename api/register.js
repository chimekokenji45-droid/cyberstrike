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

    const username = body?.username?.trim()?.toLowerCase();
    const email = body?.email?.trim();
    const faucetpay_email = body?.faucetpay_email?.trim() || email;
    const password = body?.password;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: username, email, or password' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing Supabase environment variables.' });
    }

    // 1. Create user in Supabase Auth via Admin API
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, faucetpay_email }
      })
    });

    const authResult = await authResponse.json();

    if (!authResponse.ok) {
      return res.status(400).json({ error: authResult.error_description || authResult.msg || authResult.message || 'Auth registration failed' });
    }

    const userId = authResult.id;

    // 2. Insert into profiles table
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: userId,
        username: username,
        email: email,
        faucetpay_email: faucetpay_email,
        vault_balance: 0.00
      })
    });

    if (!profileResponse.ok) {
      const profileErrorText = await profileResponse.text();
      return res.status(400).json({ error: 'Profile creation error: ' + profileErrorText });
    }

    return res.status(200).json({
      message: 'Account created successfully!',
      user: authResult,
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
  
