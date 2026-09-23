/* ==========================================
   CYBERSTRIKE — FULL APPLICATION SCRIPT
   ========================================== */

// Replace 'YOUR_PROJECT_REF' with your actual Supabase project reference ID
const BACKEND_URL = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1';

// 1. GLOBAL APPLICATION STATE & PERSISTENCE
let userBalance = parseFloat(localStorage.getItem('CYBERSTRIKE_BALANCE')) || 13.20;
let selectedStake = 0.50;
let sprintWins = parseInt(localStorage.getItem('CYBERSTRIKE_SPRINT_WINS')) || 20; // Matches default HTML visual state
let currentUserEmail = '';
let userHighScore = parseInt(localStorage.getItem('CYBERSTRIKE_HIGHSCORE')) || 0;

// Track claimed milestone states with LocalStorage persistence
const claimedMilestones = JSON.parse(localStorage.getItem('CYBERSTRIKE_CLAIMED_MILESTONES')) || {
  20: false,
  50: false,
  100: false,
  1000: false
};

// 2. INITIALIZATION & WEEKLY RESET SPRINT TIMER
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.protocol === 'file:' && !localStorage.getItem('CYBERSTRIKE_BALANCE')) {
    userBalance = 13.20;
  }
  
  updateBalanceDisplay();
  initSprintCountdown();
  updateSprintProgress();
  setupDepositListener();
});

// Calculate and run Weekly Reset countdown toward upcoming Tuesday 00:00 UTC
function initSprintCountdown() {
  function getNextTuesday() {
    const now = new Date();
    const result = new Date(now);
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue...
    let daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
    
    if (daysUntilTuesday === 0) {
      daysUntilTuesday = 7;
    }
    
    result.setDate(now.getDate() + daysUntilTuesday);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  let savedTarget = localStorage.getItem('CYBERSTRIKE_NEXT_RESET');
  let targetDate = savedTarget ? new Date(savedTarget) : getNextTuesday();

  if (new Date() >= targetDate) {
    resetWeeklySprint();
    targetDate = getNextTuesday();
    localStorage.setItem('CYBERSTRIKE_NEXT_RESET', targetDate.toISOString());
  } else if (!savedTarget) {
    localStorage.setItem('CYBERSTRIKE_NEXT_RESET', targetDate.toISOString());
  }

  setInterval(() => {
    const now = new Date();
    let diff = targetDate - now;

    if (diff <= 0) {
      resetWeeklySprint();
      targetDate = getNextTuesday();
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

function resetWeeklySprint() {
  sprintWins = 0;
  for (let key in claimedMilestones) {
    claimedMilestones[key] = false;
  }
  localStorage.setItem('CYBERSTRIKE_SPRINT_WINS', 0);
  localStorage.setItem('CYBERSTRIKE_CLAIMED_MILESTONES', JSON.stringify(claimedMilestones));
  updateSprintProgress();
  showCyberAlert("WEEKLY RESET EXECUTED", "The 7-Day Victory Sprint has reset! All milestone rewards are ready to be earned again.", "fa-rotate text-cyan-400");
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

// 3. AUTHENTICATION & EMAIL SYNC
function handleLogin() {
  const loginEmailInput = document.getElementById('loginEmail');
  const emailValue = loginEmailInput ? loginEmailInput.value.trim() : '';

  if (!emailValue) {
    const authMsg = document.getElementById('authMessage');
    if (authMsg) {
      authMsg.innerText = 'Please enter a valid email / FaucetPay account.';
      authMsg.classList.remove('hidden');
    }
    return;
  }

  currentUserEmail = emailValue;

  const withdrawEmailInput = document.getElementById('withdrawEmailInput');
  if (withdrawEmailInput) {
    withdrawEmailInput.value = currentUserEmail;
  }

  const depositUserId = document.getElementById('depositUserId');
  if (depositUserId) {
    depositUserId.value = currentUserEmail;
  }

  document.getElementById('authGate').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
  updateBalanceDisplay();
}

function logout() {
  currentUserEmail = '';
  if (document.getElementById('loginEmail')) document.getElementById('loginEmail').value = '';
  if (document.getElementById('loginPassword')) document.getElementById('loginPassword').value = '';
  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('authGate').classList.remove('hidden');
}

// 4. MODALS & SYSTEM ALERTS
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modalId === 'withdrawModal') {
    const withdrawEmailInput = document.getElementById('withdrawEmailInput');
    if (withdrawEmailInput) withdrawEmailInput.value = currentUserEmail;
    
    const withdrawBalDisplay = document.getElementById('withdrawBalanceDisplay');
    if (withdrawBalDisplay) withdrawBalDisplay.innerText = `${userBalance.toFixed(2)} USDT`;
  }
  if (modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

function showCyberAlert(title, message, iconClass = 'fa-triangle-exclamation text-amber-400') {
  document.getElementById('cyberAlertTitle').innerText = title;
  document.getElementById('cyberAlertMessage').innerText = message;
  document.getElementById('cyberAlertIcon').className = `fa-solid ${iconClass}`;
  openModal('cyberAlertModal');
}

// 5. BALANCE & STAKE SELECTION
function updateBalanceDisplay() {
  localStorage.setItem('CYBERSTRIKE_BALANCE', userBalance.toFixed(2));
  const userBalElements = document.querySelectorAll('#userBalanceDisplay, #withdrawBalanceDisplay');
  userBalElements.forEach(el => el.innerText = userBalance.toFixed(2));
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

// 6. MATCHMAKING & ARENA TRIGGER
function startMatchmaking() {
  if (userBalance < selectedStake) {
    showCyberAlert("INSUFFICIENT BALANCE", `You need $${selectedStake.toFixed(2)} USDT to enter this match.`, "fa-wallet text-amber-400");
    return;
  }

  userBalance -= selectedStake;
  updateBalanceDisplay();

  const canvasOverlay = document.getElementById('canvasOverlay');
  if (canvasOverlay) canvasOverlay.classList.add('hidden');
  
  initGameCanvas();
}

/* ==========================================
   CYBERSTRIKE — 1v1 PENALTY SHOOTOUT ENGINE
   ========================================== */

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

// 7. MATCH FINISH & SUPABASE EDGE FUNCTION SYNC
async function finish1v1Match() {
  gameState.active = false;
  gameState.matchEnded = true;

  const totalPot = selectedStake * 2 * 0.80;
  let modalTitle = "";
  let modalMsg = "";
  let iconClass = "";
  let matchWinner = "draw";

  if (gameState.playerScore > gameState.opponentScore) {
    userBalance += totalPot;
    sprintWins++;
    localStorage.setItem('CYBERSTRIKE_SPRINT_WINS', sprintWins);

    modalTitle = "🏆 1v1 MATCH VICTORY!";
    modalMsg = `You scored ${gameState.playerScore} PTS vs Opponent's ${gameState.opponentScore} PTS. You won $${totalPot.toFixed(2)} USDT!`;
    iconClass = "fa-trophy text-amber-400";
    matchWinner = currentUserEmail || "player";

    if (gameState.playerScore > userHighScore) {
      userHighScore = gameState.playerScore;
      localStorage.setItem('CYBERSTRIKE_HIGHSCORE', userHighScore);
    }
  } else if (gameState.playerScore === gameState.opponentScore) {
    userBalance += selectedStake;
    modalTitle = "⚖️ MATCH DRAW!";
    modalMsg = `Both players scored ${gameState.playerScore} PTS. Stake refunded.`;
    iconClass = "fa-handshake text-cyan-400";
    matchWinner = "draw";
  } else {
    modalTitle = "❌ MATCH DEFEATED";
    modalMsg = `You scored ${gameState.playerScore} PTS vs Opponent's ${gameState.opponentScore} PTS. Better luck next time!`;
    iconClass = "fa-circle-xmark text-rose-500";
    matchWinner = "opponent";
  }

  updateBalanceDisplay();
  updateSprintProgress();

  // Automatically log match result to Supabase Edge Function (/match)
  try {
    await fetch(`${BACKEND_URL}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player: currentUserEmail || 'Guest',
        opponent: 'Bot_Striker',
        stake: selectedStake,
        winner: matchWinner
      })
    });
  } catch (err) {
    console.error('Failed to log match to database:', err);
  }

  showCyberAlert(modalTitle, modalMsg, iconClass);

  setTimeout(() => {
    const canvasOverlay = document.getElementById('canvasOverlay');
    if (canvasOverlay) canvasOverlay.classList.remove('hidden');
  }, 1500);
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

// 8. VICTORY SPRINT REWARDS TRACKER
function updateSprintProgress() {
  const sprintWinsElem = document.getElementById('sprintWinsCount');
  if (sprintWinsElem) sprintWinsElem.innerText = sprintWins;

  const progressPercent = Math.min((sprintWins / 1000) * 100, 100);
  const progressBar = document.getElementById('sprintProgressBar');
  if (progressBar) progressBar.style.width = `${progressPercent}%`;

  // Dynamically update next reward label based on sprint wins
  const nextRewardLabel = document.getElementById('nextRewardLabel');
  if (nextRewardLabel) {
    if (sprintWins < 20) nextRewardLabel.innerText = "NEXT REWARD: 2.00 USDT";
    else if (sprintWins < 50) nextRewardLabel.innerText = "NEXT REWARD: 5.00 USDT";
    else if (sprintWins < 100) nextRewardLabel.innerText = "NEXT REWARD: 10.00 USDT";
    else if (sprintWins < 1000) nextRewardLabel.innerText = "NEXT REWARD: 100.00 USDT";
    else nextRewardLabel.innerText = "ALL MILESTONES COMPLETED!";
  }

  const milestones = [
    { wins: 20, btnId: 'claim20Btn', reward: 2.00 },
    { wins: 50, btnId: 'claim50Btn', reward: 5.00 },
    { wins: 100, btnId: 'claim100Btn', reward: 10.00 },
    { wins: 1000, btnId: 'claim1000Btn', reward: 100.00 }
  ];

  milestones.forEach(({ wins, btnId }) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (claimedMilestones[wins]) {
      btn.disabled = true;
      btn.className = "sprint-claim-btn claimed-glowing";
      btn.innerText = "CLAIMED";
    } else if (sprintWins >= wins) {
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

function claimMilestone(event, targetWins, rewardAmount) {
  if (sprintWins < targetWins) {
    showCyberAlert("MILESTONE LOCKED", `You need ${targetWins} wins to unlock this reward.`, "fa-lock text-amber-400");
    return;
  }

  if (claimedMilestones[targetWins]) {
    showCyberAlert("ALREADY CLAIMED", "You have already claimed this milestone reward.", "fa-circle-check text-cyan-400");
    return;
  }

  userBalance += rewardAmount;
  claimedMilestones[targetWins] = true;

  localStorage.setItem('CYBERSTRIKE_CLAIMED_MILESTONES', JSON.stringify(claimedMilestones));

  updateBalanceDisplay();
  updateSprintProgress();

  showCyberAlert("REWARD CLAIMED", `Successfully claimed $${rewardAmount.toFixed(2)} USDT to your balance!`, "fa-gift text-emerald-400");
}

// 9. FAUCETPAY CASHOUT & SUPABASE EDGE FUNCTION DISPATCH
async function confirmWithdrawal() {
  const email = currentUserEmail;
  const amountInput = document.getElementById('withdrawAmountInput');
  const amount = parseFloat(amountInput ? amountInput.value : 0);

  if (!email) {
    showCyberAlert("MISSING EMAIL", "Please log in with your FaucetPay account email.");
    return;
  }

  if (!amount || amount < 0.50) {
    showCyberAlert("INVALID CASHOUT", "Minimum withdrawal threshold is $0.50 USDT.");
    return;
  }

  if (amount > userBalance) {
    showCyberAlert("INSUFFICIENT BALANCE", "You cannot withdraw more than your available wallet balance.");
    return;
  }

  try {
    showCyberAlert("PROCESSING", "Dispatching payout request to FaucetPay API...", "fa-spinner fa-spin text-cyan-400");

    const response = await fetch(`${BACKEND_URL}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientUser: email,
        amount: amount,
        currency: 'USDT'
      })
    });

    const result = await response.json();

    if (result.success) {
      userBalance -= amount;
      updateBalanceDisplay();
      closeModal('withdrawModal');
      showCyberAlert("CASHOUT SUCCESSFUL", `Payout of $${amount.toFixed(2)} USDT dispatched via FaucetPay API to ${email}.`, "fa-circle-check text-emerald-400");
    } else {
      showCyberAlert("PAYOUT FAILED", result.error || "FaucetPay rejected the payout request.", "fa-triangle-exclamation text-rose-500");
    }
  } catch (err) {
    console.error(err);
    showCyberAlert("CONNECTION ERROR", "Could not reach the Supabase backend edge function to process payout.", "fa-triangle-exclamation text-rose-500");
  }
}

function confirmDeposit() {
  showCyberAlert("REDIRECTING TO FAUCETPAY", "Opening secure FaucetPay Merchant API payment gateway...", "fa-shield-halved text-cyan-400");
  setTimeout(() => {
    closeModal('depositModal');
    // Programmatically submit the deposit form to FaucetPay after alert display
    const depositForm = document.querySelector('#depositModal form');
    if (depositForm) {
      depositForm.submit();
    }
  }, 1200);
}
