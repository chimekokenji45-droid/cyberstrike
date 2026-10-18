import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, email, faucetpay_email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // 2. Insert user details into the public.profiles table so login can find them
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: userId,
          username: username,
          email: email,
          faucetpay_email: faucetpay_email || email,
          balance: 0.00
        }
      ]);

    if (profileError) throw profileError;

    return res.status(200).json({
      message: 'Account created successfully!',
      user: authData.user,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
  }
