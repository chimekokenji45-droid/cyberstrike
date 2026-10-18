// ==========================================================================
// CYBERSTRIKE CORE SCRIPT (SAFE SUPABASE & AUDIO ENGINE)
// ==========================================================================

const SUPABASE_URL = "https://btugwhcoypxtlgmsxqci.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__DjyCoKhrV9vpmAUY-T3lg_0f-Ji2-h";
let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

let userVaultBalance = 0.0;
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
  if (btn) btn.innerText = soundEnabled ? "🔊 SFX: ON" : "🔇 SFX: OFF";
  if (soundEnabled) playAudioSFX("action");
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("soundToggleBtn");
  if (btn) btn.innerText = soundEnabled ? "🔊 SFX: ON" : "🔇 SFX: OFF";

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

function initUserSessionUI() {
  const authNavBox = document.getElementById("authNavBox");
  const userWalletBox = document.getElementById("userWalletBox");
  const userTag = document.getElementById("loggedInUserTag");
  const mainDash = document.getElementById("mainDashboard");
  const mainFooter = document.getElementById("mainFooter");
  const closeBtn = document.getElementById("authCloseBtn");
  const authModal = document.getElementById("authModal");

  if (currentActiveUserAccount) {
    if (authNavBox) authNavBox.style.display = "none";
    if (userWalletBox) userWalletBox.style.display = "flex";
    if (userTag) userTag.innerText = `USER: ${currentActiveUserAccount}`;
    if (mainDash) mainDash.style.display = "flex";
    if (mainFooter) mainFooter.style.display = "block";
    if (closeBtn) closeBtn.style.display = "block";

    initReferralUI();
    closeAuthModal();
  } else {
    if (authNavBox) authNavBox.style.display = "flex";
    if (userWalletBox) userWalletBox.style.display = "none";
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
  document.getElementById("authStatusMsg").innerText = "";
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
    tabBox.style.display = "flex";
    loginForm.style.display = "block";
    regForm.style.display = "none";
    resetForm.style.display = "none";
    tabLogin.className = "btn btn-primary";
    tabReg.className = "btn btn-secondary";
  } else if (tab === 'register') {
    tabBox.style.display = "flex";
    loginForm.style.display = "none";
    regForm.style.display = "block";
    resetForm.style.display = "none";
    tabLogin.className = "btn btn-secondary";
    tabReg.className = "btn btn-primary";
  } else if (tab === 'reset') {
    tabBox.style.display = "none";
    loginForm.style.display = "none";
    regForm.style.display = "none";
    resetForm.style.display = "block";
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim().toLowerCase();
  const email = document.getElementById("regEmail").value.trim();
  const faucetEmail = document.getElementById("regFaucetEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const statusMsg = document.getElementById("authStatusMsg");

  statusMsg.innerText = "⏳ Creating account...";

  try {
    const sb = getSupabase();
    if (!sb) { statusMsg.innerText = "❌ Supabase loading... try again in 3s."; return; }

    const { data: authData, error: authError } = await sb.auth.signUp({ email, password });
    if (authError) { statusMsg.innerText = `❌ ${authError.message}`; return; }

    const { error: profileError } = await sb.from('profiles').insert([
      { username, vault_balance: 0.0000, email, faucetpay_email: faucetEmail }
    ]);

    if (profileError) { statusMsg.innerText = `❌ Username or email already registered.`; return; }

    currentActiveUserAccount = username;
    currentActiveFaucetEmail = faucetEmail;
    localStorage.setItem("cyberstrike_user", username);
    localStorage.setItem("cyberstrike_faucet_email", faucetEmail);

    playAudioSFX("win");
    initUserSessionUI();
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
    if (!sb) { statusMsg.innerText = "❌ Supabase loading... try again in 3s."; return; }

    const { data: profile, error: fetchError } = await sb
      .from('profiles')
      .select('email, username, vault_balance, faucetpay_email')
      .or(`username.eq.${identifier},email.eq.${identifier}`)
      .single();

    if (fetchError || !profile) {
      statusMsg.innerText = "❌ Username or Email not found!";
      return;
    }

    const { error: loginError } = await sb.auth.signInWithPassword({
      email: profile.email,
      password: password
    });

    if (loginError) {
      statusMsg.innerText = "❌ Invalid password!";
      return;
    }

    currentActiveUserAccount = profile.username;
    currentActiveFaucetEmail = profile.faucetpay_email || "";
    userVaultBalance = parseFloat(profile.vault_balance);

    localStorage.setItem("cyberstrike_user", profile.username);
    localStorage.setItem("cyberstrike_faucet_email", currentActiveFaucetEmail);

    playAudioSFX("win");
    initUserSessionUI();
    updateVaultBalanceUI();
    showCustomAlert(`🔓 Welcome back, ${profile.username}! Vault loaded.`, "LOGIN SUCCESSFUL");

  } catch (err) {
    statusMsg.innerText = "❌ Authentication error.";
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
  userVaultBalance = 0.0;
  initUserSessionUI();
  updateVaultBalanceUI();
  showCustomAlert("🚪 You have logged out.", "LOGGED OUT");
}
function checkDepositReturnStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get("deposit");

  if (status === "success") {
    playAudioSFX("deposit");
    showCustomAlert(
      "🎉 Your payment was submitted to FaucetPay! Your Vault Balance will update in a few seconds.",
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
  refInput.select();
  refInput.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(refInput.value);
  showCustomAlert("📋 Referral link copied to clipboard!", "REFERRAL PROGRAM");
}

function updateVaultBalanceUI() {
  document.getElementById("userBalanceDisplay").innerText = `${userVaultBalance.toFixed(4)} POL`;
  const refEarnedEl = document.getElementById("totalRefEarnedDisplay");
  if (refEarnedEl) refEarnedEl.innerText = `${totalRefEarned.toFixed(4)} POL`;
}

function updateFaucetPayCustom() {
  const amt = document.getElementById("depositAmountInput").value;
  document.getElementById("faucetPayCustomField").value = JSON.stringify({
    account_id: currentActiveUserAccount,
    amount: amt
  });
}

function startLiveBalancePolling() {
  setInterval(async () => {
    if (!currentActiveUserAccount) return;
    const sb = getSupabase();
    if (!sb) return;

    const { data, error } = await sb
      .from("profiles")
      .select("vault_balance")
      .eq("username", currentActiveUserAccount)
      .single();

    if (data && !error) {
      const newServerBalance = parseFloat(data.vault_balance);
      if (newServerBalance !== userVaultBalance) {
        if (newServerBalance > userVaultBalance) playAudioSFX("deposit");
        userVaultBalance = newServerBalance;
        updateVaultBalanceUI();
      }
    }
  }, 5000);
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
    document.getElementById("sprintCountdown").innerText = `${pad(days)}D ${pad(hours)}H ${pad(minutes)}M ${pad(seconds)}S`;
  }
  updateTimer();
  setInterval(updateTimer, 1000);
}

function openDepositModal() {
  playAudioSFX("action");
  document.getElementById("depositModal").classList.add("active");
}

function closeDepositModal() { document.getElementById("depositModal").classList.remove("active"); }

function openWithdrawModal() {
  playAudioSFX("action");
  const emailInput = document.getElementById("withdrawEmailInput");
  if (emailInput && currentActiveFaucetEmail) {
    emailInput.value = currentActiveFaucetEmail;
  }
  document.getElementById("withdrawModal").classList.add("active");
}

function closeWithdrawModal() { document.getElementById("withdrawModal").classList.remove("active"); }

async function executePolWithdrawal() {
  const faucetEmail = document.getElementById("withdrawEmailInput").value.trim();
  const amountInput = parseFloat(document.getElementById("withdrawAmountInput").value);
  const statusEl = document.getElementById("withdrawStatus");
  const MIN_WITHDRAWAL = 2.0;

  if (!faucetEmail || !faucetEmail.includes("@")) {
    statusEl.innerText = "❌ Enter a valid FaucetPay withdrawal email address!";
    return;
  }
  if (!amountInput || amountInput < MIN_WITHDRAWAL) {
    statusEl.innerText = `❌ Min withdrawal is ${MIN_WITHDRAWAL} POL!`;
    return;
  }
  if (amountInput > userVaultBalance) {
    statusEl.innerText = "❌ Insufficient Vault Balance!";
    return;
  }

  statusEl.innerText = "⏳ Processing FaucetPay Payout...";
  document.getElementById("confirmWithdrawBtn").disabled = true;

  try {
    const response = await fetch("https://your-backend-api.com/api/faucetpay-withdraw", {
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
      userVaultBalance -= amountInput;
      updateVaultBalanceUI();
      statusEl.innerText = `✅ Withdrawal Sent Successfully via FaucetPay!`;
      setTimeout(() => {
        closeWithdrawModal();
        document.getElementById("withdrawAmountInput").value = "";
        statusEl.innerText = "";
        document.getElementById("confirmWithdrawBtn").disabled = false;
      }, 2500);
    } else {
      playAudioSFX("lose");
      statusEl.innerText = `❌ Payout Failed: ${result.message || 'Check balance/API limits'}`;
      document.getElementById("confirmWithdrawBtn").disabled = false;
    }
  } catch (err) {
    statusEl.innerText = "❌ Network error connecting to FaucetPay gateway.";
    document.getElementById("confirmWithdrawBtn").disabled = false;
  }
}

function selectStake(btnElement) {
  playAudioSFX("stake");
  document.querySelectorAll(".stake-btn").forEach(b => b.classList.remove("active"));
  btnElement.classList.add("active");
  currentSelectedStake = parseFloat(btnElement.getAttribute("data-stake"));
  
  document.getElementById("summaryTotalPool").innerText = `${(currentSelectedStake * 2).toFixed(2)} POL`;
  document.getElementById("summaryWinnerPayout").innerText = `${(currentSelectedStake * 2 * 0.8).toFixed(2)} POL`;
}

function recordWagerVolume(stakeAmount) {
  weeklyWageredPOL += stakeAmount;
  updateWagerSprintUI();

  const referrer = localStorage.getItem("cyberstrike_referrer");
  if (referrer) {
    const refCommission = stakeAmount * 0.10;
    totalRefEarned += refCommission;
  }
}

function updateWagerSprintUI() {
  const nextMilestone = WAGER_MILESTONES.find(m => weeklyWageredPOL < m.target) || WAGER_MILESTONES[WAGER_MILESTONES.length - 1];
  document.getElementById("weeklyWagerText").innerText = `${weeklyWageredPOL.toFixed(1)} / ${nextMilestone.target} POL WAGORED`;
  const pct = Math.min(100, Math.round((weeklyWageredPOL / nextMilestone.target) * 100));
  document.getElementById("sprintProgressPct").innerText = `${pct}%`;
  document.getElementById("sprintProgressBar").style.width = `${pct}%`;

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
  claimBtn.innerText = "CLAIMED";
  claimBtn.setAttribute("disabled", "true");
  showCustomAlert(`🎉 Claimed +${milestone.reward} POL Milestone Reward!`, "SPRINT REWARD");
      }
  // PENALTY SHOOTOUT ENGINE
let penaltyTurnTimer = null;
let penaltyTimeLeft = 5;
let p1PenaltyShotsTaken = 0;
let p2PenaltyShotsTaken = 0;
let p1PenaltyScore = 0;
let p2PenaltyScore = 0;
let isP1PenaltyTurn = true;
let isPenaltyActive = false;
let isPenaltyTraining = false;

function launchPenaltyArena(isTraining = false) {
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
    recordWagerVolume(currentSelectedStake);
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

// LUDO RACE ENGINE
let ludoTurnTimer = null;
let ludoTimeLeft = 5;
let p1TrackPosition = 0;
let p2TrackPosition = 0;
let isLudoP1Turn = true;
let isLudoActive = false;
let isLudoTraining = false;

function launchLudoRace(isTraining = false) {
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
    recordWagerVolume(currentSelectedStake);
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
                                      let isCoinTraining = false;

function launchCoinFlipArena(isTraining = false) {
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
    recordWagerVolume(currentSelectedStake);
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
let rpsTimer = null;
let rpsTimeLeft = 5;
let isRpsActive = false;
let isRpsTraining = false;

function launchRpsArena(isTraining = false) {
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
    recordWagerVolume(currentSelectedStake);
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
