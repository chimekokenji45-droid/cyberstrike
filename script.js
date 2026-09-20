/* ==========================================================================
   CYBERSTRIKE | 1v1 Arena Core Script (Penalty Shootout Only)
   ========================================================================== */

// --- 1. SUPABASE INITIALIZATION ---
const SUPABASE_URL = "https://btugwhcoypxtlgmsxqci.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__DjyCoKhrV9vpmAUY-T3lg_0f-Ji2-h";

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL.indexOf("your-supabase") === -1) {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// --- 2. GLOBAL STATE ---
const state = {
  user: null,
  balance: 0.00, // Default starting balance strictly at 0.00 USDT
  wins: 0,
  currentStake: 0.50,
  isMatchmaking: false,
  isPlaying: false,
  claimedMilestones: [],
  sprintEndTime: Date.now() + (5 * 24 * 60 * 60 * 1000) + (18 * 60 * 60 * 1000)
};

// Stake configurations with 20% rake deduction calculated
const STAKE_CONFIGS = {
  0.50: { stake: 0.50, payout: 0.80 },
  1.00: { stake: 1.00, payout: 1.60 },
  5.00: { stake: 5.00, payout: 8.00 }
};

// Canvas Engine References
let canvas, ctx;
let animationFrameId = null;
let gameObject = null;

// --- 3. INITIALIZATION & EVENT LISTENERS ---
document.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("gameCanvas");
  if (canvas) {
    ctx = canvas.getContext("2d");
    // Canvas Click Listener
    canvas.addEventListener("click", handleCanvasClick);
    // Render Initial Canvas Standby
    drawCanvasStandby();
  }

  // Setup Deposit Amount Input Listener
  const depositInput = document.getElementById("depositAmount");
  if (depositInput) {
    depositInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value) || 0;
      document.getElementById("depositAmountDisplay").innerText = `${val.toFixed(2)} USDT`;
    });
  }

  // Setup Sprint Countdown
  startSprintTimer();
});

// --- 4. AUTHENTICATION HANDLERS ---
async function handleLogin() {
  const emailInput = document.getElementById("loginEmail").value.trim();
  const passwordInput = document.getElementById("loginPassword").value;
  const authMsg = document.getElementById("authMessage");
  const loginBtn = document.getElementById("loginButton");

  if (!emailInput || !passwordInput) {
    showAuthError("Please fill in all required fields.");
    return;
  }

  authMsg.classList.add("hidden");
  loginBtn.innerText = "AUTHENTICATING...";
  loginBtn.disabled = true;

  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput
      });

      if (error) throw error;
      state.user = data.user;

      // Fetch user profile stats
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('balance, wins')
        .eq('id', state.user.id)
        .single();

      if (profile) {
        state.balance = parseFloat(profile.balance) || 0.00;
        state.wins = profile.wins || 0;
      }
    } else {
      await new Promise(res => setTimeout(res, 800));
      state.user = { id: "usr_" + Math.random().toString(36).substr(2, 9), email: emailInput };
      state.balance = 0.00; // Reset fallback balance to 0.00
    }

    document.getElementById("authGate").classList.add("hidden");
    document.getElementById("appContainer").classList.remove("hidden");
    document.getElementById("depositUserId").value = state.user.id;
    document.getElementById("withdrawEmail").value = state.user.email;

    updateUI();
  } catch (err) {
    showAuthError(err.message || "Failed to log in. Check credentials.");
  } font-['Orbitron'] {
    loginBtn.innerText = "LOGIN / ENTER ARENA";
    loginBtn.disabled = false;
  }
}

function showAuthError(message) {
  const authMsg = document.getElementById("authMessage");
  if (!authMsg) return;
  authMsg.innerText = message;
  authMsg.classList.remove("hidden");
}

function logout() {
  state.user = null;
  document.getElementById("appContainer").classList.add("hidden");
  document.getElementById("authGate").classList.remove("hidden");
}

// --- 5. UI & STATE UPDATERS ---
function updateUI() {
  document.getElementById("userBalanceDisplay").innerText = state.balance.toFixed(2);
  document.getElementById("withdrawBalanceDisplay").innerText = `${state.balance.toFixed(2)} USDT`;

  // Stake Selection Buttons
  document.querySelectorAll(".stake-tier-btn").forEach(btn => btn.classList.remove("active"));
  const activeStakeBtn = document.getElementById(`stakeTier-${state.currentStake.toFixed(1)}`);
  if (activeStakeBtn) activeStakeBtn.classList.add("active");

  // Header Stake Display
  const currentConfig = STAKE_CONFIGS[state.currentStake];

  // Overlay Description
  const overlayDesc = document.getElementById("matchOverlayDesc");
  if (overlayDesc) {
    overlayDesc.innerHTML = 
      `Entry Stake: <strong class="text-cyan-400">$${currentConfig.stake.toFixed(2)} USDT</strong>. ` +
      `Winner takes <strong class="text-emerald-400">$${currentConfig.payout.toFixed(2)} USDT</strong> (20% rake).`;
  }

  updateSprintSection();
}

function selectStakeTier(amount) {
  if (state.isPlaying || state.isMatchmaking) return;
  state.currentStake = amount;
  updateUI();
}

// --- 6. MODAL & ALERT CONTROLLERS ---
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

function showCyberAlert(title, message, iconClass = "fa-triangle-exclamation") {
  document.getElementById("cyberAlertTitle").innerText = title;
  document.getElementById("cyberAlertMessage").innerText = message;
  document.getElementById("cyberAlertIcon").className = `fa-solid ${iconClass}`;
  openModal("cyberAlertModal");
}

function confirmWithdrawal() {
  const amount = parseFloat(document.getElementById("withdrawAmount").value);
  if (!amount || amount < 0.50) {
    showCyberAlert("INVALID CASHOUT", "Minimum withdrawal amount is 0.50 USDT.");
    return;
  }
  if (amount > state.balance) {
    showCyberAlert("INSUFFICIENT BALANCE", "You cannot withdraw more than your current balance.");
    return;
  }

  state.balance -= amount;
  updateUI();
  closeModal("withdrawModal");
  showCyberAlert("CASHOUT SUCCESSFUL", `${amount.toFixed(2)} USDT sent to your FaucetPay account!`, "fa-circle-check");
  document.getElementById("withdrawAmount").value = "";
}

// --- 7. MATCHMAKING & ARENA ENGINE ---
function startMatchmaking() {
  if (state.balance < state.currentStake) {
    showCyberAlert(
      "INSUFFICIENT BALANCE",
      `You need at least $${state.currentStake.toFixed(2)} USDT to enter this match.`
    );
    return;
  }

  state.balance -= state.currentStake;
  state.isMatchmaking = true;
  updateUI();

  const overlay = document.getElementById("canvasOverlay");
  overlay.innerHTML = `
    <div class="w-16 h-16 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin flex items-center justify-center"></div>
    <h3 class="font-['Orbitron'] font-bold text-xl text-cyan-400 tracking-wider">SEARCHING OPPONENT...</h3>
    <p class="text-xs text-slate-400">Matching skill rating & stake ($${state.currentStake.toFixed(2)} USDT)</p>
  `;

  setTimeout(() => {
    overlay.innerHTML = `
      <div class="text-emerald-400 text-4xl animate-bounce"><i class="fa-solid fa-check-circle"></i></div>
      <h3 class="font-['Orbitron'] font-bold text-2xl text-slate-100 tracking-wider">OPPONENT FOUND</h3>
      <p class="text-xs text-emerald-400 font-bold uppercase">Preparing Penalty Shootout Arena...</p>
    `;

    setTimeout(() => {
      overlay.classList.add("hidden");
      state.isMatchmaking = false;
      state.isPlaying = true;
      initPenaltyGame();
    }, 1200);
  }, 2000);
}

// --- 8. PENALTY SHOOTOUT GAME LOGIC ---
function initPenaltyGame() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  gameObject = {
    goalKeeperX: canvas.width / 2,
    goalKeeperDir: 1,
    goalKeeperSpeed: 8,
    ballX: canvas.width / 2,
    ballY: canvas.height - 80,
    ballTargetX: canvas.width / 2,
    ballTargetY: 150,
    ballRadius: 18,
    reticleX: canvas.width / 2,
    reticleDir: 1,
    reticleSpeed: 12,
    state: 'aiming'
  };

  runGameLoop();
}

function updatePenaltyGame() {
  if (!gameObject) return;

  // Move Goalkeeper
  gameObject.goalKeeperX += gameObject.goalKeeperSpeed * gameObject.goalKeeperDir;
  if (gameObject.goalKeeperX > canvas.width / 2 + 260 || gameObject.goalKeeperX < canvas.width / 2 - 260) {
    gameObject.goalKeeperDir *= -1;
  }

  if (gameObject.state === 'aiming') {
    gameObject.reticleX += gameObject.reticleSpeed * gameObject.reticleDir;
    if (gameObject.reticleX > canvas.width / 2 + 280 || gameObject.reticleX < canvas.width / 2 - 280) {
      gameObject.reticleDir *= -1;
    }
  } else if (gameObject.state === 'shooting') {
    const dx = gameObject.ballTargetX - gameObject.ballX;
    const dy = gameObject.ballTargetY - gameObject.ballY;
    gameObject.ballX += dx * 0.12;
    gameObject.ballY += dy * 0.12;
    gameObject.ballRadius = Math.max(10, gameObject.ballRadius - 0.25);

    if (Math.abs(gameObject.ballY - gameObject.ballTargetY) < 15) {
      const distToKeeper = Math.abs(gameObject.ballX - gameObject.goalKeeperX);
      if (distToKeeper < 70) {
        finishMatch(false, "SAVED BY GOALKEEPER!");
      } else {
        finishMatch(true, "GOAL! CYBER STRIKE!");
      }
    }
  }
}

function renderPenaltyGame() {
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const goalLeft = canvas.width / 2 - 300;
  const goalRight = canvas.width / 2 + 300;
  const goalTop = 100;
  const goalBottom = 320;

  ctx.strokeStyle = "#06b6d4";
  ctx.lineWidth = 6;
  ctx.strokeRect(goalLeft, goalTop, 600, 220);

  // Net Pattern
  ctx.strokeStyle = "rgba(6, 182, 212, 0.15)";
  ctx.lineWidth = 1;
  for (let x = goalLeft; x <= goalRight; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, goalTop);
    ctx.lineTo(x, goalBottom);
    ctx.stroke();
  }
  for (let y = goalTop; y <= goalBottom; y += 20) {
    ctx.beginPath();
    ctx.moveTo(goalLeft, y);
    ctx.lineTo(goalRight, y);
    ctx.stroke();
  }

  // Goalkeeper
  ctx.fillStyle = "#f43f5e";
  ctx.shadowColor = "#f43f5e";
  ctx.shadowBlur = 15;
  ctx.fillRect(gameObject.goalKeeperX - 35, goalBottom - 70, 70, 70);
  ctx.shadowBlur = 0;

  // Aiming Reticle
  if (gameObject.state === 'aiming') {
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gameObject.reticleX, gameObject.ballTargetY, 24, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(gameObject.reticleX, gameObject.ballTargetY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 18px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText("CLICK CANVAS TO STRIKE", canvas.width / 2, canvas.height - 20);
  }

  // Ball
  ctx.fillStyle = "#38bdf8";
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(gameObject.ballX, gameObject.ballY, gameObject.ballRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function runGameLoop() {
  if (!state.isPlaying) return;

  updatePenaltyGame();
  renderPenaltyGame();

  animationFrameId = requestAnimationFrame(runGameLoop);
}

function handleCanvasClick() {
  if (!state.isPlaying || !gameObject) return;

  if (gameObject.state === 'aiming') {
    gameObject.ballTargetX = gameObject.reticleX;
    gameObject.state = 'shooting';
  }
}

function finishMatch(isWin, resultMsg) {
  state.isPlaying = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  const payout = STAKE_CONFIGS[state.currentStake].payout;

  if (isWin) {
    state.balance += payout;
    state.wins += 1;
  }

  updateUI();

  const overlay = document.getElementById("canvasOverlay");
  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <div class="w-16 h-16 rounded-2xl ${isWin ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-rose-500/10 border-rose-500/40 text-rose-400'} border flex items-center justify-center text-3xl shadow-lg">
      <i class="fa-solid ${isWin ? 'fa-trophy' : 'fa-xmark'}"></i>
    </div>
    <div>
      <h3 class="font-['Orbitron'] font-black text-2xl ${isWin ? 'text-emerald-400' : 'text-rose-400'} tracking-wider">${isWin ? 'VICTORY' : 'DEFEAT'}</h3>
      <p class="text-xs sm:text-sm text-slate-300 mt-1">${resultMsg}</p>
      <p class="text-xs font-bold font-['Orbitron'] ${isWin ? 'text-emerald-400' : 'text-slate-500'} mt-1">
        ${isWin ? `+$${payout.toFixed(2)} USDT ADDED TO BALANCE` : `-$${state.currentStake.toFixed(2)} USDT`}
      </p>
    </div>
    <button onclick="startMatchmaking()" class="mt-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 font-['Orbitron'] font-bold text-slate-950 text-xs sm:text-sm tracking-widest hover:brightness-110 active:scale-95 transition shadow-lg flex items-center gap-2">
      <i class="fa-solid fa-rotate-right"></i> PLAY AGAIN
    </button>
  `;
}

function drawCanvasStandby() {
  if (!ctx) return;
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// --- 9. WEEKLY SPRINT MILESTONES & TIMER ---
function updateSprintSection() {
  document.getElementById("sprintWinsDisplay").innerText = state.wins;

  let nextRewardText = "MAX REWARDS REACHED";
  let maxWins = 1000;
  if (state.wins < 20) {
    nextRewardText = "NEXT REWARD: 2.00 USDT";
    maxWins = 20;
  } else if (state.wins < 50) {
    nextRewardText = "NEXT REWARD: 5.00 USDT";
    maxWins = 50;
  } else if (state.wins < 100) {
    nextRewardText = "NEXT REWARD: 10.00 USDT";
    maxWins = 100;
  } else if (state.wins < 1000) {
    nextRewardText = "NEXT REWARD: 100.00 USDT";
    maxWins = 1000;
  }

  document.getElementById("nextRewardLabel").innerText = nextRewardText;

  const progressPct = Math.min(100, (state.wins / maxWins) * 100);
  document.getElementById("sprintProgressBar").style.width = `${progressPct}%`;

  checkMilestoneBtn("claim20Btn", 20);
  checkMilestoneBtn("claim50Btn", 50);
  checkMilestoneBtn("claim100Btn", 100);
  checkMilestoneBtn("claim1000Btn", 1000);
}

function checkMilestoneBtn(btnId, requiredWins) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  if (state.claimedMilestones.includes(requiredWins)) {
    btn.innerText = "CLAIMED";
    btn.disabled = true;
    btn.className = "px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-[10px] font-bold text-slate-600 cursor-not-allowed";
  } else if (state.wins >= requiredWins) {
    btn.innerText = "CLAIM";
    btn.disabled = false;
    btn.className = "px-3 py-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/20 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/30 transition cursor-pointer animate-pulse";
  } else {
    btn.innerText = "LOCKED";
    btn.disabled = true;
    btn.className = "px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-[10px] font-bold text-slate-500 cursor-not-allowed";
  }
}

function claimMilestone(winsReq, amount) {
  if (state.wins < winsReq || state.claimedMilestones.includes(winsReq)) return;

  state.claimedMilestones.push(winsReq);
  state.balance += amount;
  updateUI();
  showCyberAlert("REWARD CLAIMED!", `You have claimed +$${amount.toFixed(2)} USDT bonus for reaching ${winsReq} wins!`, "fa-gift");
}

function startSprintTimer() {
  const updateTimer = () => {
    const timerElement = document.getElementById("sprintCountdown");
    if (!timerElement) return;

    const now = Date.now();
    const diff = state.sprintEndTime - now;

    if (diff <= 0) {
      timerElement.innerText = "00d 00h 00m 00s";
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    timerElement.innerText = 
      `${String(d).padStart(2, '0')}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  updateTimer();
  setInterval(updateTimer, 1000);
  }
             
