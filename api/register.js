const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, email, faucetpay_email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error: Missing Supabase environment variables.' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, faucetpay_email: faucetpay_email || email }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user.id;

    // 2. Insert into profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert([
        {
          id: userId,
          username: username,
          email: email,
          faucetpay_email: faucetpay_email || email,
          vault_balance: 0.00
        }
      ]);

    if (profileError) {
      return res.status(400).json({ error: 'Profile error: ' + profileError.message });
    }

    return res.status(200).json({
      message: 'Account created successfully!',
      user: authData.user,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
      
