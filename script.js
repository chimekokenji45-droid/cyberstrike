// ------------------------------------------
// CONFIGURATION
// ------------------------------------------
const SUPABASE_URL = "https://btugwhcoypxtlgmsxqci.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__DjyCoKhrV9vpmAUY-T3lg_0f-Ji2-h";
const FAUCETPAY_MERCHANT_USERNAME = "YOUR_FAUCETPAY_USERNAME";

let supabase = null;
let currentUser = null;
let currentBalance = 0.00;
let currentStake = 0.50;
let sprintWins = 0;
let claimedMilestones = [];
let isMatchmaking = false;
let gameState = "IDLE";

let canvas = null;
let ctx = null;
let ball = { x: 300, y: 380, radius: 14, targetX: 300, targetY: 380, moving: false };
let keeper = { x: 260, y: 170, width: 80, height: 20, targetX: 260 };

// Safe Supabase Loader
function initSupabase() {
  if (
    typeof window.supabase !== "undefined" &&
    SUPABASE_URL &&
    SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
    SUPABASE_URL.startsWith("https://")
  ) {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn("Supabase init failed:", e);
      supabase = null;
    }
  }
}

// ------------------------------------------
// LIFECYCLE & AUTH
// ------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  initSupabase();
  initCanvas();
  selectStakeTier(0.50);
  startSprintCountdown();

  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        currentUser = session.user;
        await showApp();
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
          currentUser = session.user;
          await showApp();
        } else {
          currentUser = null;
          document.getElementById("authGate")?.classList.remove("hidden");
          document.getElementById("appContainer")?.classList.add("hidden");
        }
      });
    } catch (err) {
      console.warn("Auth session error:", err);
    }
  }
});

async function handleLogin() {
  const email = document.getElementById("loginEmail")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value.trim() || "";

  if (!email || !password) {
    showAuthError("Please enter both email and password.");
    return;
  }
  hideAuthError();

  // Demo Fallback (Works locally without configured Supabase keys)
  if (!supabase) {
    currentUser = { id: "demo-user-123", email: email };
    await showApp();
    return;
  }

  try {
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const signup = await supabase.auth.signUp({ email, password });
      
      if (signup.error) {
        showAuthError(signup.error.message);
        return;
      }

      if (!signup.data.session) {
        showAuthError("Account created! Check your email to confirm registration.");
        return;
      }
      
      currentUser = signup.data.user;
    } else {
      currentUser = data.user;
    }

    if (currentUser) {
      await showApp();
    }
  } catch (err) {
    showAuthError(err.message || "Login failed.");
  }
}

function showAuthError(msg) {
  const authMessage = document.getElementById("authMessage");
  if (authMessage) {
    authMessage.textContent = msg;
    authMessage.classList.remove("hidden");
  }
}

function hideAuthError() {
  const authMessage = document.getElementById("authMessage");
  if (authMessage) {
    authMessage.classList.add("hidden");
  }
}

async function showApp() {
  document.getElementById("authGate")?.classList.add("hidden");
  document.getElementById("appContainer")?.classList.remove("hidden");

  if (currentUser) {
    const depUser = document.getElementById("depositUserId");
    const withEmail = document.getElementById("withdrawEmail");
    if (depUser) depUser.value = currentUser.id;
    if (withEmail) withEmail.value = currentUser.email || "";
  }

  await fetchUserData();
}

async function logout() {
  if (supabase) {
    await supabase.auth.signOut();
  }
  window.location.reload();
}

// ------------------------------------------
// PROFILE DATA & PERSISTENCE
// ------------------------------------------
async function fetchUserData() {
  if (!currentUser) return;

  if (supabase) {
    try {
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

      currentBalance = parseFloat(profile?.balance) || 0.00;
      sprintWins = parseInt(profile?.sprint_wins) || 0;
      claimedMilestones = profile?.claimed_milestones || [];
    } catch (e) {
      console.warn("Error fetching data:", e);
    }
  } else {
    // Local storage fallback for offline/demo testing
    const local = JSON.parse(localStorage.getItem(`cyber_${currentUser.id}`) || "{}");
    currentBalance = local.balance !== undefined ? local.balance : 10.00;
    sprintWins = local.sprintWins || 0;
    claimedMilestones = local.claimedMilestones || [];
  }

  updateUI();
}

async function saveUserData() {
  if (supabase && currentUser) {
    await supabase.from("profiles").update({ 
      balance: currentBalance, 
      sprint_wins: sprintWins,
      claimed_milestones: claimedMilestones
    }).eq("id", currentUser.id);
  } else if (currentUser) {
    localStorage.setItem(`cyber_${currentUser.id}`, JSON.stringify({
      balance: currentBalance,
      sprintWins: sprintWins,
      claimedMilestones: claimedMilestones
    }));
  }
}

function updateUI() {
  const balDisp = document.getElementById("userBalanceDisplay");
  const withDisp = document.getElementById("withdrawBalanceDisplay");
  const winsDisp = document.getElementById("sprintWinsDisplay");

  if (balDisp) balDisp.textContent = currentBalance.toFixed(2);
  if (withDisp) withDisp.textContent = `${currentBalance.toFixed(2)} USDT`;
  if (winsDisp) winsDisp.textContent = sprintWins;

  updateSprintMilestones();
}

// ------------------------------------------
// GAME & MATCHMAKING
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
  const desc = document.getElementById("matchOverlayDesc");
  if (desc) {
    desc.textContent = `Entry Stake: $${amount.toFixed(2)} USDT. Winner takes $${netWin} USDT (20% rake).`;
  }
}

async function startMatchmaking() {
  if (currentBalance < currentStake) {
    showCyberAlert("INSUFFICIENT BALANCE", `You need at least $${currentStake.toFixed(2)} USDT.`);
    return;
  }

  isMatchmaking = true;
  document.getElementById("canvasOverlay")?.classList.add("hidden");

  currentBalance -= currentStake;
  updateUI();
  
  await saveUserData();
  resetGameRound();
}

function initCanvas() {
  canvas = document.getElementById("gameCanvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");

  canvas.addEventListener("click", handleInput);
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleInput(e.touches[0]);
  }, { passive: false });

  requestAnimationFrame(gameLoop);
}

function resetGameRound() {
  gameState = "IDLE";
  ball = { x: 300, y: 380, radius: 14, targetX: 300, targetY: 380, moving: false };
  keeper = { x: 260, y: 170, width: 80, height: 20, targetX: 260 };
}

function handleInput(e) {
  if (gameState !== "IDLE" || !isMatchmaking || !canvas) return;

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
  if (!ctx || !canvas) return;

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 4;
  ctx.strokeRect(50, 50, 500, 350);

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 6;
  ctx.strokeRect(120, 90, 360, 130);

  ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
  ctx.lineWidth = 1;
  for (let x = 120; x <= 480; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 90); ctx.lineTo(x, 220); ctx.stroke();
  }
  for (let y = 90; y <= 220; y += 15) {
    ctx.beginPath(); ctx.moveTo(120, y); ctx.lineTo(480, y); ctx.stroke();
  }

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
      showCyberAlert("SAVED!", "The goalkeeper blocked your shot.");
    }

    await saveUserData();
    updateUI();
    document.getElementById("canvasOverlay")?.classList.remove("hidden");
  }, 500);
}

// ------------------------------------------
// SPRINT MILESTONES
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

    if (claimedMilestones.includes(m.wins)) {
      btn.disabled = true;
      btn.className = "p-2 rounded-xl border border-slate-800 bg-slate-950/40 opacity-50 flex flex-col items-center justify-center cursor-not-allowed";
      btn.innerHTML = `<span class="text-[10px] text-slate-500 font-['Orbitron']">CLAIMED</span>`;
    } else if (sprintWins >= m.wins) {
      btn.disabled = false;
      btn.className = "p-2 rounded-xl border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold flex flex-col items-center justify-center animate-pulse cursor-pointer";
      btn.innerHTML = `<span class="text-[10px]">CLAIM NOW</span><span class="text-xs">$${m.reward.toFixed(2)}</span>`;
    } else {
      btn.disabled = true;
      btn.className = "p-2 rounded-xl border border-slate-800 bg-slate-950/80 opacity-60 flex flex-col items-center justify-center cursor-not-allowed";
      btn.innerHTML = `<span class="text-[10px] text-slate-400">${m.wins} WINS</span>`;

      if (sprintWins < m.wins && currentTarget === 20) {
        currentTarget = m.wins;
      }
    }
  });

  const progressBar = document.getElementById("sprintProgressBar");
  if (progressBar) {
    progressBar.style.width = `${Math.min(100, (sprintWins / currentTarget) * 100)}%`;
  }
}

async function claimMilestone(wins, reward) {
  if (sprintWins < wins || claimedMilestones.includes(wins)) return;

  claimedMilestones.push(wins);
  currentBalance += reward;

  showCyberAlert("REWARD CLAIMED!", `You added $${reward.toFixed(2)} USDT to your balance.`);

  await saveUserData();
  updateUI();
}

function startSprintCountdown() {
  function updateTimer() {
    const now = new Date();
    const end = new Date();
    end.setDate(now.getDate() + (7 - now.getDay()));
    end.setHours(23, 59, 59, 0);

    const diff = end - now;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff / 3600000) % 24);
    const mins = Math.floor((diff / 60000) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    const countdownEl = document.getElementById("sprintCountdown");
    if (countdownEl) {
      countdownEl.textContent = `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// ------------------------------------------
// MODALS & PAYMENTS
// ------------------------------------------
function openModal(id) { document.getElementById(id)?.classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id)?.classList.add("hidden"); }

function updateDepositDisplay() {
  const amount = document.getElementById("depositAmount")?.value || "0";
  const display = document.getElementById("depositAmountDisplay");
  if (display) display.textContent = `${parseFloat(amount).toFixed(2)} USDT`;
}

function initiateFaucetPayDeposit() {
  const amount = parseFloat(document.getElementById("depositAmount")?.value || "0");
  if (amount < 0.5) return showCyberAlert("INVALID AMOUNT", "Minimum deposit is 0.50 USDT.");

  const userId = currentUser ? currentUser.id : "demo";
  window.open(`https://faucetpay.io/merchant/webpay?merchant_username=${FAUCETPAY_MERCHANT_USERNAME}&item_name=Cyberstrike+Deposit&currency1=USDT&amount1=${amount}&custom=${userId}`, "_blank");
}

async function confirmWithdrawal() {
  const amount = parseFloat(document.getElementById("withdrawAmount")?.value || "0");
  if (amount > currentBalance || amount < 0.5) return showCyberAlert("INVALID WITHDRAWAL", "Check balance and ensure amount is at least 0.50 USDT.");

  currentBalance -= amount;
  await saveUserData();

  if (supabase && currentUser) {
    try {
      await supabase.from("withdrawals").insert([{ user_id: currentUser.id, email: currentUser.email, amount, status: "pending" }]);
    } catch (e) {
      console.warn("Withdrawal log error:", e);
    }
  }

  closeModal("withdrawModal");
  updateUI();
  showCyberAlert("WITHDRAWAL SUBMITTED", `Your request to withdraw $${amount.toFixed(2)} USDT has been queued.`);
}

function showCyberAlert(title, message) {
  const titleEl = document.getElementById("cyberAlertTitle");
  const msgEl = document.getElementById("cyberAlertMessage");
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  openModal("cyberAlertModal");
        }
            
