// ==========================================
// 1. SUPABASE CLIENT INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://btugwhcoypxtlgmsxqci.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__DjyCoKhrV9vpmAUY-T3lg_0f-Ji2-h';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentStake = 0.50;
let selectedGameMode = 'target_shooter';

// ==========================================
// 2. CHECK SESSION ON INITIAL LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    await loadUserProfile(session.user);
  } else {
    showAuthGate();
  }

  // Listen for auth state changes (Login / Logout)
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await loadUserProfile(session.user);
    } else {
      showAuthGate();
    }
  });
});

function showAuthGate() {
  currentUser = null;
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appContainer').classList.add('hidden');
}

function hideAuthGate() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
}

// ==========================================
// 3. SEAMLESS LOGIN & AUTO-REGISTER HANDLER
// ==========================================
async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('authEmail').value.trim().toLowerCase();
  const password = document.getElementById('authPassword').value;
  const msgBox = document.getElementById('authMessage');
  const submitBtn = document.getElementById('authSubmitBtn');

  msgBox.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.textContent = 'AUTHENTICATING...';

  try {
    // Attempt Login First
    let { data, error } = await supabase.auth.signInWithPassword({ 
      email: email, 
      password: password 
    });

    // If user does not exist yet in Supabase Auth, register seamlessly
    if (error && (error.message.includes('Invalid login credentials') || error.status === 400)) {
      const signUpRes = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { faucetpay_email: email }
        }
      });

      if (signUpRes.error) throw signUpRes.error;
      
      data = signUpRes.data;
      
      // Initialize user entry in `profiles` table
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          faucetpay_email: email,
          balance: 0.00,
          wins: 0
        });
      }
    } else if (error) {
      throw error;
    }

  } catch (err) {
    msgBox.textContent = err.message;
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
    let { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    // Ensure user profile exists
    if (!profile) {
      const { data: newProfile } = await supabase.from('profiles').upsert({
        id: authUser.id,
        faucetpay_email: authUser.email,
        balance: 0.00,
        wins: 0
      }).select().single();
      profile = newProfile;
    }

    currentUser = {
      id: profile.id,
      email: profile.faucetpay_email || authUser.email,
      balance: parseFloat(profile.balance || 0),
      wins: parseInt(profile.wins || 0, 10)
    };

    // Update UI displays
    document.getElementById('userBalanceDisplay').textContent = currentUser.balance.toFixed(2);
    document.getElementById('withdrawEmail').value = currentUser.email;
    document.getElementById('faucetPayUserId').value = currentUser.email;
    
    updateMilestoneUI();
    hideAuthGate();

  } catch (err) {
    console.error('Failed to load profile:', err.message);
  }
}

async function updateUserBalance(newBalance) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ balance: newBalance, updated_at: new Date() })
      .eq('id', currentUser.id);

    if (error) throw error;

    currentUser.balance = newBalance;
    document.getElementById('userBalanceDisplay').textContent = currentUser.balance.toFixed(2);
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

  document.getElementById('stakeDisplayHeader').innerHTML = 
    `$${currentStake.toFixed(2)} / <span class="text-emerald-400">$${pot} USDT</span>`;

  document.getElementById('matchOverlayDesc').innerHTML = 
    `Entry Stake: <strong>$${currentStake.toFixed(2)} USDT</strong>. Winner takes <strong>$${pot} USDT</strong> (20% platform rake).`;

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

  document.getElementById('canvasOverlay').classList.add('hidden');
  console.log(`Match Started! Stake: $${currentStake}`);
}

function selectGameMode(mode) {
  selectedGameMode = mode;
  const titles = {
    'target_shooter': 'Target Strike 1v1',
    'reflex_pulse': 'Reflex Pulse 1v1',
    'cyber_pong': 'Cyber Pong 1v1'
  };
  
  document.getElementById('currentModeTitle').textContent = titles[mode] || '1v1 Duel';

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
  document.getElementById('sprintWinsDisplay').textContent = currentUser.wins;
  const progressPercent = Math.min((currentUser.wins / 100) * 100, 100);
  document.getElementById('sprintProgressBar').style.width = `${progressPercent}%`;
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
  document.getElementById('fpPayBtnAmount').textContent = `$${num.toFixed(2)}`;
        }
      
