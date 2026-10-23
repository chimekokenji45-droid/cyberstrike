// ==========================================================================
// CYBERSTRIKE CORE SCRIPT (PART 1: SETUP, AUDIO & INIT)
// ==========================================================================
const SUPABASE_URL = "https://nvcwjpxceoiyrhwhyzuv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zLldbp2CcA_wqo5X24kURA_kyBEN2S-";
let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

let userVaultBalance = parseFloat(localStorage.getItem("cyberstrike_vault_balance")) || 0.0;
let totalRefEarned = 0.0;
let weeklyWageredPOL = 0.0;
let currentSelectedStake = 1.0;

let soundEnabled = localStorage.getItem("cyberstrike_sfx_enabled") !== "false";
let currentActiveUserAccount = localStorage.getItem("cyberstrike_user") || null;
let currentActiveFaucetEmail = localStorage.getItem("cyberstrike_faucet_email") || "";

const WAGER_MILESTONES = [
  { target: 50, reward: 6.0, claimed: false },
  { target: 150, reward: 20.0, claimed: false },
  { target: 500, reward: 65.0, claimed: false },
  { target: 2000, reward: 280.0, claimed: false },
  { target: 10000, reward: 1500.0, claimed: false },
  { target: 50000, reward: 7500.0, claimed: false },
  { target: 100000, reward: 15000.0, claimed: false }
];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playAudioSFX(type) {
  if (!soundEnabled) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'stake') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'deposit') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'withdraw') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
    } else if (type === 'win') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.12);
      osc.frequency.setValueAtTime(783.99, now + 0.24);
      osc.frequency.setValueAtTime(1046.50, now + 0.36);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'lose') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
    } else if (type === 'action') {
      osc.frequency.setValueAtTime(300, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'milestone') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1108.73, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    }
  } catch (e) {
    console.log("Audio play suppressed");
  }
}

function toggleSoundSFX() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("cyberstrike_sfx_enabled", soundEnabled);
  const btn = document.getElementById("soundToggleBtn");
  const drawerSoundStatus = document.getElementById("drawerSoundStatus");
  if (btn) btn.innerText = soundEnabled ? "🔊 SFX: ON" : "🔇 SFX: OFF";
  if (drawerSoundStatus) drawerSoundStatus.innerText = soundEnabled ? "ON" : "OFF";
  if (soundEnabled) playAudioSFX("action");
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("soundToggleBtn");
  const drawerSoundStatus = document.getElementById("drawerSoundStatus");
  if (btn) btn.innerText = soundEnabled ? "🔊 SFX: ON" : "🔇 SFX: OFF";
  if (drawerSoundStatus) drawerSoundStatus.innerText = soundEnabled ? "ON" : "OFF";

  updateVaultBalanceUI();
  checkDepositReturnStatus();
  captureReferrerFromURL();
  initUserSessionUI();
  updateWagerSprintUI();
  startSprintCountdownTimer();
  startLiveBalancePolling();
});

function showCustomAlert(message, title = "CYBERSTRIKE SYSTEM") {
  const titleEl = document.getElementById("notificationTitle");
  const msgEl = document.getElementById("notificationMessage");
  if (titleEl && msgEl) {
    titleEl.innerText = title;
    msgEl.innerText = message;
    document.getElementById("notificationModal").classList.add("active");
  } else {
    alert(message);
  }
}

function closeNotificationModal() {
  playAudioSFX("action");
  document.getElementById("notificationModal").classList.remove("active");
  }
   // ==========================================================================
// CYBERSTRIKE CORE SCRIPT (PART 2: AUTHENTICATION & SESSIONS)
// ==========================================================================

function initUserSessionUI() {
  const authNavBox = document.getElementById("authNavBox");
  const userWalletBox = document.getElementById("userWalletBox");
  const userTag = document.getElementById("loggedInUserTag");
  
  const drawerAuthNotLoggedIn = document.getElementById("drawerAuthNotLoggedIn");
  const drawerAuthLoggedIn = document.getElementById("drawerAuthLoggedIn");
  const drawerUserTag = document.getElementById("drawerLoggedInUserTag");

  const mainDash = document.getElementById("mainDashboard");
  const mainFooter = document.getElementById("mainFooter");
  const closeBtn = document.getElementById("authCloseBtn");
  const authModal = document.getElementById("authModal");

  if (currentActiveUserAccount) {
    if (drawerAuthNotLoggedIn) drawerAuthNotLoggedIn.style.display = "none";
    if (drawerAuthLoggedIn) drawerAuthLoggedIn.style.display = "block";
    if (drawerUserTag) drawerUserTag.innerText = currentActiveUserAccount;
    if (userTag) userTag.innerText = `USER: ${currentActiveUserAccount}`;

    if (mainDash) mainDash.style.display = "flex";
    if (mainFooter) mainFooter.style.display = "block";
    if (closeBtn) closeBtn.style.display = "block";

    initReferralUI();
    closeAuthModal();
  } else {
    if (drawerAuthNotLoggedIn) drawerAuthNotLoggedIn.style.display = "block";
    if (drawerAuthLoggedIn) drawerAuthLoggedIn.style.display = "none";

    if (mainDash) mainDash.style.display = "none";
    if (mainFooter) mainFooter.style.display = "none";
    if (closeBtn) closeBtn.style.display = "none";

    if (authModal) authModal.classList.add("active");
    switchAuthTab('login');
  }
}

function openAuthModal(tab = 'login') {
  playAudioSFX("action");
  document.getElementById("authModal").classList.add("active");
  switchAuthTab(tab);
}

function closeAuthModal() {
  if (!currentActiveUserAccount) return;
  document.getElementById("authModal").classList.remove("active");
  const statusMsg = document.getElementById("authStatusMsg");
  if (statusMsg) statusMsg.innerText = "";
}

function switchAuthTab(tab) {
  playAudioSFX("action");
  const loginForm = document.getElementById("loginForm");
  const regForm = document.getElementById("registerForm");
  const resetForm = document.getElementById("resetForm");
  const tabBox = document.getElementById("authTabBox");
  const tabLogin = document.getElementById("tabLoginBtn");
  const tabReg = document.getElementById("tabRegisterBtn");

  if (tab === 'login') {
    if (tabBox) tabBox.style.display = "flex";
    if (loginForm) loginForm.style.display = "block";
    if (regForm) regForm.style.display = "none";
    if (resetForm) resetForm.style.display = "none";
    if (tabLogin) tabLogin.className = "btn btn-primary";
    if (tabReg) tabReg.className = "btn btn-secondary";
  } else if (tab === 'register') {
    if (tabBox) tabBox.style.display = "flex";
    if (loginForm) loginForm.style.display = "none";
    if (regForm) regForm.style.display = "block";
    if (resetForm) resetForm.style.display = "none";
    if (tabLogin) tabLogin.className = "btn btn-secondary";
    if (tabReg) tabReg.className = "btn btn-primary";
  } else if (tab === 'reset') {
    if (tabBox) tabBox.style.display = "none";
    if (loginForm) loginForm.style.display = "none";
    if (regForm) regForm.style.display = "none";
    if (resetForm) resetForm.style.display = "block";
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim().toLowerCase();
  const email = document.getElementById("regEmail").value.trim();
  const faucetEmail = document.getElementById("regFaucetEmail") ? document.getElementById("regFaucetEmail").value.trim() : email;
  const password = document.getElementById("regPassword").value;
  const statusMsg = document.getElementById("authStatusMsg");

  statusMsg.innerText = "⏳ Creating account...";

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        email: email,
        faucetpay_email: faucetEmail,
        password: password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      statusMsg.innerText = `❌ ${data.error || 'Registration failed'}`;
      return;
    }

    currentActiveUserAccount = username;
    currentActiveFaucetEmail = faucetEmail;
    userVaultBalance = 0.0;

    localStorage.setItem("cyberstrike_user", username);
    localStorage.setItem("cyberstrike_faucet_email", faucetEmail);

    playAudioSFX("win");
    initUserSessionUI();
    updateVaultBalanceUI();
    showCustomAlert(`🎉 Account created successfully! Welcome to CyberStrike, ${username}.`, "WELCOME");
  } catch (err) {
    statusMsg.innerText = "❌ Connection error.";
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const identifier = document.getElementById("loginUsername").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const statusMsg = document.getElementById("authStatusMsg");

  statusMsg.innerText = "⏳ Authenticating...";

  try {
    const sb = getSupabase();
    if (!sb) {
      statusMsg.innerText = "❌ Supabase loading... try again in 3s.";
      return;
    }

    const { data: profile, error: fetchError } = await sb
      .from('profiles')
      .select('email, username, vault_balance, faucetpay_email')
      .or(`username.eq.${identifier},email.eq.${identifier}`)
      .maybeSingle();

    if (fetchError) {
      statusMsg.innerText = "❌ Database error checking credentials.";
      return;
    }

    let authEmail = profile ? profile.email : identifier;

    const { data: authData, error: loginError } = await sb.auth.signInWithPassword({
      email: authEmail,
      password: password
    });

    if (loginError) {
      statusMsg.innerText = "❌ Invalid email/username or password!";
      return;
    }

    const loggedInUsername = profile?.username || authData.user.user_metadata?.username || identifier;
    currentActiveUserAccount = loggedInUsername;
    currentActiveFaucetEmail = profile?.faucetpay_email || authData.user.email;
    userVaultBalance = profile ? parseFloat(profile.vault_balance) : 0.0;

    localStorage.setItem("cyberstrike_user", loggedInUsername);
    localStorage.setItem("cyberstrike_faucet_email", currentActiveFaucetEmail);

    playAudioSFX("win");
    initUserSessionUI();
    fetchLatestVaultBalance();
    showCustomAlert(`🔓 Welcome back, ${loggedInUsername}! Vault loaded.`, "LOGIN SUCCESSFUL");

  } catch (err) {
    statusMsg.innerText = "❌ Authentication error: " + err.message;
  }
}

async function handleResetPasswordSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("resetEmail").value.trim();
  const statusMsg = document.getElementById("authStatusMsg");

  statusMsg.innerText = "⏳ Sending recovery link...";

  try {
    const sb = getSupabase();
    if (!sb) { statusMsg.innerText = "❌ Supabase loading..."; return; }

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}?reset=true`
    });

    if (error) {
      statusMsg.innerText = `❌ ${error.message}`;
    } else {
      statusMsg.innerText = "";
      switchAuthTab('login');
      playAudioSFX("action");
      showCustomAlert("📩 Password reset email sent! Check your inbox.", "RESET LINK SENT");
    }
  } catch (err) {
    statusMsg.innerText = "❌ Network error.";
  }
}

function logoutUser() {
  playAudioSFX("action");
  const sb = getSupabase();
  if (sb) sb.auth.signOut();
  currentActiveUserAccount = null;
  currentActiveFaucetEmail = "";
  localStorage.removeItem("cyberstrike_user");
  localStorage.removeItem("cyberstrike_faucet_email");
  localStorage.removeItem("cyberstrike_vault_balance");
  userVaultBalance = 0.0;
  initUserSessionUI();
  updateVaultBalanceUI();
  showCustomAlert("🚪 You have logged out.", "LOGGED OUT");
}
  // ==========================================================================
// CYBERSTRIKE CORE SCRIPT (PART 3: WALLET, TRANSACTIONS & SPRINT)
// ==========================================================================

async function recordWagerVolume(stakeAmount) {
  weeklyWageredPOL += stakeAmount;
  updateWagerSprintUI();

  const referrer = localStorage.getItem("cyberstrike_referrer");
  if (referrer) {
    const refCommission = stakeAmount * 0.10;
    totalRefEarned += refCommission;
  }

  // --- PERSIST WAGER VOLUME TO SUPABASE FOR THE LEADERBOARD (ALL GAMES) ---
  const sb = getSupabase();
  if (!sb || !currentActiveUserAccount) return;

  try {
    const { data: profile } = await sb
      .from('profiles')
      .select('id, total_wagered')
      .ilike('username', currentActiveUserAccount)
      .maybeSingle();

    if (profile) {
      const currentDbWagered = parseFloat(profile.total_wagered || 0);
      const newTotalWagered = currentDbWagered + stakeAmount;

      await sb
        .from('profiles')
        .update({ total_wagered: newTotalWagered })
        .eq('id', profile.id);
    }
  } catch (err) {
    console.error("Leaderboard wager update error:", err.message);
  }
}

function checkDepositReturnStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get("deposit");

  if (status === "success") {
    playAudioSFX("deposit");
    showCustomAlert(
      "🎉 Your payment was submitted! Your Vault Balance will update in a few seconds.",
      "DEPOSIT SUBMITTED"
    );
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (status === "cancelled") {
    playAudioSFX("lose");
    showCustomAlert("❌ Deposit checkout was cancelled.", "DEPOSIT CANCELLED");
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function captureReferrerFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const refUser = urlParams.get("ref");
  if (refUser && refUser !== currentActiveUserAccount) {
    localStorage.setItem("cyberstrike_referrer", refUser);
  }
}

function initReferralUI() {
  const refInput = document.getElementById("referralLinkInput");
  if (refInput && currentActiveUserAccount) {
    const currentDomain = window.location.origin + window.location.pathname;
    refInput.value = `${currentDomain}?ref=${currentActiveUserAccount}`;
  }
}

function copyReferralLink() {
  playAudioSFX("action");
  const refInput = document.getElementById("referralLinkInput");
  if (refInput) {
    refInput.select();
    refInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(refInput.value);
    showCustomAlert("📋 Referral link copied to clipboard!", "REFERRAL PROGRAM");
  }
}

function updateVaultBalanceUI() {
  const balDisplay = document.getElementById("userBalanceDisplay");
  if (balDisplay) balDisplay.innerText = `${userVaultBalance.toFixed(4)} POL`;
  
  localStorage.setItem("cyberstrike_vault_balance", userVaultBalance);

  const refEarnedEl = document.getElementById("totalRefEarnedDisplay");
  if (refEarnedEl) refEarnedEl.innerText = `${totalRefEarned.toFixed(4)} POL`;
}

function updateFaucetPayCustom() {
  const amtInput = document.getElementById("depositAmountInput");
  const customField = document.getElementById("faucetPayCustomField");
  if (amtInput && customField) {
    customField.value = JSON.stringify({
      account_id: currentActiveUserAccount,
      amount: amtInput.value
    });
  }
}

let isDepositing = false;

async function fetchLatestVaultBalance() {
  if (isDepositing) return;

  const sb = getSupabase();
  if (!sb) return;

  try {
    const { data: { session } } = await sb.auth.getSession();
    
    let profile = null;
    if (session && session.user) {
      const { data } = await sb
        .from("profiles")
        .select("vault_balance")
        .eq("id", session.user.id)
        .maybeSingle();
      profile = data;
    } else if (currentActiveUserAccount) {
      const { data } = await sb
        .from("profiles")
        .select("vault_balance")
        .ilike("username", currentActiveUserAccount)
        .maybeSingle();
      profile = data;
    }

    if (profile && profile.vault_balance !== undefined) {
      const serverBalance = parseFloat(profile.vault_balance);
      if (!isDepositing && serverBalance !== userVaultBalance) {
        userVaultBalance = serverBalance;
        updateVaultBalanceUI();
      }
    }
  } catch (err) {
    console.error("Polling fetch error:", err.message);
  }
}

function startLiveBalancePolling() {
  fetchLatestVaultBalance();
  setInterval(fetchLatestVaultBalance, 4000);
}

function getNextMondayMidnight() {
  const now = new Date();
  const nextMonday = new Date(now);
  const dayOfWeek = now.getDay();
  let daysUntilMonday = (1 - dayOfWeek + 7) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7;
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday.getTime();
}

function startSprintCountdownTimer() {
  function updateTimer() {
    const now = new Date().getTime();
    const targetMonday = getNextMondayMidnight();
    const timeRemaining = targetMonday - now;

    if (timeRemaining <= 0) {
      weeklyWageredPOL = 0.0;
      WAGER_MILESTONES.forEach(m => m.claimed = false);
      updateWagerSprintUI();
      return;
    }

    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

    const pad = (num) => String(num).padStart(2, "0");
    const sprintEl = document.getElementById("sprintCountdown");
    if (sprintEl) sprintEl.innerText = `${pad(days)}D ${pad(hours)}H ${pad(minutes)}M ${pad(seconds)}S`;
  }
  updateTimer();
  setInterval(updateTimer, 1000);
}

function openDepositModal() {
  playAudioSFX("action");
  const modal = document.getElementById("depositModal");
  if (modal) modal.classList.add("active");
}

function closeDepositModal() { 
  const modal = document.getElementById("depositModal");
  if (modal) modal.classList.remove("active"); 
}

function openWithdrawModal() {
  playAudioSFX("action");
  const emailInput = document.getElementById("withdrawEmailInput");
  if (emailInput && typeof currentActiveFaucetEmail !== "undefined" && currentActiveFaucetEmail) {
    emailInput.value = currentActiveFaucetEmail;
  }
  const modal = document.getElementById("withdrawModal");
  if (modal) modal.classList.add("active");
}

function closeWithdrawModal() { 
  const modal = document.getElementById("withdrawModal");
  if (modal) modal.classList.remove("active"); 
}

async function executePolWithdrawal() {
  const emailInput = document.getElementById("withdrawEmailInput");
  const amtInput = document.getElementById("withdrawAmountInput");
  const statusEl = document.getElementById("withdrawStatus");
  const confirmBtn = document.getElementById("confirmWithdrawBtn");

  const faucetEmail = emailInput ? emailInput.value.trim() : "";
  const amountInput = amtInput ? parseFloat(amtInput.value) : 0;
  const MIN_WITHDRAWAL = 2.0;

  if (!faucetEmail || !faucetEmail.includes("@")) {
    if (statusEl) statusEl.innerText = "❌ Enter a valid FaucetPay withdrawal email address!";
    return;
  }
  if (!amountInput || amountInput < MIN_WITHDRAWAL) {
    if (statusEl) statusEl.innerText = `❌ Min withdrawal is ${MIN_WITHDRAWAL} POL!`;
    return;
  }
  if (amountInput > userVaultBalance) {
    if (statusEl) statusEl.innerText = "❌ Insufficient Vault Balance!";
    return;
  }

  if (statusEl) statusEl.innerText = "⏳ Processing FaucetPay Payout...";
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const response = await fetch("/api/faucetpay-withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: currentActiveUserAccount,
        email: faucetEmail,
        amount: amountInput,
        currency: "POL"
      })
    });

    const result = await response.json();

    if (result.success) {
      playAudioSFX("withdraw");
      
      if (result.newBalance !== undefined) {
        userVaultBalance = parseFloat(result.newBalance);
      } else {
        userVaultBalance = Math.max(0, userVaultBalance - amountInput);
      }
      updateVaultBalanceUI();

      if (statusEl) statusEl.innerText = `✅ Withdrawal Sent Successfully via FaucetPay!`;
      setTimeout(() => {
        closeWithdrawModal();
        if (amtInput) amtInput.value = "";
        if (statusEl) statusEl.innerText = "";
        if (confirmBtn) confirmBtn.disabled = false;
      }, 2500);
    } else {
      playAudioSFX("lose");
      if (statusEl) statusEl.innerText = `❌ Payout Failed: ${result.message || 'Check balance/API limits'}`;
      if (confirmBtn) confirmBtn.disabled = false;
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = "❌ Network error connecting to FaucetPay gateway.";
    if (confirmBtn) confirmBtn.disabled = false;
  }
    }
      // ==========================================================================
// CYBERSTRIKE CORE SCRIPT (PART 4: MODALS & PENALTY GAME ENGINE)
// ==========================================================================

function selectStake(btnElement) {
  playAudioSFX("stake");
  document.querySelectorAll(".stake-btn").forEach(b => b.classList.remove("active"));
  btnElement.classList.add("active");
  currentSelectedStake = parseFloat(btnElement.getAttribute("data-stake"));
  
  const totalPoolEl = document.getElementById("summaryTotalPool");
  const winnerPayoutEl = document.getElementById("summaryWinnerPayout");
  if (totalPoolEl) totalPoolEl.innerText = `${(currentSelectedStake * 2).toFixed(2)} POL`;
  if (winnerPayoutEl) winnerPayoutEl.innerText = `${(currentSelectedStake * 2 * 0.8).toFixed(2)} POL`;
}

function updateWagerSprintUI() {
  const nextMilestone = WAGER_MILESTONES.find(m => weeklyWageredPOL < m.target) || WAGER_MILESTONES[WAGER_MILESTONES.length - 1];
  const wagerTextEl = document.getElementById("weeklyWagerText");
  if (wagerTextEl) wagerTextEl.innerText = `${weeklyWageredPOL.toFixed(1)} / ${nextMilestone.target} POL WAGERED`;
  
  const pct = Math.min(100, Math.round((weeklyWageredPOL / nextMilestone.target) * 100));
  const sprintPctEl = document.getElementById("sprintProgressPct");
  const sprintBarEl = document.getElementById("sprintProgressBar");
  if (sprintPctEl) sprintPctEl.innerText = `${pct}%`;
  if (sprintBarEl) sprintBarEl.style.width = `${pct}%`;

  WAGER_MILESTONES.forEach(m => {
    const tierEl = document.getElementById(`mTier-${m.target}`);
    if (tierEl) {
      const claimBtn = tierEl.querySelector("button");
      if (weeklyWageredPOL >= m.target && !m.claimed) claimBtn.removeAttribute("disabled");
      else claimBtn.setAttribute("disabled", "true");
    }
  });
}

function claimMilestone(targetTier) {
  const milestone = WAGER_MILESTONES.find(m => m.target === targetTier);
  if (!milestone || milestone.claimed || weeklyWageredPOL < targetTier) return;
  
  playAudioSFX("milestone");
  milestone.claimed = true;
  userVaultBalance += milestone.reward;
  updateVaultBalanceUI();
  const claimBtn = document.getElementById(`mTier-${targetTier}`).querySelector("button");
  if (claimBtn) {
    claimBtn.innerText = "CLAIMED";
    claimBtn.setAttribute("disabled", "true");
  }
  showCustomAlert(`🎉 Claimed +${milestone.reward} POL Milestone Reward!`, "SPRINT REWARD");
}

function openProfileModal() {
  playAudioSFX("action");
  const curUserEl = document.getElementById("profileCurrentUsername");
  if (curUserEl) curUserEl.value = currentActiveUserAccount || "";
  const modal = document.getElementById("profileModal");
  if (modal) modal.classList.add("active");
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal) modal.classList.remove("active");
  const msg = document.getElementById("profileStatusMsg");
  if (msg) msg.innerText = "";
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const newUsername = document.getElementById("profileNewUsername").value.trim().toLowerCase();
  const newPassword = document.getElementById("profileNewPassword").value;
  const statusMsg = document.getElementById("profileStatusMsg");

  if (!newUsername && !newPassword) {
    statusMsg.innerText = "❌ Enter a new username or password to update.";
    return;
  }

  statusMsg.innerText = "⏳ Updating profile...";
  const sb = getSupabase();
  if (!sb) { statusMsg.innerText = "❌ Supabase client not loaded."; return; }

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { statusMsg.innerText = "❌ Session expired. Please log in again."; return; }

    if (newPassword) {
      const { error: passErr } = await sb.auth.updateUser({ password: newPassword });
      if (passErr) throw new Error(passErr.message);
    }

    if (newUsername) {
      const { error: userErr } = await sb
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', session.user.id);

      if (userErr) throw new Error(userErr.message);

      currentActiveUserAccount = newUsername;
      localStorage.setItem("cyberstrike_user", newUsername);
      initUserSessionUI();
    }

    playAudioSFX("win");
    statusMsg.innerText = "✅ Profile updated successfully!";
    setTimeout(() => {
      closeProfileModal();
      document.getElementById("profileNewUsername").value = "";
      document.getElementById("profileNewPassword").value = "";
    }, 2000);

  } catch (err) {
    statusMsg.innerText = `❌ Update failed: ${err.message}`;
  }
}

let currentHistoryTab = "deposits";

function openHistoryModal(tab = "deposits") {
  playAudioSFX("action");
  const modal = document.getElementById("historyModal");
  if (modal) modal.classList.add("active");
  switchHistoryTab(tab);
}

function closeHistoryModal() {
  const modal = document.getElementById("historyModal");
  if (modal) modal.classList.remove("active");
}

function switchHistoryTab(tab) {
  currentHistoryTab = tab;
  const depBtn = document.getElementById("historyTabDeposits");
  const withBtn = document.getElementById("historyTabWithdrawals");

  if (tab === "deposits") {
    if (depBtn) depBtn.className = "btn btn-primary";
    if (withBtn) withBtn.className = "btn btn-secondary";
  } else {
    if (depBtn) depBtn.className = "btn btn-secondary";
    if (withBtn) withBtn.className = "btn btn-primary";
  }

  fetchTransactionHistory(tab);
}

async function fetchTransactionHistory(type) {
  const tableBody = document.getElementById("historyTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--text-muted);">Loading ${type}...</td></tr>`;

  const sb = getSupabase();
  if (!sb || !currentActiveUserAccount) {
    tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--text-muted);">Please log in to view history.</td></tr>`;
    return;
  }

  try {
    const { data: { session } } = await sb.auth.getSession();
    const userId = session ? session.user.id : null;

    let query = sb.from("processed_transactions").select("*").order("created_at", { ascending: false }).limit(20);

    if (userId) {
      query = query.or(`user_id.eq.${userId},account_id.ilike.${currentActiveUserAccount},username.ilike.${currentActiveUserAccount}`);
    } else {
      query = query.or(`account_id.ilike.${currentActiveUserAccount},username.ilike.${currentActiveUserAccount}`);
    }

    if (type === "deposits") {
      query = query.ilike("type", "%deposit%");
    } else {
      query = query.ilike("type", "%withdraw%");
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--text-muted);">No ${type} records found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = data.map(tx => {
      const dateStr = new Date(tx.created_at || Date.now()).toLocaleDateString();
      const amt = parseFloat(tx.amount || 0).toFixed(4);
      const isDeposit = type === "deposits";
      const color = isDeposit ? "var(--accent-green)" : "var(--accent-cyan)";
      
      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 10px 8px; color: var(--text-muted);">${dateStr}</td>
          <td style="padding: 10px 8px; color: ${color}; font-weight: 800;">${isDeposit ? '+' : '-'}${amt} POL</td>
          <td style="padding: 10px 8px;"><span style="color:var(--accent-green); font-weight:700;">COMPLETED</span></td>
        </tr>
      `;
    }).join("");

  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--accent-magenta);">Error loading records.</td></tr>`;
  }
}

function openLeaderboardModal() {
  playAudioSFX("action");
  const modal = document.getElementById("leaderboardModal");
  if (modal) modal.classList.add("active");
  fetchLeaderboardData();
}

function closeLeaderboardModal() {
  const modal = document.getElementById("leaderboardModal");
  if (modal) modal.classList.remove("active");
}

async function fetchLeaderboardData() {
  const tableBody = document.getElementById("leaderboardTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--text-muted);">Loading rankings...</td></tr>`;

  const sb = getSupabase();
  if (!sb) return;

  try {
    const { data, error } = await sb
      .from("profiles")
      .select("username, total_wagered")
      .order("total_wagered", { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--text-muted);">No wager records yet.</td></tr>`;
      return;
    }

    tableBody.innerHTML = data.map((player, index) => {
      const rank = index + 1;
      const rankBadge = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
      const total = parseFloat(player.total_wagered || 0).toFixed(2);
      
      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 10px 8px; font-weight: 800; color: var(--accent-cyan);">${rankBadge}</td>
          <td style="padding: 10px 8px; font-weight: 700; color: #fff;">${player.username || "Anonymous"}</td>
          <td style="padding: 10px 8px; text-align: right; color: var(--accent-green); font-weight: 800;">${total} POL</td>
        </tr>
      `;
    }).join("");

  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--accent-magenta);">Failed to fetch leaderboard.</td></tr>`;
  }
}

// --- PENALTY SHOOTOUT ENGINE ---
let penaltyTurnTimer = null;
let penaltyTimeLeft = 5;
let p1PenaltyShotsTaken = 0;
let p2PenaltyShotsTaken = 0;
let p1PenaltyScore = 0;
let p2PenaltyScore = 0;
let isP1PenaltyTurn = true;
let isPenaltyActive = false;
let isPenaltyTraining = false;

async function launchPenaltyArena(isTraining = false) {
  playAudioSFX("action");
  window.scrollTo({ top: 0, behavior: 'smooth' });
  isPenaltyTraining = isTraining;

  if (!isTraining) {
    if (userVaultBalance < currentSelectedStake) {
      showCustomAlert("Insufficient POL Balance in Vault!", "INSUFFICIENT BALANCE");
      return;
    }
    userVaultBalance -= currentSelectedStake;
    updateVaultBalanceUI();
    await recordWagerVolume(currentSelectedStake);
  }

  p1PenaltyShotsTaken = 0;
  p2PenaltyShotsTaken = 0;
  p1PenaltyScore = 0;
  p2PenaltyScore = 0;
  isP1PenaltyTurn = true;
  isPenaltyActive = true;

  document.getElementById("p1Score").innerText = "0";
  document.getElementById("p2Score").innerText = "0";
  updateShotTrackerDisplay();

  document.getElementById("controlsBox").innerHTML = `
    <button class="btn btn-shoot" onclick="takeShot('left')">👈 LEFT</button>
    <button class="btn btn-shoot" onclick="takeShot('center')">🎯 CENTER</button>
    <button class="btn btn-shoot" onclick="takeShot('right')">👉 RIGHT</button>
  `;

  resetPenaltyVisuals();
  setPenaltyControlsActive(true);
  document.getElementById("penaltyOverlay").classList.add("active");
  startPenaltyAvatarTimer();
}

function updateShotTrackerDisplay() {
  document.getElementById("penaltyRoundDisplay").innerText = `SHOTS ${p1PenaltyShotsTaken}/5 - ${p2PenaltyShotsTaken}/5`;
}

function startPenaltyAvatarTimer() {
  if (penaltyTurnTimer) clearInterval(penaltyTurnTimer);
  penaltyTimeLeft = 5;
  updatePenaltyTimersUI();

  penaltyTurnTimer = setInterval(() => {
    penaltyTimeLeft--;
    updatePenaltyTimersUI();
    if (penaltyTimeLeft <= 0) {
      clearInterval(penaltyTurnTimer);
      handlePenaltyTimeout();
    }
  }, 1000);
}

function updatePenaltyTimersUI() {
  const p1TimerEl = document.getElementById("p1TurnTimer");
  const p2TimerEl = document.getElementById("p2TurnTimer");
  const bannerEl = document.getElementById("penaltyBanner");

  if (p1TimerEl && p2TimerEl) {
    p1TimerEl.innerText = isP1PenaltyTurn && isPenaltyActive ? `(${penaltyTimeLeft}s)` : "";
    p2TimerEl.innerText = !isP1PenaltyTurn && isPenaltyActive ? `(${penaltyTimeLeft}s)` : "";
  }

  if (isP1PenaltyTurn && isPenaltyActive && bannerEl) {
    const prefix = isPenaltyTraining ? "🤖 TRAINING MODE" : "YOUR TURN";
    bannerEl.innerText = `${prefix}! CHOOSE YOUR CORNER (${penaltyTimeLeft}s)`;
  }
}

function handlePenaltyTimeout() {
  if (!isPenaltyActive) return;
  playAudioSFX("action");
  if (isP1PenaltyTurn) {
    document.getElementById("penaltyBanner").innerText = "⏳ TIME OUT! SHOT MISSED. BOT'S TURN.";
    setPenaltyControlsActive(false);
    p1PenaltyShotsTaken++;
    updateShotTrackerDisplay();

    setTimeout(() => {
      if (checkPenaltyMatchOver()) return;
      isP1PenaltyTurn = false;
      isPenaltyActive = true;
      document.getElementById("penaltyBanner").innerText = "BOT OPPONENT TAKING SHOT...";
      startPenaltyAvatarTimer();
      setTimeout(processBotPenaltyShot, 1000);
    }, 1200);
  } else {
    isP1PenaltyTurn = true;
    isPenaltyActive = true;
    startPenaltyAvatarTimer();
  }
}

function takeShot(direction) {
  if (!isP1PenaltyTurn || !isPenaltyActive) return;
  playAudioSFX("action");
  if (penaltyTurnTimer) clearInterval(penaltyTurnTimer);
  isPenaltyActive = false;
  setPenaltyControlsActive(false);

  document.getElementById("ballEl").className = `ball top-${direction}`;
  const directions = ["left", "center", "right"];
  const keeperDive = directions[Math.floor(Math.random() * directions.length)];

  setTimeout(() => { document.getElementById("keeperEl").className = `keeper jump-${keeperDive} top-${keeperDive}`; }, 100);

  setTimeout(() => {
    if (direction !== keeperDive) {
      playAudioSFX("win");
      p1PenaltyScore++;
      document.getElementById("p1Score").innerText = p1PenaltyScore;
      document.getElementById("penaltyBanner").innerText = `⚽ GOAL! SCORED ${direction.toUpperCase()}!`;
    } else {
      playAudioSFX("lose");
      document.getElementById("penaltyBanner").innerText = `🧤 SAVED! KEEPER BLOCKED!`;
    }
    p1PenaltyShotsTaken++;
    updateShotTrackerDisplay();

    setTimeout(() => {
      if (checkPenaltyMatchOver()) return;
      isP1PenaltyTurn = false;
      isPenaltyActive = true;
      document.getElementById("penaltyBanner").innerText = "BOT OPPONENT TAKING SHOT...";
      resetPenaltyVisuals();
      startPenaltyAvatarTimer();
      setTimeout(processBotPenaltyShot, 1200);
    }, 1200);
  }, 400);
}

function processBotPenaltyShot() {
  if (!isPenaltyActive) return;
  const directions = ["left", "center", "right"];
  const botShot = directions[Math.floor(Math.random() * directions.length)];
  const myDive = directions[Math.floor(Math.random() * directions.length)];

  document.getElementById("ballEl").className = `ball top-${botShot}`;
  document.getElementById("keeperEl").className = `keeper top-${myDive}`;

  setTimeout(() => {
    if (botShot !== myDive) {
      playAudioSFX("lose");
      p2PenaltyScore++;
      document.getElementById("p2Score").innerText = p2PenaltyScore;
      document.getElementById("penaltyBanner").innerText = `❌ BOT SCORED (${botShot.toUpperCase()})!`;
    } else {
      playAudioSFX("win");
      document.getElementById("penaltyBanner").innerText = `🛡️ YOU SAVED BOT'S SHOT!`;
    }
    p2PenaltyShotsTaken++;
    updateShotTrackerDisplay();

    setTimeout(() => {
      if (checkPenaltyMatchOver()) return;
      isP1PenaltyTurn = true;
      isPenaltyActive = true;
      resetPenaltyVisuals();
      setPenaltyControlsActive(true);
      startPenaltyAvatarTimer();
    }, 1200);
  }, 400);
}

function checkPenaltyMatchOver() {
  if (p1PenaltyShotsTaken >= 5 && p2PenaltyShotsTaken >= 5) {
    endPenaltyMatch();
    return true;
  }
  return false;
}

function resetPenaltyVisuals() {
  document.getElementById("keeperEl").className = "keeper center";
  document.getElementById("ballEl").className = "ball center";
}

function setPenaltyControlsActive(active) {
  document.querySelectorAll(".btn-shoot").forEach(b => b.disabled = !active);
}

function endPenaltyMatch() {
  if (penaltyTurnTimer) clearInterval(penaltyTurnTimer);
  isPenaltyActive = false;
  setPenaltyControlsActive(false);

  document.getElementById("p1TurnTimer").innerText = "";
  document.getElementById("p2TurnTimer").innerText = "";

  const winnerPayout = (currentSelectedStake * 2) * 0.80;
  let resultMsg = "";

  if (p1PenaltyScore > p2PenaltyScore) {
    playAudioSFX("win");
    if (!isPenaltyTraining) {
      userVaultBalance += winnerPayout;
      resultMsg = `🎉 YOU WON! +${winnerPayout.toFixed(2)} POL!`;
    } else {
      resultMsg = `🎉 TRAINING WIN! (Practice Mode)`;
    }
  } else if (p2PenaltyScore > p1PenaltyScore) {
    playAudioSFX("lose");
    resultMsg = isPenaltyTraining ? `🤖 TRAINING ENDED. BOT WON.` : `💔 BOT WON THE SHOOTOUT!`;
  } else {
    playAudioSFX("action");
    if (!isPenaltyTraining) {
      userVaultBalance += currentSelectedStake;
      resultMsg = `🤝 DRAW MATCH! Stake Refunded.`;
    } else {
      resultMsg = `🤝 TRAINING DRAW!`;
    }
  }

  document.getElementById("penaltyBanner").innerText = `🎮 GAME OVER! ${resultMsg}`;
  updateVaultBalanceUI();

  document.getElementById("controlsBox").innerHTML = `
    <button class="btn btn-launch" style="grid-column: span 3; margin-top:0;" onclick="closePenaltyArena()">
      🔄 GAME OVER - RETRY / CHOOSE GAME
    </button>
  `;
}

function closePenaltyArena() {
  playAudioSFX("action");
  if (penaltyTurnTimer) clearInterval(penaltyTurnTimer);
  isPenaltyActive = false;
  document.getElementById("penaltyOverlay").classList.remove("active");
}
  // ==========================================================================
// CYBERSTRIKE CORE SCRIPT (PART 5: LUDO, COIN FLIP & RPS ENGINES)
// ==========================================================================

// --- LUDO RACE ENGINE ---
let ludoTurnTimer = null;
let ludoTimeLeft = 5;
let p1TrackPosition = 0;
let p2TrackPosition = 0;
let isLudoP1Turn = true;
let isLudoActive = false;
let isLudoTraining = false;

async function launchLudoRace(isTraining = false) {
  playAudioSFX("action");
  window.scrollTo({ top: 0, behavior: 'smooth' });
  isLudoTraining = isTraining;

  if (!isTraining) {
    if (userVaultBalance < currentSelectedStake) {
      showCustomAlert("Insufficient POL Balance in Vault!", "INSUFFICIENT BALANCE");
      return;
    }
    userVaultBalance -= currentSelectedStake;
    updateVaultBalanceUI();
    await recordWagerVolume(currentSelectedStake);
  }

  p1TrackPosition = 0;
  p2TrackPosition = 0;
  isLudoP1Turn = true;
  isLudoActive = true;

  updateLudoTrackUI();
  document.getElementById("p1TrackPos").innerText = "0/10";
  document.getElementById("p2TrackPos").innerText = "0/10";
  document.getElementById("diceValueDisplay").innerText = "🎲 -";

  const controlsEl = document.querySelector(".ludo-controls");
  controlsEl.innerHTML = `
    <div id="diceValueDisplay" class="dice-box">🎲 -</div>
    <button id="rollDiceBtn" class="btn btn-launch" style="margin-top:0;" onclick="rollLudoDice()">ROLL DICE</button>
  `;

  document.getElementById("ludoOverlay").classList.add("active");
  startLudoAvatarTimer();
}

function startLudoAvatarTimer() {
  if (ludoTurnTimer) clearInterval(ludoTurnTimer);
  ludoTimeLeft = 5;
  updateLudoTimersUI();

  ludoTurnTimer = setInterval(() => {
    ludoTimeLeft--;
    updateLudoTimersUI();
    if (ludoTimeLeft <= 0) {
      clearInterval(ludoTurnTimer);
      handleLudoTimeout();
    }
  }, 1000);
}

function updateLudoTimersUI() {
  const p1TimerEl = document.getElementById("ludoP1Timer");
  const p2TimerEl = document.getElementById("ludoP2Timer");
  const turnIndEl = document.getElementById("ludoTurnIndicator");
  const bannerEl = document.getElementById("ludoBanner");

  if (p1TimerEl && p2TimerEl) {
    p1TimerEl.innerText = isLudoP1Turn && isLudoActive ? `(${ludoTimeLeft}s)` : "";
    p2TimerEl.innerText = !isLudoP1Turn && isLudoActive ? `(${ludoTimeLeft}s)` : "";
  }

  if (isLudoP1Turn && isLudoActive) {
    if (turnIndEl) turnIndEl.innerText = `YOUR TURN (${ludoTimeLeft}s)`;
    if (bannerEl) bannerEl.innerText = `ROLL THE DICE TO ADVANCE (${ludoTimeLeft}s)!`;
  }
}

function handleLudoTimeout() {
  if (!isLudoActive) return;
  playAudioSFX("action");
  if (isLudoP1Turn) {
    document.getElementById("ludoBanner").innerText = "⏳ TIME OUT! TURN SKIPPED. BOT'S TURN.";
    const rollBtn = document.getElementById("rollDiceBtn");
    if (rollBtn) rollBtn.disabled = true;
    setTimeout(() => {
      isLudoP1Turn = false;
      document.getElementById("ludoTurnIndicator").innerText = "BOT'S TURN";
      document.getElementById("ludoBanner").innerText = "BOT IS ROLLING...";
      startLudoAvatarTimer();
      setTimeout(processBotLudoTurn, 1000);
    }, 1000);
  }
}

function rollLudoDice() {
  if (!isLudoP1Turn || !isLudoActive) return;
  playAudioSFX("action");
  if (ludoTurnTimer) clearInterval(ludoTurnTimer);
  document.getElementById("rollDiceBtn").disabled = true;

  const p1Roll = Math.floor(Math.random() * 6) + 1;
  document.getElementById("diceValueDisplay").innerText = `🎲 ${p1Roll}`;
  p1TrackPosition = Math.min(10, p1TrackPosition + p1Roll);
  updateLudoTrackUI();

  document.getElementById("ludoBanner").innerText = `YOU ROLLED A ${p1Roll}! MOVED TO STEP ${p1TrackPosition}/10`;

  if (p1TrackPosition >= 10) {
    endLudoRace();
    return;
  }

  setTimeout(() => {
    isLudoP1Turn = false;
    document.getElementById("ludoTurnIndicator").innerText = "BOT'S TURN";
    document.getElementById("ludoBanner").innerText = "BOT OPPONENT IS ROLLING...";
    startLudoAvatarTimer();
    setTimeout(processBotLudoTurn, 1000);
  }, 1000);
}

function processBotLudoTurn() {
  if (!isLudoActive) return;
  const p2Roll = Math.floor(Math.random() * 6) + 1;
  p2TrackPosition = Math.min(10, p2TrackPosition + p2Roll);
  updateLudoTrackUI();

  document.getElementById("ludoBanner").innerText = `BOT ROLLED A ${p2Roll}! MOVED TO STEP ${p2TrackPosition}/10`;

  if (p2TrackPosition >= 10) {
    endLudoRace();
    return;
  }

  setTimeout(() => {
    isLudoP1Turn = true;
    const rollBtn = document.getElementById("rollDiceBtn");
    if (rollBtn) rollBtn.disabled = false;
    startLudoAvatarTimer();
  }, 1000);
}

function updateLudoTrackUI() {
  document.getElementById("p1TrackPos").innerText = `${p1TrackPosition}/10`;
  document.getElementById("p2TrackPos").innerText = `${p2TrackPosition}/10`;

  for (let i = 1; i <= 10; i++) {
    document.getElementById(`p1-${i}`)?.classList.remove("has-p1");
    document.getElementById(`p2-${i}`)?.classList.remove("has-p2");
  }
  if (p1TrackPosition > 0) document.getElementById(`p1-${p1TrackPosition}`)?.classList.add("has-p1");
  if (p2TrackPosition > 0) document.getElementById(`p2-${p2TrackPosition}`)?.classList.add("has-p2");
}

function endLudoRace() {
  if (ludoTurnTimer) clearInterval(ludoTurnTimer);
  isLudoActive = false;

  document.getElementById("ludoP1Timer").innerText = "";
  document.getElementById("ludoP2Timer").innerText = "";

  const winnerPayout = (currentSelectedStake * 2) * 0.80;
  let resultMsg = "";

  if (p1TrackPosition >= 10 && p2TrackPosition < 10) {
    playAudioSFX("win");
    if (!isLudoTraining) {
      userVaultBalance += winnerPayout;
      resultMsg = `🎉 YOU WON THE LUDO RACE! +${winnerPayout.toFixed(2)} POL!`;
    } else {
      resultMsg = `🎉 TRAINING WIN! (Practice Mode)`;
    }
  } else if (p2TrackPosition >= 10 && p1TrackPosition < 10) {
    playAudioSFX("lose");
    resultMsg = isLudoTraining ? `🤖 TRAINING ENDED. BOT WON.` : `💔 BOT CROSSED FIRST! YOU LOST.`;
  } else {
    playAudioSFX("action");
    if (!isLudoTraining) {
      userVaultBalance += currentSelectedStake;
      resultMsg = `🤝 DRAW RACE! Stake Refunded.`;
    } else {
      resultMsg = `🤝 TRAINING DRAW!`;
    }
  }

  document.getElementById("ludoBanner").innerText = `🎮 GAME OVER! ${resultMsg}`;
  updateVaultBalanceUI();

  const controlsEl = document.querySelector(".ludo-controls");
  controlsEl.innerHTML = `
    <button class="btn btn-launch" style="width: 100%; margin-top:0;" onclick="closeLudoArena()">
      🔄 GAME OVER - RETRY / CHOOSE GAME
    </button>
  `;
}

function closeLudoArena() {
  playAudioSFX("action");
  if (ludoTurnTimer) clearInterval(ludoTurnTimer);
  isLudoActive = false;
  document.getElementById("ludoOverlay").classList.remove("active");
}

// --- COIN FLIP ENGINE ---
let isCoinTraining = false;

async function launchCoinFlipArena(isTraining = false) {
  playAudioSFX("action");
  window.scrollTo({ top: 0, behavior: 'smooth' });
  isCoinTraining = isTraining;

  if (!isTraining) {
    if (userVaultBalance < currentSelectedStake) {
      showCustomAlert("Insufficient POL Balance in Vault!", "INSUFFICIENT BALANCE");
      return;
    }
    userVaultBalance -= currentSelectedStake;
    updateVaultBalanceUI();
    await recordWagerVolume(currentSelectedStake);
  }

  document.getElementById("coinBanner").innerText = isCoinTraining ? "🤖 TRAINING MODE: CHOOSE HEADS OR TAILS" : "CHOOSE HEADS OR TAILS (50/50)";
  document.getElementById("coinDisplayBox").innerText = "🪙";
  
  document.getElementById("coinControlsBox").innerHTML = `
    <button class="btn btn-primary" style="padding: 14px; font-size:14px;" onclick="flipCoin('heads')">👑 HEADS</button>
    <button class="btn btn-launch" style="padding: 14px; font-size:14px; margin-top:0;" onclick="flipCoin('tails')">🦅 TAILS</button>
  `;

  document.getElementById("coinFlipOverlay").classList.add("active");
}

function flipCoin(playerChoice) {
  playAudioSFX("action");
  document.getElementById("coinControlsBox").innerHTML = "";
  document.getElementById("coinBanner").innerText = "🪙 FLIPPING COIN...";
  
  let spins = 0;
  const spinInterval = setInterval(() => {
    playAudioSFX("action");
    document.getElementById("coinDisplayBox").innerText = spins % 2 === 0 ? "👑" : "🦅";
    spins++;
  }, 150);

  setTimeout(() => {
    clearInterval(spinInterval);
    const outcomes = ["heads", "tails"];
    const winningOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];

    document.getElementById("coinDisplayBox").innerText = winningOutcome === "heads" ? "👑" : "🦅";
    const winnerPayout = (currentSelectedStake * 2) * 0.80;
    let resultMsg = "";

    if (playerChoice === winningOutcome) {
      playAudioSFX("win");
      if (!isCoinTraining) {
        userVaultBalance += winnerPayout;
        resultMsg = `🎉 YOU WON! LANDED ${winningOutcome.toUpperCase()}! +${winnerPayout.toFixed(2)} POL!`;
      } else {
        resultMsg = `🎉 TRAINING WIN! LANDED ${winningOutcome.toUpperCase()}`;
      }
    } else {
      playAudioSFX("lose");
      resultMsg = isCoinTraining ? `🤖 TRAINING ENDED. LANDED ${winningOutcome.toUpperCase()}.` : `💔 YOU LOST! LANDED ${winningOutcome.toUpperCase()}.`;
    }

    document.getElementById("coinBanner").innerText = `🎮 GAME OVER! ${resultMsg}`;
    updateVaultBalanceUI();

    document.getElementById("coinControlsBox").innerHTML = `
      <button class="btn btn-launch" style="grid-column: span 2; margin-top:0;" onclick="closeCoinFlipArena()">
        🔄 GAME OVER - RETRY / CHOOSE GAME
      </button>
    `;
  }, 1500);
}

function closeCoinFlipArena() {
  playAudioSFX("action");
  document.getElementById("coinFlipOverlay").classList.remove("active");
}

// --- ROCK PAPER SCISSORS ENGINE ---
let rpsTimer = null;
let rpsTimeLeft = 5;
let isRpsActive = false;
let isRpsTraining = false;

async function launchRpsArena(isTraining = false) {
  playAudioSFX("action");
  window.scrollTo({ top: 0, behavior: 'smooth' });
  isRpsTraining = isTraining;

  if (!isTraining) {
    if (userVaultBalance < currentSelectedStake) {
      showCustomAlert("Insufficient POL Balance in Vault!", "INSUFFICIENT BALANCE");
      return;
    }
    userVaultBalance -= currentSelectedStake;
    updateVaultBalanceUI();
    await recordWagerVolume(currentSelectedStake);
  }

  isRpsActive = true;
  document.getElementById("rpsDisplayBox").innerText = "VS";
  document.getElementById("rpsControlsBox").innerHTML = `
    <button class="btn btn-shoot" onclick="playRps('rock')">🪨 ROCK</button>
    <button class="btn btn-shoot" onclick="playRps('paper')">📄 PAPER</button>
    <button class="btn btn-shoot" onclick="playRps('scissors')">✂️ SCISSORS</button>
  `;

  document.getElementById("rpsOverlay").classList.add("active");
  startRpsTimer();
}

function startRpsTimer() {
  if (rpsTimer) clearInterval(rpsTimer);
  rpsTimeLeft = 5;
  updateRpsBanner();

  rpsTimer = setInterval(() => {
    rpsTimeLeft--;
    updateRpsBanner();
    if (rpsTimeLeft <= 0) {
      clearInterval(rpsTimer);
      handleRpsTimeout();
    }
  }, 1000);
}

function updateRpsBanner() {
  const prefix = isRpsTraining ? "🤖 TRAINING MODE" : "YOUR TURN";
  document.getElementById("rpsBanner").innerText = `${prefix}! CHOOSE MOVE (${rpsTimeLeft}s)`;
}

function handleRpsTimeout() {
  if (!isRpsActive) return;
  playAudioSFX("action");
  document.getElementById("rpsBanner").innerText = "⏳ TIME OUT! MOVE MISSED.";
  setRpsControlsActive(false);
  setTimeout(() => resolveRpsMatch('rock', true), 1000);
}

function playRps(playerChoice) {
  if (!isRpsActive) return;
  playAudioSFX("action");
  if (rpsTimer) clearInterval(rpsTimer);
  isRpsActive = false;
  setRpsControlsActive(false);
  resolveRpsMatch(playerChoice, false);
}

function resolveRpsMatch(playerChoice, timedOut) {
  const choices = ["rock", "paper", "scissors"];
  const botChoice = choices[Math.floor(Math.random() * choices.length)];

  const emojis = { rock: "🪨", paper: "📄", scissors: "✂️" };
  document.getElementById("rpsDisplayBox").innerHTML = `YOU (${emojis[playerChoice]}) VS BOT (${emojis[botChoice]})`;

  const winnerPayout = (currentSelectedStake * 2) * 0.80;
  let resultMsg = "";

  if (timedOut) {
    playAudioSFX("lose");
    resultMsg = `💔 TIME OUT! BOT CHOSE ${botChoice.toUpperCase()}. YOU LOST.`;
  } else if (playerChoice === botChoice) {
    playAudioSFX("action");
    if (!isRpsTraining) {
      userVaultBalance += currentSelectedStake;
      resultMsg = `🤝 TIE! BOTH CHOSE ${playerChoice.toUpperCase()}. Stake Refunded.`;
    } else {
      resultMsg = `🤝 TIE! BOTH CHOSE ${playerChoice.toUpperCase()}`;
    }
  } else if (
    (playerChoice === "rock" && botChoice === "scissors") ||
    (playerChoice === "paper" && botChoice === "rock") ||
    (playerChoice === "scissors" && botChoice === "paper")
  ) {
    playAudioSFX("win");
    if (!isRpsTraining) {
      userVaultBalance += winnerPayout;
      resultMsg = `🎉 YOU WON! ${playerChoice.toUpperCase()} BEATS ${botChoice.toUpperCase()}! +${winnerPayout.toFixed(2)} POL!`;
    } else {
      resultMsg = `🎉 TRAINING WIN!`;
    }
  } else {
    playAudioSFX("lose");
    resultMsg = isRpsTraining ? `🤖 TRAINING ENDED. BOT WON.` : `💔 YOU LOST! ${botChoice.toUpperCase()} BEATS ${playerChoice.toUpperCase()}.`;
  }

  document.getElementById("rpsBanner").innerText = `🎮 GAME OVER! ${resultMsg}`;
  updateVaultBalanceUI();

  document.getElementById("rpsControlsBox").innerHTML = `
    <button class="btn btn-launch" style="grid-column: span 3; margin-top:0;" onclick="closeRpsArena()">
      🔄 GAME OVER - RETRY / CHOOSE GAME
    </button>
  `;
}

function setRpsControlsActive(active) {
  document.querySelectorAll("#rpsControlsBox .btn").forEach(b => b.disabled = !active);
}

function closeRpsArena() {
  playAudioSFX("action");
  if (rpsTimer) clearInterval(rpsTimer);
  isRpsActive = false;
  document.getElementById("rpsOverlay").classList.remove("active");
    }
