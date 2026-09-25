/* ==========================================================================
   CYBERSTRIKE | 1v1 USDT ARENA
   SCRIPT.JS — PART 1 OF 4
   ========================================================================== */

/* ==========================================================================
   1. SUPABASE CONFIGURATION
   ========================================================================== */

const SUPABASE_URL = "https://btugwhcoypxtlgmsxqci.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__DjyCoKhrV9vpmAUY-T3lg_0f-Ji2-h";

let supabaseClient = null;

/* ==========================================================================
   2. INITIALIZE SUPABASE
   ========================================================================== */

if (typeof supabase !== "undefined" && SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/* ==========================================================================
   3. GLOBAL STATE
   ========================================================================== */

let currentUser = null;

let userProfile = {
  balance: 0,
  sprint_wins: 0,
  claimed_milestones: []
};

let selectedStake = 0.50;
let selectedGameMode = "penalty_shootout";

let currentMatchId = null;
let matchActive = false;
let playerScore = 0;
let opponentScore = 0;

/* ==========================================================================
   4. PAGE INITIALIZATION
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  if (!supabaseClient) {
    console.error("Supabase failed to initialize.");
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session && session.user) {
      currentUser = session.user;
      await fetchUserProfile();
      showApplication();
    } else {
      showLoginScreen();
    }
  } catch (error) {
    console.error("Initial authentication error:", error);
    showLoginScreen();
  }

  checkPaymentRedirect();
  initSprintCountdown();
  setupDepositInputListener();
});

/* ==========================================================================
   5. AUTH STATE LISTENER
   ========================================================================== */

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log("Auth event:", event);

    if (session && session.user) {
      currentUser = session.user;
      await fetchUserProfile();
      showApplication();
    } else {
      currentUser = null;
      userProfile = {
        balance: 0,
        sprint_wins: 0,
        claimed_milestones: []
      };
      showLoginScreen();
    }
  });
}

/* ==========================================================================
   6. SHOW LOGIN SCREEN
   ========================================================================== */

function showLoginScreen() {
  const authGate = document.getElementById("authGate");
  const appContainer = document.getElementById("appContainer");

  if (authGate) authGate.style.display = "flex";
  if (appContainer) appContainer.style.display = "none";
}

/* ==========================================================================
   7. SHOW APPLICATION
   ========================================================================== */

function showApplication() {
  const authGate = document.getElementById("authGate");
  const appContainer = document.getElementById("appContainer");

  if (authGate) authGate.style.display = "none";
  if (appContainer) appContainer.style.display = "flex";

  updateBalanceDisplay();
  updateSprintProgress();
  setupDepositListener();
}

/* ==========================================================================
   8. LOAD USER PROFILE
   ========================================================================== */

async function fetchUserProfile() {
  if (!supabaseClient) return;

  if (!currentUser) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) currentUser = session.user;
  }

  if (!currentUser) return;

  // Sync FaucetPay withdrawal email field
  const withdrawEmailInput = document.getElementById("withdrawEmailInput");
  if (withdrawEmailInput && currentUser.email) {
    withdrawEmailInput.value = currentUser.email;
  }

  // Sync FaucetPay deposit user ID field
  const userIdField = document.getElementById("custom_user_id");
  if (userIdField) {
    userIdField.value = currentUser.id;
  }

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("balance, sprint_wins, claimed_milestones")
      .eq("id", currentUser.id)
      .single();

    if (error) throw error;

    userProfile = {
      balance: Number(data.balance || 0),
      sprint_wins: Number(data.sprint_wins || 0),
      claimed_milestones: Array.isArray(data.claimed_milestones) ? data.claimed_milestones : []
    };

    updateBalanceDisplay();
    updateSprintProgress();
  } catch (error) {
    console.error("Profile loading error:", error);
    userProfile = { balance: 0, sprint_wins: 0, claimed_milestones: [] };
    updateBalanceDisplay();
  }
}

/* ==========================================================================
   9. UPDATE BALANCE DISPLAY
   ========================================================================== */

function updateBalanceDisplay() {
  const balance = Number(userProfile.balance || 0);

  const balanceDisplay = document.getElementById("userBalanceDisplay");
  if (balanceDisplay) {
    balanceDisplay.textContent = balance.toFixed(2);
  }

  const withdrawBalanceDisplay = document.getElementById("withdrawBalanceDisplay");
  if (withdrawBalanceDisplay) {
    withdrawBalanceDisplay.textContent = `${balance.toFixed(2)} USDT`;
  }
}

/* ==========================================================================
   10. HANDLE LOGIN
   ========================================================================== */

async function handleLogin() {
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const message = document.getElementById("authMessage");

  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";

  if (!email || !password) {
    if (message) {
      message.textContent = "Please enter your email and password.";
      message.classList.remove("hidden");
    }
    return;
  }

  if (!supabaseClient) {
    if (message) {
      message.textContent = "Supabase connection unavailable.";
      message.classList.remove("hidden");
    }
    return;
  }

  try {
    if (message) {
      message.textContent = "CONNECTING TO CYBERSTRIKE...";
      message.classList.remove("hidden");
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      // Auto signup fallback
      const signup = await supabaseClient.auth.signUp({ email, password });
      if (signup.error) throw error;

      if (message) {
        message.textContent = "ACCOUNT CREATED. LOGGING IN...";
      }

      if (signup.data && signup.data.user) {
        currentUser = signup.data.user;
      }
      return;
    }

    if (data && data.user) {
      currentUser = data.user;
    }

    await fetchUserProfile();
    showApplication();
  } catch (error) {
    console.error("Login error:", error);
    if (message) {
      message.textContent = error.message || "Login failed. Please try again.";
      message.classList.remove("hidden");
    }
  }
}

/* ==========================================================================
   11. LOGOUT
   ========================================================================== */

async function logout() {
  try {
    if (supabaseClient) await supabaseClient.auth.signOut();
  } catch (error) {
    console.error("Logout error:", error);
  }

  currentUser = null;
  userProfile = { balance: 0, sprint_wins: 0, claimed_milestones: [] };
  showLoginScreen();
}

/* ==========================================================================
   END OF PART 1 OF 4
   ========================================================================== */
  /* ==========================================================================
   CYBERSTRIKE | SCRIPT.JS — PART 2 OF 4
   ========================================================================== */

/* ==========================================================================
   12. CYBER ALERT MODAL
   ========================================================================== */

function showCyberAlert(title, message, iconClass = "fa-gift text-cyan-400") {
  const titleElement = document.getElementById("cyberAlertTitle");
  const messageElement = document.getElementById("cyberAlertMessage");
  const iconElement = document.getElementById("cyberAlertIcon");

  if (titleElement) titleElement.textContent = title;
  if (messageElement) messageElement.textContent = message;
  if (iconElement) iconElement.className = `fa-solid ${iconClass}`;

  openModal("cyberAlertModal");
}

/* ==========================================================================
   13. OPEN / CLOSE MODALS
   ========================================================================== */

async function openModal(modalId) {
  const modal = document.getElementById(modalId);

  if (modalId === "withdrawModal") {
    // Direct sync from active session
    try {
      if (supabaseClient) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) currentUser = user;
      }
    } catch (err) {
      console.error("User fetch error:", err);
    }

    const withdrawEmailInput = document.getElementById("withdrawEmailInput");
    if (withdrawEmailInput && currentUser && currentUser.email) {
      withdrawEmailInput.value = currentUser.email;
    }

    const withdrawBalanceDisplay = document.getElementById("withdrawBalanceDisplay");
    if (withdrawBalanceDisplay) {
      const balance = Number(userProfile.balance || 0);
      withdrawBalanceDisplay.textContent = `${balance.toFixed(2)} USDT`;
    }
  }

  if (modal) {
    modal.classList.remove("hidden");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
  }
}

/* ==========================================================================
   14. SELECT STAKE TIER
   ========================================================================== */

function selectStakeTier(stake) {
  selectedStake = Number(stake);

  [0.50, 1.00, 5.00].forEach(tier => {
    const btn = document.getElementById(`stake-tier-${tier.toFixed(2)}`);
    if (btn) {
      if (tier === selectedStake) {
        btn.className = "stake-tier-btn bg-cyan-500 text-slate-950 font-bold py-2 px-3 rounded text-sm shadow-glow transition-all";
      } else {
        btn.className = "stake-tier-btn bg-slate-800 border border-slate-700 hover:border-cyan-500 text-white font-bold py-2 px-3 rounded text-sm transition-all";
      }
    }
  });

  const overviewStake = document.getElementById("matchOverviewStake");
  if (overviewStake) {
    overviewStake.innerHTML = `Entry Stake: <strong class="text-cyan-400">$${selectedStake.toFixed(2)} USDT</strong>`;
  }

  const overlayDesc = document.getElementById("matchOverlayDesc");
  if (overlayDesc) {
    const prize = (selectedStake * 1.6).toFixed(2);
    overlayDesc.innerHTML = `Entry Stake: <strong class="text-cyan-400">$${selectedStake.toFixed(2)} USDT</strong>. Winner takes <strong class="text-emerald-400">$${prize} USDT</strong> (20% rake).`;
  }
}

/* ==========================================================================
   15. START MATCHMAKING
   ========================================================================== */

async function startMatchmaking() {
  if (!currentUser) {
    showCyberAlert("LOGIN REQUIRED", "Please log in before entering the arena.", "fa-lock text-amber-400");
    return;
  }

  if (!supabaseClient) {
    showCyberAlert("CONNECTION ERROR", "Supabase connection unavailable.", "fa-triangle-exclamation text-rose-500");
    return;
  }

  if (Number(userProfile.balance || 0) < selectedStake) {
    showCyberAlert("INSUFFICIENT BALANCE", `You need at least $${selectedStake.toFixed(2)} USDT to enter this match.`, "fa-wallet text-rose-400");
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Session expired. Please log in again.");

    showCyberAlert("SEARCHING", "Searching for an opponent...", "fa-spinner fa-spin text-cyan-400");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        action: "START",
        stake: selectedStake,
        gameMode: selectedGameMode
      })
    });

    const rawText = await response.text();
    let result = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      result = { error: rawText || "Invalid response format" };
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || "Match initialization failed.");
    }

    currentMatchId = result.matchId || result.match_id || null;
    closeModal("cyberAlertModal");

    showCyberAlert("MATCH FOUND", "Opponent connected. Prepare for battle!", "fa-crosshairs text-cyan-400");

    setTimeout(() => {
      closeModal("cyberAlertModal");
      startPenaltyShootout();
    }, 1200);

  } catch (error) {
    console.error("Matchmaking error:", error);
    showCyberAlert("MATCHMAKING ERROR", error.message || "Could not connect to match server.", "fa-triangle-exclamation text-rose-500");
  }
}

/* ==========================================================================
   16. PENALTY SHOOTOUT GAME ENGINE
   ========================================================================== */

function startPenaltyShootout() {
  const canvas = document.getElementById("gameCanvas");
  const overlay = document.getElementById("canvasOverlay");

  if (!canvas) {
    showCyberAlert("GAME ERROR", "Game canvas element missing.", "fa-triangle-exclamation text-rose-500");
    return;
  }

  matchActive = true;
  playerScore = 0;
  opponentScore = 0;

  if (overlay) overlay.style.display = "none";

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  drawPenaltyField(ctx);
  startPenaltyRound();
}

/* ==========================================================================
   17. DRAW FIELD
   ========================================================================== */

function drawPenaltyField(ctx) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(34,211,238,0.45)";
  ctx.lineWidth = 3;

  // Goal Post
  const goalWidth = 260;
  const goalHeight = 100;
  const goalX = (width - goalWidth) / 2;
  const goalY = 45;

  ctx.strokeRect(goalX, goalY, goalWidth, goalHeight);

  // Penalty Box
  ctx.strokeRect(goalX - 70, goalY + goalHeight, goalWidth + 140, 150);

  // Penalty Spot
  ctx.beginPath();
  ctx.arc(width / 2, height - 115, 7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fill();
}

/* ==========================================================================
   18. START ROUND
   ========================================================================== */

function startPenaltyRound() {
  if (!matchActive) return;

  const canvas = document.getElementById("gameCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  drawPenaltyField(ctx);

  const centerX = canvas.width / 2;
  const goalkeeperY = 105;

  // Goalkeeper
  ctx.fillStyle = "rgba(16,185,129,0.85)";
  ctx.fillRect(centerX - 35, goalkeeperY, 70, 18);
  ctx.beginPath();
  ctx.arc(centerX, goalkeeperY - 12, 10, 0, Math.PI * 2);
  ctx.fill();

  // Ball
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(centerX, canvas.height - 115, 11, 0, Math.PI * 2);
  ctx.fill();

  canvas.onclick = handlePenaltyShot;
}

/* ==========================================================================
   19. HANDLE SHOT
   ========================================================================== */

function handlePenaltyShot(event) {
  if (!matchActive) return;

  const canvas = document.getElementById("gameCanvas");
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  const goalLeft = (canvas.width - 260) / 2;
  const goalRight = goalLeft + 260;
  const goalTop = 45;
  const goalBottom = 145;

  const scored = x >= goalLeft && x <= goalRight && y >= goalTop && y <= goalBottom;

  if (scored) {
    playerScore++;
    showCyberAlert("GOAL!", "Target successfully hit!", "fa-futbol text-emerald-400");
  } else {
    showCyberAlert("MISS!", "The shot missed the goal frame.", "fa-xmark text-rose-500");
  }

  setTimeout(() => {
    closeModal("cyberAlertModal");
    finish1v1Match();
  }, 800);
}

/* ==========================================================================
   END OF PART 2 OF 4
   ========================================================================== */
   /* ==========================================================================
   CYBERSTRIKE | SCRIPT.JS — PART 3 OF 4
   ========================================================================== */

/* ==========================================================================
   20. FINISH 1v1 MATCH
   ========================================================================== */

async function finish1v1Match() {
  if (!currentUser || !matchActive) return;
  matchActive = false;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Your login session has expired.");

    showCyberAlert("RESOLVING MATCH", "Calculating results on blockchain ledger...", "fa-spinner fa-spin text-cyan-400");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        action: "RESOLVE",
        matchId: currentMatchId,
        stake: selectedStake,
        playerScore: playerScore,
        opponentScore: opponentScore
      })
    });

    const rawText = await response.text();
    let result = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      result = { error: rawText || "Invalid response format." };
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || "Could not resolve match.");
    }

    await fetchUserProfile();

    const won = playerScore > opponentScore;
    const draw = playerScore === opponentScore;

    let title = "MATCH COMPLETE";
    let message = result.message || "Match resolution verified.";
    let icon = "fa-circle-info text-cyan-400";

    if (won) {
      title = "VICTORY!";
      icon = "fa-trophy text-emerald-400";
    } else if (draw) {
      title = "DRAW";
      icon = "fa-handshake text-amber-400";
    } else {
      title = "DEFEAT";
      icon = "fa-xmark text-rose-500";
    }

    showCyberAlert(title, message, icon);

    setTimeout(() => {
      closeModal("cyberAlertModal");
      const overlay = document.getElementById("canvasOverlay");
      if (overlay) overlay.style.display = "flex";
    }, 2000);

  } catch (error) {
    console.error("Match resolution error:", error);
    showCyberAlert("MATCH ERROR", error.message || "Resolution failure.", "fa-triangle-exclamation text-rose-500");
  }
}

/* ==========================================================================
   21. WEEKLY SPRINT PROGRESS
   ========================================================================== */

function updateSprintProgress() {
  const wins = Number(userProfile.sprint_wins || 0);

  const winsDisplay = document.getElementById("sprintWinsCount");
  const progressBar = document.getElementById("sprintProgressBar");
  const nextRewardLabel = document.getElementById("nextRewardLabel");

  if (winsDisplay) winsDisplay.textContent = wins;

  let nextTarget = 20;
  let nextReward = 2.00;

  if (wins >= 20 && wins < 50) {
    nextTarget = 50;
    nextReward = 5.00;
  } else if (wins >= 50 && wins < 100) {
    nextTarget = 100;
    nextReward = 10.00;
  } else if (wins >= 100 && wins < 1000) {
    nextTarget = 1000;
    nextReward = 100.00;
  } else if (wins >= 1000) {
    nextTarget = 1000;
    nextReward = 100.00;
  }

  if (progressBar) {
    const percentage = Math.min((wins / nextTarget) * 100, 100);
    progressBar.style.width = `${percentage}%`;
  }

  if (nextRewardLabel) {
    if (wins >= 1000) {
      nextRewardLabel.textContent = "MAX MILESTONES CLAIMED";
    } else {
      nextRewardLabel.textContent = `NEXT REWARD: ${nextReward.toFixed(2)} USDT`;
    }
  }

  updateMilestoneButtons();
}

/* ==========================================================================
   22. UPDATE MILESTONE BUTTONS
   ========================================================================== */

function updateMilestoneButtons() {
  const wins = Number(userProfile.sprint_wins || 0);
  const claimed = Array.isArray(userProfile.claimed_milestones) ? userProfile.claimed_milestones : [];

  const milestones = [
    { id: "claim20Btn", wins: 20 },
    { id: "claim50Btn", wins: 50 },
    { id: "claim100Btn", wins: 100 },
    { id: "claim1000Btn", wins: 1000 }
  ];

  milestones.forEach(m => {
    const button = document.getElementById(m.id);
    if (!button) return;

    const isClaimed = claimed.includes(m.wins);

    if (isClaimed) {
      button.disabled = true;
      button.textContent = "CLAIMED";
      button.className = "sprint-claim-btn claimed-glowing";
    } else if (wins >= m.wins) {
      button.disabled = false;
      button.textContent = "CLAIM";
      button.className = "sprint-claim-btn ready";
    } else {
      button.disabled = true;
      button.textContent = "LOCKED";
      button.className = "sprint-claim-btn locked";
    }
  });
}

/* ==========================================================================
   23. CLAIM MILESTONE
   ========================================================================== */

async function claimMilestone(eventOrWins, targetWinsParam, rewardAmountParam) {
  let targetWins, rewardAmount;

  if (typeof eventOrWins === "number") {
    targetWins = eventOrWins;
    rewardAmount = targetWinsParam;
  } else {
    if (eventOrWins && eventOrWins.preventDefault) eventOrWins.preventDefault();
    targetWins = targetWinsParam;
    rewardAmount = rewardAmountParam;
  }

  if (!currentUser) {
    showCyberAlert("NOT LOGGED IN", "Please log in before claiming rewards.", "fa-lock text-amber-400");
    return;
  }

  const wins = Number(userProfile.sprint_wins || 0);
  const claimed = Array.isArray(userProfile.claimed_milestones) ? userProfile.claimed_milestones : [];

  if (wins < targetWins) {
    showCyberAlert("MILESTONE LOCKED", `Reach ${targetWins} wins to unlock this reward.`, "fa-lock text-slate-400");
    return;
  }

  if (claimed.includes(targetWins)) {
    showCyberAlert("ALREADY CLAIMED", "This milestone reward has already been claimed.", "fa-circle-check text-cyan-400");
    return;
  }

  try {
    showCyberAlert("PROCESSING", "Verifying milestone eligibility...", "fa-spinner fa-spin text-cyan-400");

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Your session has expired.");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/milestone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ targetWins, rewardAmount })
    });

    const rawText = await response.text();
    let result = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      result = { error: rawText || "Invalid server response." };
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || "Claim request was rejected.");
    }

    await fetchUserProfile();
    showCyberAlert("REWARD CLAIMED", `+$${Number(rewardAmount).toFixed(2)} USDT credited to your balance!`, "fa-gift text-emerald-400");

  } catch (error) {
    console.error("Milestone error:", error);
    showCyberAlert("CLAIM FAILED", error.message || "Could not claim milestone.", "fa-triangle-exclamation text-rose-500");
  }
}

/* ==========================================================================
   END OF PART 3 OF 4
   ========================================================================== */
/* ==========================================================================
   CYBERSTRIKE | SCRIPT.JS — PART 4 OF 4
   ========================================================================== */

/* ==========================================================================
   24. FAUCETPAY CASHOUT / WITHDRAWAL
   ========================================================================== */

async function confirmWithdrawal() {
  const amountInput = document.getElementById("withdrawAmountInput");
  const emailInput = document.getElementById("withdrawEmailInput");

  const amount = parseFloat(amountInput ? amountInput.value : 0);
  const recipientEmail = emailInput ? emailInput.value.trim() : "";

  if (!currentUser) {
    showCyberAlert("LOGIN REQUIRED", "Please log in before submitting cashouts.", "fa-lock text-amber-400");
    return;
  }

  if (!recipientEmail || !recipientEmail.includes("@")) {
    showCyberAlert("INVALID EMAIL", "A valid FaucetPay email address is required.", "fa-triangle-exclamation text-rose-500");
    return;
  }

  if (!amount || amount < 0.50) {
    showCyberAlert("INVALID CASHOUT", "Minimum withdrawal is 0.50 USDT.", "fa-triangle-exclamation text-rose-500");
    return;
  }

  if (amount > Number(userProfile.balance || 0)) {
    showCyberAlert("INSUFFICIENT BALANCE", "Amount exceeds available balance.", "fa-wallet text-rose-500");
    return;
  }

  try {
    showCyberAlert("PROCESSING", "Dispatching instant cashout via FaucetPay...", "fa-spinner fa-spin text-emerald-400");

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("Session expired. Please log in again.");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/withdraw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        amount: Number(amount),
        recipientEmail: recipientEmail
      })
    });

    const rawText = await response.text();
    let result = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      result = { error: rawText || "Unreadable server response." };
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || "Payout rejected.");
    }

    await fetchUserProfile();

    if (amountInput) amountInput.value = "";
    closeModal("withdrawModal");

    showCyberAlert("CASHOUT SUCCESSFUL", `${amount.toFixed(2)} USDT dispatched to ${recipientEmail}`, "fa-circle-check text-emerald-400");

  } catch (error) {
    console.error("WITHDRAWAL ERROR:", error);
    showCyberAlert("PAYOUT ERROR", error.message || "Payout dispatch failed.", "fa-triangle-exclamation text-rose-500");
  }
}

/* ==========================================================================
   25. FAUCETPAY DEPOSIT
   ========================================================================== */

function setupDepositInputListener() {
  const depositInput = document.getElementById("depositAmount");
  const depositDisplay = document.getElementById("depositAmountDisplay");

  if (depositInput && depositDisplay) {
    depositInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value) || 0;
      depositDisplay.textContent = `${val.toFixed(2)} USDT`;
    });
  }
}

function confirmDeposit() {
  const depositInput = document.getElementById("depositAmount");
  const amount = parseFloat(depositInput ? depositInput.value : 0);

  if (!currentUser) {
    showCyberAlert("LOGIN REQUIRED", "Please log in before making a deposit.", "fa-lock text-amber-400");
    return;
  }

  if (!amount || amount < 0.50) {
    showCyberAlert("INVALID DEPOSIT", "Minimum deposit amount is 0.50 USDT.", "fa-triangle-exclamation text-rose-500");
    return;
  }

  const userIdField = document.getElementById("custom_user_id");
  if (userIdField && currentUser) {
    userIdField.value = currentUser.id;
  }

  const form = depositInput ? depositInput.closest("form") : null;
  if (form) {
    form.submit();
  }
}

/* ==========================================================================
   26. REALTIME DATABASE LISTENER
   ========================================================================== */

function setupDepositListener() {
  if (!supabaseClient || !currentUser) return;

  try {
    supabaseClient
      .channel(`profile-${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${currentUser.id}`
        },
        payload => {
          if (payload.new) {
            userProfile.balance = Number(payload.new.balance || 0);

            if (payload.new.sprint_wins !== undefined) {
              userProfile.sprint_wins = Number(payload.new.sprint_wins || 0);
            }

            if (payload.new.claimed_milestones !== undefined) {
              userProfile.claimed_milestones = Array.isArray(payload.new.claimed_milestones) ? payload.new.claimed_milestones : [];
            }

            updateBalanceDisplay();
            updateSprintProgress();
          }
        }
      )
      .subscribe();
  } catch (error) {
    console.error("Profile listener error:", error);
  }
}

/* ==========================================================================
   27. WEEKLY SPRINT COUNTDOWN
   ========================================================================== */

function initSprintCountdown() {
  const countdown = document.getElementById("sprintCountdown");
  if (!countdown) return;

  function updateCountdown() {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;

    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);

    const diff = nextMonday.getTime() - now.getTime();

    if (diff <= 0) {
      countdown.textContent = "00d 00h 00m 00s";
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    countdown.textContent = `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

/* ==========================================================================
   28. PAYMENT REDIRECT CHECK
   ========================================================================== */

function checkPaymentRedirect() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");

  if (payment === "success") {
    showCyberAlert("PAYMENT RECEIVED", "Your deposit was received. Balance will update upon confirmation.", "fa-circle-check text-emerald-400");
  } else if (payment === "cancelled") {
    showCyberAlert("PAYMENT CANCELLED", "The deposit checkout process was cancelled.", "fa-xmark text-rose-500");
  }
}

/* ==========================================================================
   29. MODAL OUTSIDE CLICK DISMISSAL
   ========================================================================== */

document.addEventListener("click", event => {
  ["depositModal", "withdrawModal", "cyberAlertModal"].forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal && event.target === modal) {
      modal.classList.add("hidden");
    }
  });
});

/* ==========================================================================
   END OF SCRIPT.JS — PART 4 OF 4
   ========================================================================== */
    
