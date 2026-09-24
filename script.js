/* ==========================================================================
   CYBERSTRIKE — PRODUCTION APPLICATION SCRIPT
   ========================================================================== */

// 1. SUPABASE CLIENT INITIALIZATION
// Replace with your actual Supabase Project URL and Anon API Key
const SUPABASE_URL = 'https://btugwhcoypxtlgmsxqci.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__DjyCoKhrV9vpmAUY-T3lg_0f-Ji2-h';
// ✅ CORRECT: Renamed variable to 'supabaseClient'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. GLOBAL APPLICATION STATE
let currentUser = null;
let userProfile = {
  balance: 0.00,
  sprint_wins: 0,
  claimed_milestones: { 20: false, 50: false, 100: false, 1000: false }
};
let selectedStake = 0.50;

// 1v1 Game State
let gameState = {
  active: false,
  playerScore: 0,
  opponentScore: 0,
  timeLeft: 15,
  timerInterval: null,
  oppInterval: null,
  targetZone: 1,
  keeperPos: 1,
  ballX: 0,
  ballY: 0,
  ballTargetX: 0,
  ballTargetY: 0,
  isKicking: false,
  statusMessage: "1v1 MATCH STARTED! STRIKE FAST!",
  matchEnded: false
};

// 3. APPLICATION INITIALIZATION & AUTH OBSERVER
document.addEventListener('DOMContentLoaded', () => {
  initSprintCountdown();
  setupDepositListener();

  // Listen for Supabase Authentication State Changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentUser = session.user;
      await fetchUserProfile();
      
      const authGate = document.getElementById('authGate');
      const appContainer = document.getElementById('appContainer');
      if (authGate) authGate.classList.add('hidden');
      if (appContainer) appContainer.classList.remove('hidden');
    } else {
      currentUser = null;
      userProfile = { balance: 0.00, sprint_wins: 0, claimed_milestones: { 20: false, 50: false, 100: false, 1000: false } };
      
      const authGate = document.getElementById('authGate');
      const appContainer = document.getElementById('appContainer');
      if (appContainer) appContainer.classList.add('hidden');
      if (authGate) authGate.classList.remove('hidden');
    }
  });
});

// Fetch authoritative profile state from Supabase PostgreSQL
async function fetchUserProfile() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('balance, sprint_wins, claimed_milestones')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    console.error('Error fetching profile state:', error);
    return;
  }

  if (data) {
    userProfile.balance = parseFloat(data.balance) || 0.00;
    userProfile.sprint_wins = parseInt(data.sprint_wins) || 0;
    userProfile.claimed_milestones = data.claimed_milestones || { 20: false, 50: false, 100: false, 1000: false };

    updateBalanceDisplay();
    updateSprintProgress();
  }
}

// 4. MONDAY 00:00:00 SPRINT COUNTDOWN & RESET ENGINE
function initSprintCountdown() {
  function getNextMondayReset() {
    const now = new Date();
    const target = new Date(now);
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed...

    let daysUntilMonday = (1 - dayOfWeek + 7) % 7;

    // If today is Monday and midnight has passed, target next Monday
    if (daysUntilMonday === 0) {
      daysUntilMonday = 7;
    }

    target.setDate(now.getDate() + daysUntilMonday);
    target.setHours(0, 0, 0, 0); // 00:00:00 Monday Midnight
    return target;
  }

  let savedTarget = localStorage.getItem('CYBERSTRIKE_NEXT_RESET');
  let targetDate = savedTarget ? new Date(savedTarget) : getNextMondayReset();

  // Trigger reset if current time has passed target reset date
  if (new Date() >= targetDate) {
    resetWeeklySprint();
    targetDate = getNextMondayReset();
    localStorage.setItem('CYBERSTRIKE_NEXT_RESET', targetDate.toISOString());
  } else if (!savedTarget) {
    localStorage.setItem('CYBERSTRIKE_NEXT_RESET', targetDate.toISOString());
  }

  setInterval(() => {
    const now = new Date();
    let diff = targetDate - now;

    if (diff <= 0) {
      resetWeeklySprint();
      targetDate = getNextMondayReset();
      localStorage.setItem('CYBERSTRIKE_NEXT_RESET', targetDate.toISOString());
      diff = targetDate - now;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    const countdownElement = document.getElementById('sprintCountdown');
    if (countdownElement) {
      countdownElement.innerText = `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }
  }, 1000);
}

async function resetWeeklySprint() {
  userProfile.sprint_wins = 0;
  userProfile.claimed_milestones = { 20: false, 50: false, 100: false, 1000: false };

  if (currentUser) {
    await supabase
      .from('profiles')
      .update({ 
        sprint_wins: 0, 
        claimed_milestones: userProfile.claimed_milestones 
      })
      .eq('id', currentUser.id);
  }

  updateSprintProgress();
  showCyberAlert(
    "MONDAY SPRINT RESET", 
    "A new 7-Day Victory Sprint has officially started! Earn wins this week to unlock milestone rewards!", 
    "fa-rotate text-cyan-400"
  );
}
// 5. AUTHENTICATION (SUPABASE AUTH INTEGRATION)
async function handleLogin() {
  const loginEmailInput = document.getElementById('loginEmail');
  const loginPasswordInput = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginButton');
  
  const email = loginEmailInput ? loginEmailInput.value.trim() : '';
  const password = loginPasswordInput ? loginPasswordInput.value.trim() : '';

  if (!email || !password) {
    alert('Please enter both email and password.');
    return;
  }

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerText = "CONNECTING...";
  }

  try {
    // Note: using 'supabaseClient' here
    let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error && (error.message.includes("Invalid login credentials") || error.status === 400)) {
      const signUpResult = await supabaseClient.auth.signUp({ email, password });
      error = signUpResult.error;
    }

    if (error) {
      alert("Auth Failure: " + error.message);
    } else {
      alert("Success! Logged in.");
    }
  } catch (err) {
    alert("Connection Error: " + err.message);
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerText = "LOGIN / ENTER ARENA";
    }
  }
}




// 6. MODALS & ALERTS
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modalId === 'withdrawModal') {
    const withdrawEmailInput = document.getElementById('withdrawEmailInput');
    if (withdrawEmailInput && currentUser) withdrawEmailInput.value = currentUser.email;
    
    const withdrawBalDisplay = document.getElementById('withdrawBalanceDisplay');
    if (withdrawBalDisplay) withdrawBalDisplay.innerText = `${userProfile.balance.toFixed(2)} USDT`;
  }
  if (modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

function showCyberAlert(title, message, iconClass = 'fa-triangle-exclamation text-amber-400') {
  const titleElem = document.getElementById('cyberAlertTitle');
  const msgElem = document.getElementById('cyberAlertMessage');
  const iconElem = document.getElementById('cyberAlertIcon');

  if (titleElem) titleElem.innerText = title;
  if (msgElem) msgElem.innerText = message;
  if (iconElem) iconElem.className = `fa-solid ${iconClass}`;
  openModal('cyberAlertModal');
}

// 7. BALANCE & STAKE SELECTION
function updateBalanceDisplay() {
  const userBalElements = document.querySelectorAll('#userBalanceDisplay, #withdrawBalanceDisplay');
  userBalElements.forEach(el => el.innerText = userProfile.balance.toFixed(2));
}

function selectStakeTier(stake) {
  selectedStake = stake;
  const potentialWin = (stake * 2 * 0.80).toFixed(2);
  
  const entryDisplay = document.getElementById('matchOverviewStake');
  if (entryDisplay) {
    entryDisplay.innerHTML = `Entry Stake: <strong class="text-cyan-400">$${stake.toFixed(2)} USDT</strong>`;
  }

  const matchOverlayDesc = document.getElementById('matchOverlayDesc');
  if (matchOverlayDesc) {
    matchOverlayDesc.innerHTML = `Entry Stake: <strong class="text-cyan-400">$${stake.toFixed(2)} USDT</strong>. Winner takes <strong class="text-emerald-400">$${potentialWin} USDT</strong> (20% rake).`;
  }

  document.querySelectorAll('.stake-tier-btn').forEach(btn => {
    btn.className = "stake-tier-btn bg-slate-800 border border-slate-700 hover:border-cyan-500 text-white font-bold py-2 px-3 rounded text-sm transition-all";
  });

  const activeBtn = document.getElementById(`stake-tier-${stake.toFixed(2)}`);
  if (activeBtn) {
    activeBtn.className = "stake-tier-btn bg-cyan-500 text-slate-950 font-bold py-2 px-3 rounded text-sm shadow-glow transition-all";
  }
}

// 8. SERVER-DEDUCTED MATCHMAKING
async function startMatchmaking() {
  if (userProfile.balance < selectedStake) {
    showCyberAlert("INSUFFICIENT BALANCE", `You need $${selectedStake.toFixed(2)} USDT to enter this match.`, "fa-wallet text-amber-400");
    return;
  }

  try {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      showCyberAlert("AUTH ERROR", "Please log in again.");
      return;
    }

    // Server-side deduction check via Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ action: 'START', stake: selectedStake })
    });

    const result = await response.json();

    if (!result.success) {
      showCyberAlert("ENTRY REFUSED", result.error || "Insufficient funds.");
      return;
    }

    // Refresh client profile state from server
    await fetchUserProfile();

    const canvasOverlay = document.getElementById('canvasOverlay');
    if (canvasOverlay) canvasOverlay.classList.add('hidden');

    initGameCanvas();

  } catch (err) {
    showCyberAlert("CONNECTION ERROR", "Could not verify match entry with server.");
  }
}

// 9. GAME ENGINE & CANVAS RENDERING
function initGameCanvas() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  gameState.active = true;
  gameState.playerScore = 0;
  gameState.opponentScore = 0;
  gameState.timeLeft = 15;
  gameState.isKicking = false;
  gameState.statusMessage = "TAP TARGET ZONE TO SHOOT!";
  gameState.matchEnded = false;
  gameState.ballX = canvas.width / 2;
  gameState.ballY = 580;

  if (gameState.timerInterval) clearInterval(gameState.timerInterval);
  if (gameState.oppInterval) clearInterval(gameState.oppInterval);

  gameState.timerInterval = setInterval(() => {
    if (!gameState.active) return;
    gameState.timeLeft--;

    if (gameState.timeLeft <= 0) {
      gameState.timeLeft = 0;
      clearInterval(gameState.timerInterval);
      clearInterval(gameState.oppInterval);
      finish1v1Match();
    }
  }, 1000);

  gameState.oppInterval = setInterval(() => {
    if (!gameState.active) return;
    if (Math.random() < 0.65) {
      gameState.opponentScore += 100;
    }
  }, 1800);

  canvas.onclick = (e) => {
    if (gameState.isKicking || !gameState.active) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const normX = clickX / rect.width;

    if (normX < 0.33) {
      gameState.targetZone = 0;
    } else if (normX > 0.66) {
      gameState.targetZone = 2;
    } else {
      gameState.targetZone = 1;
    }

    executeKick();
  };

  requestAnimationFrame(() => gameLoop(canvas, ctx));
}

function executeKick() {
  gameState.isKicking = true;
  gameState.statusMessage = "STRIKING...";

  const targetX = [320, 600, 880];
  gameState.ballTargetX = targetX[gameState.targetZone];
  gameState.ballTargetY = 240;
  gameState.keeperPos = Math.floor(Math.random() * 3);

  let progress = 0;
  const startX = 600;
  const startY = 580;

  const animInterval = setInterval(() => {
    progress += 0.12;
    gameState.ballX = startX + (gameState.ballTargetX - startX) * progress;
    gameState.ballY = startY + (gameState.ballTargetY - startY) * progress;

    if (progress >= 1) {
      clearInterval(animInterval);
      evaluateShot();
    }
  }, 16);
}

function evaluateShot() {
  if (gameState.keeperPos === gameState.targetZone) {
    gameState.statusMessage = "SAVED BY KEEPER!";
  } else {
    gameState.playerScore += 100;
    gameState.statusMessage = "GOAL! +100 PTS";
  }

  setTimeout(() => {
    if (gameState.timeLeft > 0 && gameState.active) {
      gameState.ballX = 600;
      gameState.ballY = 580;
      gameState.isKicking = false;
      gameState.statusMessage = "TAP TARGET ZONE TO SHOOT!";
    }
  }, 350);
}

function gameLoop(canvas, ctx) {
  if (!gameState.active && !gameState.matchEnded) return;

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#0e749022';
  ctx.lineWidth = 2;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 450);
  ctx.lineTo(canvas.width, 450);
  ctx.stroke();

  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 6;
  ctx.strokeRect(240, 140, 720, 260);

  const keeperX = [320, 600, 880][gameState.keeperPos];
  ctx.fillStyle = '#020617';
  ctx.fillRect(keeperX - 40, 280, 80, 120);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(keeperX - 25, 300, 50, 90);

  const targets = [320, 600, 880];
  targets.forEach((tx, idx) => {
    ctx.beginPath();
    ctx.arc(tx, 260, 25, 0, Math.PI * 2);
    if (gameState.targetZone === idx) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 2;
    }
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.arc(gameState.ballX, gameState.ballY, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#38bdf8';
  ctx.fill();

  ctx.font = 'bold 22px Orbitron, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.fillText(gameState.statusMessage, canvas.width / 2, 80);

  ctx.font = '16px Rajdhani, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`TIME: ${gameState.timeLeft}s  |  YOU: ${gameState.playerScore}  |  OPP: ${gameState.opponentScore}`, canvas.width / 2, 115);

  if (gameState.active || gameState.isKicking) {
    requestAnimationFrame(() => gameLoop(canvas, ctx));
  }
}

// 10. SERVER-VALIDATED MATCH RESOLUTION
async function finish1v1Match() {
  gameState.active = false;
  gameState.matchEnded = true;

  try {
    const session = (await supabase.auth.getSession()).data.session;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        action: 'RESOLVE',
        stake: selectedStake,
        playerScore: gameState.playerScore,
        opponentScore: gameState.opponentScore
      })
    });

    const result = await response.json();
    await fetchUserProfile(); // Fetch server-validated state updates

    if (result.outcome === 'win') {
      const reward = selectedStake * 2 * 0.80;
      showCyberAlert("🏆 VICTORY!", `You scored ${gameState.playerScore} PTS vs Opponent's ${gameState.opponentScore} PTS. Server credited $${reward.toFixed(2)} USDT!`, "fa-trophy text-amber-400");
    } else if (result.outcome === 'draw') {
      showCyberAlert("⚖️ MATCH DRAW!", `Tie game (${gameState.playerScore} PTS). Stake refunded by server.`, "fa-handshake text-cyan-400");
    } else {
      showCyberAlert("❌ MATCH DEFEATED", `You scored ${gameState.playerScore} PTS vs Opponent's ${gameState.opponentScore} PTS. Better luck next time!`, "fa-circle-xmark text-rose-500");
    }

  } catch (err) {
    showCyberAlert("SYNC ERROR", "Match concluded, but backend state synchronization failed.");
  }

  setTimeout(() => {
    const canvasOverlay = document.getElementById('canvasOverlay');
    if (canvasOverlay) canvasOverlay.classList.remove('hidden');
  }, 1500);
}

// 11. SPRINT MILESTONE SYSTEM
function updateSprintProgress() {
  const winsElem = document.getElementById('sprintWinsCount');
  if (winsElem) winsElem.innerText = userProfile.sprint_wins;

  const progressPercent = Math.min((userProfile.sprint_wins / 1000) * 100, 100);
  const progressBar = document.getElementById('sprintProgressBar');
  if (progressBar) progressBar.style.width = `${progressPercent}%`;

  const nextRewardLabel = document.getElementById('nextRewardLabel');
  if (nextRewardLabel) {
    if (userProfile.sprint_wins < 20) nextRewardLabel.innerText = "NEXT REWARD: 2.00 USDT";
    else if (userProfile.sprint_wins < 50) nextRewardLabel.innerText = "NEXT REWARD: 5.00 USDT";
    else if (userProfile.sprint_wins < 100) nextRewardLabel.innerText = "NEXT REWARD: 10.00 USDT";
    else if (userProfile.sprint_wins < 1000) nextRewardLabel.innerText = "NEXT REWARD: 100.00 USDT";
    else nextRewardLabel.innerText = "ALL MILESTONES COMPLETED!";
  }

  const milestones = [
    { wins: 20, btnId: 'claim20Btn' },
    { wins: 50, btnId: 'claim50Btn' },
    { wins: 100, btnId: 'claim100Btn' },
    { wins: 1000, btnId: 'claim1000Btn' }
  ];

  milestones.forEach(({ wins, btnId }) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (userProfile.claimed_milestones[wins]) {
      btn.disabled = true;
      btn.className = "sprint-claim-btn claimed-glowing";
      btn.innerText = "CLAIMED";
    } else if (userProfile.sprint_wins >= wins) {
      btn.disabled = false;
      btn.className = "sprint-claim-btn ready";
      btn.innerText = "CLAIM";
    } else {
      btn.disabled = true;
      btn.className = "sprint-claim-btn locked";
      btn.innerText = "LOCKED";
    }
  });
}

async function claimMilestone(event, targetWins, rewardAmount) {
  if (userProfile.sprint_wins < targetWins) {
    showCyberAlert("MILESTONE LOCKED", `You need ${targetWins} sprint wins to unlock this reward.`, "fa-lock text-amber-400");
    return;
  }

  if (userProfile.claimed_milestones[targetWins]) {
    showCyberAlert("ALREADY CLAIMED", "You have already claimed this milestone reward.", "fa-circle-check text-cyan-400");
    return;
  }

  // Update milestone claim state in Database
  const updatedMilestones = { ...userProfile.claimed_milestones, [targetWins]: true };
  const newBalance = userProfile.balance + rewardAmount;

  const { error } = await supabase
    .from('profiles')
    .update({ 
      balance: newBalance, 
      claimed_milestones: updatedMilestones 
    })
    .eq('id', currentUser.id);

  if (error) {
    showCyberAlert("CLAIM ERROR", "Could not process reward claim on database.");
    return;
  }

  await fetchUserProfile();
  showCyberAlert("REWARD CLAIMED", `Successfully claimed $${rewardAmount.toFixed(2)} USDT to your wallet balance!`, "fa-gift text-emerald-400");
}

// 12. CASHOUT & DEPOSIT INTEGRATION
async function confirmWithdrawal() {
  const amountInput = document.getElementById('withdrawAmountInput');
  const withdrawEmailInput = document.getElementById('withdrawEmailInput');

  const amount = parseFloat(amountInput ? amountInput.value : 0);
  const recipientEmail = withdrawEmailInput ? withdrawEmailInput.value.trim() : '';

  if (!recipientEmail) {
    showCyberAlert("MISSING EMAIL", "Please specify a FaucetPay account email address.");
    return;
  }

  if (!amount || amount < 0.50) {
    showCyberAlert("INVALID CASHOUT", "Minimum withdrawal threshold is $0.50 USDT.");
    return;
  }

  if (amount > userProfile.balance) {
    showCyberAlert("INSUFFICIENT BALANCE", "You cannot withdraw more than your current wallet balance.");
    return;
  }

  try {
    showCyberAlert("PROCESSING", "Dispatching payout request to FaucetPay API...", "fa-spinner fa-spin text-cyan-400");
    const session = (await supabase.auth.getSession()).data.session;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ amount, recipientEmail })
    });

    const result = await response.json();

    if (result.success) {
      await fetchUserProfile();
      closeModal('withdrawModal');
      showCyberAlert("CASHOUT SUCCESSFUL", `Payout of $${amount.toFixed(2)} USDT dispatched via FaucetPay API.`, "fa-circle-check text-emerald-400");
    } else {
      showCyberAlert("PAYOUT FAILED", result.error || "Payout request rejected by FaucetPay.", "fa-triangle-exclamation text-rose-500");
    }
  } catch (err) {
    showCyberAlert("CONNECTION ERROR", "Could not connect to backend server payout endpoint.");
  }
}

function setupDepositListener() {
  const depositInput = document.getElementById('depositAmount');
  if (depositInput) {
    depositInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      const display = document.getElementById('depositAmountDisplay');
      if (display) {
        display.innerText = `${val.toFixed(2)} USDT`;
      }
    });
  }
}

function confirmDeposit() {
  showCyberAlert("REDIRECTING TO FAUCETPAY", "Opening secure FaucetPay Merchant payment gateway...", "fa-shield-halved text-cyan-400");
  setTimeout(() => {
    closeModal('depositModal');
    const depositForm = document.querySelector('#depositModal form');
    if (depositForm) {
      depositForm.submit();
    }
  }, 1200);
}
