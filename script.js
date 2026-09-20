// ------------------------------------------
// 1. CONFIGURATION
// ------------------------------------------
const SUPABASE_URL = "https://btugwhcoypxtlgmsxqci.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__DjyCoKhrV9vpmAUY-T3lg_0f-Ji2-h";
const FAUCETPAY_MERCHANT_USERNAME = "YOUR_FAUCETPAY_USERNAME";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentBalance = 0.00;
let currentStake = 0.50;
let sprintWins = 0;
let claimedMilestones = [];
let isMatchmaking = false;
let gameState = "IDLE";

// ------------------------------------------
// 2. AUTHENTICATION & INITIALIZATION
// ------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  initCanvas();
  selectStakeTier(0.50);
  startSprintCountdown();

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentUser = session.user;
      showApp();
    } else {
      currentUser = null;
      document.getElementById("authGate").classList.remove("hidden");
      document.getElementById("appContainer").classList.add("hidden");
    }
  });
});

async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    showAuthError("Please enter both email and password.");
    return;
  }

  hideAuthError();

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const signup = await supabase.auth.signUp({ email, password });
    if (signup.error) {
      showAuthError(signup.error.message);
      return;
    }
    currentUser = signup.data.user;
  } else {
    currentUser = data.user;
  }

  showApp();
}

function showAuthError(msg) {
  const authMessage = document.getElementById("authMessage");
  authMessage.textContent = msg;
  authMessage.classList.remove("hidden");
}

function hideAuthError() {
  document.getElementById("authMessage").classList.add("hidden");
}

async function showApp() {
  document.getElementById("authGate").classList.add("hidden");
  document.getElementById("appContainer").classList.remove("hidden");
  document.getElementById("depositUserId").value = currentUser.id;
  document.getElementById("withdrawEmail").value = currentUser.email;

  await fetchUserData();
}

async function logout() {
  await supabase.auth.signOut();
  window.location.reload();
}

// ------------------------------------------
// 3. USER DATA & BALANCES
// ------------------------------------------
async function fetchUserData() {
  if (!currentUser) return;

  let { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error || !profile) {
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert([{ id: currentUser.id, balance: 0.00, sprint_wins: 0, claimed_milestones: [] }])
      .select()
      .single();
    profile = newProfile;
  }

  currentBalance = profile?.balance || 0.00;
  sprintWins = profile?.sprint_wins || 0;
  claimedMilestones = profile?.claimed_milestones || [];

  updateUI();
}

function updateUI() {
  document.getElementById("userBalanceDisplay").textContent = currentBalance.toFixed(2);
  document.getElementById("withdrawBalanceDisplay").textContent = `${currentBalance.toFixed(2)} USDT`;
  document.getElementById("sprintWinsDisplay").textContent = sprintWins;

  updateSprintMilestones();
}

// ------------------------------------------
// 4. STAKE SELECTION & MATCHMAKING
// ------------------------------------------
function selectStakeTier(amount) {
  currentStake = amount;

  [0.5, 1.0, 5.0].forEach(tier => {
    const btn = document.getElementById(`stakeTier-${tier.toFixed(1)}`);
    if (btn) {
      btn.classList.remove("border-cyan-500", "bg-cyan-500/10");
      btn.classList.add("border-slate-800", "bg-slate-900/50");
    }
  });

  const activeBtn = document.getElementById(`stakeTier-${amount.toFixed(1)}`);
  if (activeBtn) {
    activeBtn.classList.add("border-cyan-500", "bg-cyan-500/10");
    activeBtn.classList.remove("border-slate-800", "bg-slate-900/50");
  }

  const netWin = (amount * 2 * 0.8).toFixed(2);
  document.getElementById("matchOverlayDesc").textContent = 
    `Entry Stake: $${amount.toFixed(2)} USDT. Winner takes $${netWin} USDT (20% rake).`;
}

async function startMatchmaking() {
  if (currentBalance < currentStake) {
    showCyberAlert("INSUFFICIENT BALANCE", `You need at least $${currentStake.toFixed(2)} USDT to enter this match.`);
    return;
  }

  isMatchmaking = true;
  document.getElementById("canvasOverlay").classList.add("hidden");

  // Immediate balance deduction to prevent match-abandonment exploits
  currentBalance -= currentStake;
  updateUI();
  
  await supabase.from("profiles").update({ balance: currentBalance }).eq("id", currentUser.id);

  resetGameRound();
}

// ------------------------------------------
// 5. CANVAS GAME ENGINE
// ------------------------------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let ball = { x: 300, y: 380, radius: 14, targetX: 300, targetY: 380, moving: false };
let keeper = { x: 260, y: 170, width: 80, height: 20, targetX: 260 };

function initCanvas() {
  canvas.addEventListener("click", handleInput);
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleInput(touch);
  }, { passive: false });

  requestAnimationFrame(gameLoop);
}

function resetGameRound() {
  gameState = "IDLE";
  ball = { x: 300, y: 380, radius: 14, targetX: 300, targetY: 380, moving: false };
  keeper = { x: 260, y: 170, width: 80, height: 20, targetX: 260 };
}

function handleInput(e) {
  if (gameState !== "IDLE" || !isMatchmaking) return;

  const rect = canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (clickY < 250) {
    gameState = "SHOOTING";
    ball.targetX = Math.max(120, Math.min(480, clickX));
    ball.targetY = Math.max(100, Math.min(220, clickY));
    ball.moving = true;

    const options = [150, 260, 370];
    keeper.targetX = options[Math.floor(Math.random() * options.length)];
  }
}

function gameLoop() {
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Field markings
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 4;
  ctx.strokeRect(50, 50, 500, 350);

  // Goal frame
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 6;
  ctx.strokeRect(120, 90, 360, 130);

  // Goal net grid
  ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
  ctx.lineWidth = 1;
  for (let x = 120; x <= 480; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 90); ctx.lineTo(x, 220); ctx.stroke();
  }
  for (let y = 90; y <= 220; y += 15) {
    ctx.beginPath(); ctx.moveTo(120, y); ctx.lineTo(480, y); ctx.stroke();
  }

  // Goalkeeper movement
  if (gameState === "SHOOTING") {
    keeper.x += (keeper.targetX - keeper.x) * 0.15;
  }
  ctx.fillStyle = "#f43f5e";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(keeper.x, keeper.y, keeper.width, keeper.height, 8);
  } else {
    ctx.rect(keeper.x, keeper.y, keeper.width, keeper.height);
  }
  ctx.fill();

  // Ball animation
  if (ball.moving) {
    ball.x += (ball.targetX - ball.x) * 0.12;
    ball.y += (ball.targetY - ball.y) * 0.12;

    if (Math.abs(ball.y - ball.targetY) < 2) {
      ball.moving = false;
      evaluateShootout();
    }
  }

  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  requestAnimationFrame(gameLoop);
}

async function evaluateShootout() {
  gameState = "RESULT";
  const saved = ball.x >= keeper.x && ball.x <= (keeper.x + keeper.width) && ball.y <= (keeper.y + 40);

  setTimeout(async () => {
    isMatchmaking = false;
    if (!saved) {
      const prize = currentStake * 2 * 0.8;
      currentBalance += prize;
      sprintWins += 1;
      showCyberAlert("GOAL! YOU WIN", `You won $${prize.toFixed(2)} USDT!`);
    } else {
      showCyberAlert("SAVED!", "The goalkeeper blocked your shot. Better luck next match!");
    }

    await supabase.from("profiles").update({ 
      balance: currentBalance, 
      sprint_wins: sprintWins 
    }).eq("id", currentUser.id);

    updateUI();
    document.getElementById("canvasOverlay").classList.remove("hidden");
  }, 500);
}

// ------------------------------------------
// 6. WEEKLY SPRINT & MILESTONE RENDERING
// ------------------------------------------
function updateSprintMilestones() {
  const milestones = [
    { wins: 20, reward: 2.00, btnId: "claim20Btn" },
    { wins: 50, reward: 5.00, btnId: "claim50Btn" },
    { wins: 100, reward: 10.00, btnId: "claim100Btn" },
    { wins: 1000, reward: 100.00, btnId: "claim1000Btn" }
  ];

  let currentTarget = 20;

  milestones.forEach(m => {
    const btn = document.getElementById(m.btnId);
    if (!btn) return;

    const isClaimed = claimedMilestones.includes(m.wins);

    if (isClaimed) {
      btn.disabled = true;
      btn.className = "milestone-btn p-2 rounded-xl border border-slate-800 bg-slate-950/40 opacity-50 cursor-not-allowed flex flex-col items-center justify-center";
      btn.innerHTML = `<span class="text-[10px] text-slate-500 font-['Orbitron']">CLAIMED</span><span class="font-['Orbitron'] font-bold text-xs text-slate-500 mt-0.5">$${m.reward.toFixed(2)} USDT</span>`;
    } else if (sprintWins >= m.wins) {
      btn.disabled = false;
      btn.className = "milestone-btn p-2 rounded-xl border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold cursor-pointer transition shadow-lg shadow-emerald-500/10 flex flex-col items-center justify-center animate-pulse";
      btn.innerHTML = `<span class="text-[10px] font-['Orbitron']">CLAIM NOW</span><span class="font-['Orbitron'] font-bold text-xs mt-0.5">$${m.reward.toFixed(2)} USDT</span>`;
    } else {
      btn.disabled = true;
      btn.className = "milestone-btn p-2 rounded-xl border border-slate-800 bg-slate-950/80 opacity-60 cursor-not-allowed flex flex-col items-center justify-center";
      btn.innerHTML = `<span class="text-[10px] text-slate-400 font-['Orbitron']">${m.wins} WINS</span><span class="font-['Orbitron'] font-bold text-xs text-slate-300 mt-0.5">$${m.reward.toFixed(2)} USDT</span>`;

      if (sprintWins < m.wins && currentTarget === 20) {
        currentTarget = m.wins;
      }
    }
  });

  const currentMilestone = milestones.find(m => m.wins === currentTarget);
  if (currentMilestone) {
    document.getElementById("nextRewardLabel").textContent = `NEXT REWARD: ${currentMilestone.reward.toFixed(2)} USDT`;
  }

  const progressPercent = Math.min(100, (sprintWins / currentTarget) * 100);
  document.getElementById("sprintProgressBar").style.width = `${progressPercent}%`;
}

async function claimMilestone(wins, reward) {
  if (sprintWins < wins || claimedMilestones.includes(wins)) return;

  claimedMilestones.push(wins);
  currentBalance += reward;

  showCyberAlert("REWARD CLAIMED!", `You added $${reward.toFixed(2)} USDT to your balance.`);

  await supabase.from("profiles").update({ 
    balance: currentBalance,
    claimed_milestones: claimedMilestones
  }).eq("id", currentUser.id);

  updateUI();
}

function startSprintCountdown() {
  function updateTimer() {
    const now = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    endOfWeek.setHours(23, 59, 59, 0);

    const diff = endOfWeek - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    document.getElementById("sprintCountdown").textContent = 
      `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// ------------------------------------------
// 7. MODALS & PAYMENT GATEWAY
// ------------------------------------------
function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

function initiateFaucetPayDeposit() {
  const amount = parseFloat(document.getElementById("depositAmount").value);
  if (!amount || amount < 0.5) {
    showCyberAlert("INVALID AMOUNT", "Minimum deposit is 0.50 USDT.");
    return;
  }

  const checkoutUrl = `https://faucetpay.io/merchant/webpay?merchant_username=${FAUCETPAY_MERCHANT_USERNAME}&item_name=Cyberstrike+Deposit&currency1=USDT&amount1=${amount}&custom=${currentUser.id}`;
  window.open(checkoutUrl, "_blank");
}

async function confirmWithdrawal() {
  const amount = parseFloat(document.getElementById("withdrawAmount").value);
  if (!amount || amount > currentBalance || amount < 0.5) {
    showCyberAlert("INVALID WITHDRAWAL", "Check your balance and ensure the amount is at least 0.50 USDT.");
    return;
  }

  currentBalance -= amount;
  
  await supabase.from("profiles").update({ balance: currentBalance }).eq("id", currentUser.id);
  await supabase.from("withdrawals").insert([
    { user_id: currentUser.id, email: currentUser.email, amount, status: "pending" }
  ]);

  closeModal("withdrawModal");
  updateUI();
  showCyberAlert("WITHDRAWAL SUBMITTED", `Your request to withdraw $${amount.toFixed(2)} USDT has been queued.`);
}

function showCyberAlert(title, message) {
  document.getElementById("cyberAlertTitle").textContent = title;
  document.getElementById("cyberAlertMessage").textContent = message;
  openModal("cyberAlertModal");
    }
    
