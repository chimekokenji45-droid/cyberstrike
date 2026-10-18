import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, email, faucetpay_email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Create the user using Supabase Admin API
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
}
  
