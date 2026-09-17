// ==========================================
// 1. SUPABASE CLIENT INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://btugwhcoypxtlgmsxqci.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__DjyCoKhrV9vpmAUY-T3lg_0f-Ji2-h';

// Ensure Supabase is loaded safely
let supabase;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  alert("Initialization Error: " + e.message);
}

let currentUser = null;
let currentStake = 0.50;
let selectedGameMode = 'target_shooter';

// ==========================================
// 2. CHECK SESSION ON INITIAL LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    if (session && session.user) {
      await loadUserProfile(session.user);
    } else {
      showAuthGate();
    }
  } catch (err) {
    console.error("Session load error:", err.message);
    showAuthGate();
  }

  // Listen for auth state changes
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session && session.user) {
      await loadUserProfile(session.user);
    } else {
      showAuthGate();
    }
  });
});

function showAuthGate() {
  currentUser = null;
  const authScreen = document.getElementById('authScreen');
  const appContainer = document.getElementById('appContainer');
  if (authScreen) authScreen.classList.remove('hidden');
  if (appContainer) appContainer.classList.add('hidden');
}

function hideAuthGate() {
  const authScreen = document.getElementById('authScreen');
  const appContainer = document.getElementById('appContainer');
  if (authScreen) authScreen.classList.add('hidden');
  if (appContainer) appContainer.classList.remove('hidden');
}

// ==========================================
// 3. ROBUST LOGIN & AUTO-REGISTER HANDLER
// ==========================================
async function handleAuthSubmit(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const msgBox = document.getElementById('authMessage');
  const submitBtn = document.getElementById('authSubmitBtn');

  if (!emailInput || !passwordInput) {
    alert("Form fields missing!");
    return;
  }

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  msgBox.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.textContent = 'AUTHENTICATING...';

  try {
    // 1. Attempt Sign In
    let authRes = await supabase.auth.signInWithPassword({ email, password });

    // 2. If user doesn't exist, automatically sign them up
    if (authRes.error) {
      const signUpRes = await supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { faucetpay_email: email } }
      });

      if (signUpRes.error) {
        throw signUpRes.error;
      }
      authRes = signUpRes;
    }

    if (!authRes.data || !authRes.data.user) {
      throw new Error("Authentication failed to return user data.");
    }

    const user = authRes.data.user;

    // 3. Safely sync or create entry in profiles table
    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        faucetpay_email: email,
        balance: 0.00,
        wins: 0
      }, { onConflict: 'id' });
    } catch (profileErr) {
      console.warn("Profile table sync warning (continuing login):", profileErr);
    }

    // Success! Load user profile and enter game
    await loadUserProfile(user);

  } catch (err) {
    console.error("Auth Exception:", err);
    alert("Login Error: " + (err.message || JSON.stringify(err)));
    msgBox.textContent = err.message || "Authentication failed.";
    msgBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'LOG IN';
  }
}

// ==========================================
// 4. PROFILE & BALANCE MANAGEMENT
// ==========================================
async function loadUserProfile(authUser) {
  try {
    let profile = null;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (data) {
      profile = data;
    } else {
      // Create profile if missing
      const { data: newProfile } = await supabase.from('profiles').upsert({
        id: authUser.id,
        faucetpay_email: authUser.email || authUser.user_metadata?.faucetpay_email,
        balance: 0.00,
        wins: 0
      }, { onConflict: 'id' }).select().single();
      profile = newProfile;
    }

    currentUser = {
      id: authUser.id,
      email: profile?.faucetpay_email || authUser.email,
      balance: parseFloat(profile?.balance || 0),
      wins: parseInt(profile?.wins || 0, 10)
    };

    // Update UI elements safely
    const balDisplay = document.getElementById('userBalanceDisplay');
    const withdrawEmail = document.getElementById('withdrawEmail');
    const fpUserId = document.getElementById('faucetPayUserId');

    if (balDisplay) balDisplay.textContent = currentUser.balance.toFixed(2);
    if (withdrawEmail) withdrawEmail.value = currentUser.email;
    if (fpUserId) fpUserId.value = currentUser.email;
    
    updateMilestoneUI();
    hideAuthGate();

  } catch (err) {
    console.error('Failed to load profile:', err.message);
    // Fallback so user isn't locked out even if profiles table query fails
    currentUser = {
      id: authUser.id,
      email: authUser.email,
      balance: 0.00,
      wins: 0
    };
    hideAuthGate();
  }
}

async function updateUserBalance(newBalance) {
  if (!currentUser) return;
  try {
    await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', currentUser.id);

    currentUser.balance = newBalance;
    const balDisplay = document.getElementById('userBalanceDisplay');
    if (balDisplay) balDisplay.textContent = currentUser.balance.toFixed(2);
  } catch (err) {
    console.error('Balance update error:', err.message);
  }
}

async function logout() {
  await supabase.auth.signOut();
  showAuthGate();
}

// ==========================================
// 5. STAKE TIERS & GAME LOGIC
// ==========================================
function selectStakeTier(amount) {
  currentStake = parseFloat(amount);
  const pot = (currentStake * 2 * 0.8).toFixed(2);

  const stakeHeader = document.getElementById('stakeDisplayHeader');
  const overlayDesc = document.getElementById('matchOverlayDesc');

  if (stakeHeader) {
    stakeHeader.innerHTML = `$${currentStake.toFixed(2)} / <span class="text-emerald-400">$${pot} USDT</span>`;
  }
  if (overlayDesc) {
    overlayDesc.innerHTML = `Entry Stake: <strong>$${currentStake.toFixed(2)} USDT</strong>. Winner takes <strong>$${pot} USDT</strong> (20% platform rake).`;
  }

  [0.5, 1.0, 5.0].forEach(tier => {
    const btn = document.getElementById(`stakeTier-${tier.toFixed(1)}`) || document.getElementById(`stakeTier-${tier}`);
    if (!btn) return;

    if (tier === currentStake) {
      btn.className = "stake-tier-btn border-cyan-500 bg-cyan-950/40 text-cyan-400 border py-2 px-2 rounded-xl flex flex-col items-center justify-center transition";
    } else {
      btn.className = "stake-tier-btn border-slate-800 bg-slate-900 text-slate-300 border py-2 px-2 rounded-xl flex flex-col items-center justify-center transition hover:border-slate-700";
    }
  });
}

async function startMatchmaking() {
  if (!currentUser) return showAuthGate();

  if (currentUser.balance < currentStake) {
    alert('Insufficient balance. Please deposit via FaucetPay.');
    openModal('depositModal');
    return;
  }

  const newBalance = currentUser.balance - currentStake;
  await updateUserBalance(newBalance);

  const canvasOverlay = document.getElementById('canvasOverlay');
  if (canvasOverlay) canvasOverlay.classList.add('hidden');
  console.log(`Match Started! Stake: $${currentStake}`);
}

function selectGameMode(mode) {
  selectedGameMode = mode;
  const titles = {
    'target_shooter': 'Target Strike 1v1',
    'reflex_pulse': 'Reflex Pulse 1v1',
    'cyber_pong': 'Cyber Pong 1v1'
  };
  
  const modeTitle = document.getElementById('currentModeTitle');
  if (modeTitle) modeTitle.textContent = titles[mode] || '1v1 Duel';

  document.querySelectorAll('.game-mode-card').forEach(card => {
    card.classList.remove('border-cyan-500', 'bg-cyan-950/30');
    card.classList.add('border-slate-800', 'bg-slate-900/60');
  });

  const activeCard = document.getElementById(`mode-${mode}`);
  if (activeCard) {
    activeCard.classList.remove('border-slate-800', 'bg-slate-900/60');
    activeCard.classList.add('border-cyan-500', 'bg-cyan-950/30');
  }
}

function updateMilestoneUI() {
  if (!currentUser) return;
  const winsDisplay = document.getElementById('sprintWinsDisplay');
  const progressBar = document.getElementById('sprintProgressBar');
  
  if (winsDisplay) winsDisplay.textContent = currentUser.wins;
  if (progressBar) {
    const progressPercent = Math.min((currentUser.wins / 100) * 100, 100);
    progressBar.style.width = `${progressPercent}%`;
  }
}

// ==========================================
// 6. MODAL CONTROLLERS
// ==========================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function syncFaucetPayAmount(val) {
  const num = parseFloat(val) || 0;
  const payBtnAmount = document.getElementById('fpPayBtnAmount');
  if (payBtnAmount) payBtnAmount.textContent = `$${num.toFixed(2)}`;
        }
      
