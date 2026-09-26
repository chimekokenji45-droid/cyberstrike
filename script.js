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

if (
  typeof supabase !== "undefined" &&
  SUPABASE_URL &&
  SUPABASE_ANON_KEY
) {
  supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}

/* ==========================================================================
   3. GLOBAL STATE
   ========================================================================== */

let currentUser = null;
let profileChannel = null;

let userProfile = {
  balance: 0,
  sprint_wins: 0,
  claimed_milestones: []
};

let selectedStake = 0.50;

/*
  Available games:
  - penalty_shootout
  - ludo
*/
let selectedGameMode = "penalty_shootout";

let currentMatchId = null;
let matchActive = false;

let playerScore = 0;
let opponentScore = 0;

/* ==========================================================================
   LUDO STATE
   ========================================================================== */

let ludoPlayerTokens = [0, 0, 0, 0];
let ludoOpponentTokens = [0, 0, 0, 0];

let ludoPlayerHome = 0;
let ludoOpponentHome = 0;

let ludoTurn = "player";
let ludoDice = 0;
let ludoWaitingForToken = false;
let ludoGameOver = false;

let ludoPlayerPath = [];
let ludoOpponentPath = [];

let ludoLastMessage = "Roll the dice to begin.";

/* ==========================================================================
   4. PAGE INITIALIZATION
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {

  if (!supabaseClient) {
    console.error("Supabase failed to initialize.");

    const message = document.getElementById("authMessage");

    if (message) {
      message.textContent = "Supabase connection unavailable.";
      message.classList.remove("hidden");
    }

    return;
  }

  /*
    Add the Ludo selector to the existing HTML.
    This means you do NOT need to manually add another game card.
  */
  createGameModeSelector();

  try {

    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    if (session && session.user) {

      currentUser = session.user;

      await fetchUserProfile();

      showApplication();

    } else {

      showLoginScreen();

    }

  } catch (error) {

    console.error(
      "Initial authentication error:",
      error
    );

    showLoginScreen();
  }

  checkPaymentRedirect();

  initSprintCountdown();

  setupDepositInputListener();

  setupDepositListener();
});

/* ==========================================================================
   5. AUTH STATE LISTENER
   ========================================================================== */

if (supabaseClient) {

  supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

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
    }
  );
}

/* ==========================================================================
   6. SHOW LOGIN SCREEN
   ========================================================================== */

function showLoginScreen() {

  const authGate =
    document.getElementById("authGate");

  const appContainer =
    document.getElementById("appContainer");

  if (authGate) {
    authGate.style.display = "flex";
  }

  if (appContainer) {
    appContainer.style.display = "none";
  }
}

/* ==========================================================================
   7. SHOW APPLICATION
   ========================================================================== */

function showApplication() {

  const authGate =
    document.getElementById("authGate");

  const appContainer =
    document.getElementById("appContainer");

  if (authGate) {
    authGate.style.display = "none";
  }

  if (appContainer) {
    appContainer.style.display = "flex";
  }

  updateBalanceDisplay();

  updateSprintProgress();

  setupDepositListener();

  updateGameModeUI();
}

/* ==========================================================================
   8. LOAD USER PROFILE
   ========================================================================== */

async function fetchUserProfile() {

  if (!supabaseClient) return;

  if (!currentUser) {

    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    if (session) {
      currentUser = session.user;
    }
  }

  if (!currentUser) return;

  /* Sync FaucetPay withdrawal email */

  const withdrawEmailInput =
    document.getElementById(
      "withdrawEmailInput"
    );

  if (
    withdrawEmailInput &&
    currentUser.email
  ) {

    withdrawEmailInput.value =
      currentUser.email;
  }

  /* Sync deposit user ID */

  const userIdField =
    document.getElementById(
      "custom_user_id"
    );

  if (userIdField) {

    userIdField.value =
      currentUser.id;
  }

  try {

    const {
      data,
      error
    } = await supabaseClient
      .from("profiles")
      .select(
        "balance, sprint_wins, claimed_milestones"
      )
      .eq("id", currentUser.id)
      .single();

    if (error) {
      throw error;
    }

    userProfile = {

      balance:
        Number(data.balance || 0),

      sprint_wins:
        Number(data.sprint_wins || 0),

      claimed_milestones:
        Array.isArray(
          data.claimed_milestones
        )
          ? data.claimed_milestones
          : []
    };

    updateBalanceDisplay();

    updateSprintProgress();

  } catch (error) {

    console.error(
      "Profile loading error:",
      error
    );

    /*
      IMPORTANT:
      Never create demo money.
      If the profile cannot load,
      balance remains 0.
    */

    userProfile = {
      balance: 0,
      sprint_wins: 0,
      claimed_milestones: []
    };

    updateBalanceDisplay();
  }
}

/* ==========================================================================
   9. UPDATE BALANCE DISPLAY
   ========================================================================== */

function updateBalanceDisplay() {

  const balance =
    Number(userProfile.balance || 0);

  const balanceDisplay =
    document.getElementById(
      "userBalanceDisplay"
    );

  if (balanceDisplay) {

    balanceDisplay.textContent =
      balance.toFixed(2);
  }

  const withdrawBalanceDisplay =
    document.getElementById(
      "withdrawBalanceDisplay"
    );

  if (withdrawBalanceDisplay) {

    withdrawBalanceDisplay.textContent =
      `${balance.toFixed(2)} USDT`;
  }
}

/* ==========================================================================
   10. HANDLE LOGIN
   ========================================================================== */

async function handleLogin() {

  const emailInput =
    document.getElementById(
      "loginEmail"
    );

  const passwordInput =
    document.getElementById(
      "loginPassword"
    );

  const message =
    document.getElementById(
      "authMessage"
    );

  const button =
    document.getElementById(
      "loginButton"
    );

  const email =
    emailInput
      ? emailInput.value.trim()
      : "";

  const password =
    passwordInput
      ? passwordInput.value
      : "";

  if (!email || !password) {

    if (message) {

      message.textContent =
        "Please enter your email and password.";

      message.classList.remove(
        "hidden"
      );
    }

    return;
  }

  if (!supabaseClient) {

    if (message) {

      message.textContent =
        "Supabase connection unavailable.";

      message.classList.remove(
        "hidden"
      );
    }

    return;
  }

  try {

    if (button) {

      button.disabled = true;

      button.textContent =
        "CONNECTING...";
    }

    if (message) {

      message.textContent =
        "CONNECTING TO CYBERSTRIKE...";

      message.classList.remove(
        "hidden"
      );
    }

    /*
      First try normal login.
    */

    const {
      data,
      error
    } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    /*
      If login fails, try creating the account.
      This preserves your previous auto-registration
      behavior.
    */

    if (error) {

      const signup =
        await supabaseClient.auth.signUp({
          email,
          password
        });

      if (signup.error) {

        throw error;
      }

      if (
        signup.data &&
        signup.data.user
      ) {

        currentUser =
          signup.data.user;

        if (signup.data.session) {

          await fetchUserProfile();

          showApplication();

          if (message) {

            message.textContent =
              "ACCOUNT CREATED. WELCOME TO CYBERSTRIKE.";
          }

        } else {

          if (message) {

            message.textContent =
              "ACCOUNT CREATED. CHECK YOUR EMAIL TO CONFIRM YOUR ACCOUNT.";
          }
        }
      }

      return;
    }

    if (
      data &&
      data.user
    ) {

      currentUser =
        data.user;
    }

    await fetchUserProfile();

    showApplication();

  } catch (error) {

    console.error(
      "Login error:",
      error
    );

    if (message) {

      message.textContent =
        error.message ||
        "Login failed. Please try again.";

      message.classList.remove(
        "hidden"
      );
    }

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        "LOGIN / ENTER ARENA";
    }
  }
}

/* ==========================================================================
   11. LOGOUT
   ========================================================================== */

async function logout() {

  if (
    profileChannel &&
    supabaseClient
  ) {

    try {

      await supabaseClient.removeChannel(
        profileChannel
      );

    } catch (error) {

      console.error(
        "Channel removal error:",
        error
      );
    }

    profileChannel = null;
  }

  try {

    if (supabaseClient) {

      await supabaseClient.auth.signOut();
    }

  } catch (error) {

    console.error(
      "Logout error:",
      error
    );
  }

  currentUser = null;

  userProfile = {
    balance: 0,
    sprint_wins: 0,
    claimed_milestones: []
  };

  matchActive = false;

  currentMatchId = null;

  showLoginScreen();
}

/* ==========================================================================
   12. CREATE GAME MODE SELECTOR
   ========================================================================== */

function createGameModeSelector() {

  const gameArena =
    document.querySelector(
      "h2"
    );

  /*
    Find the section containing
    "2. Game Arena".
  */

  const headings =
    document.querySelectorAll(
      "h2"
    );

  let arenaHeading = null;

  headings.forEach(
    heading => {

      if (
        heading.textContent
          .trim()
          .includes("Game Arena")
      ) {

        arenaHeading = heading;
      }
    }
  );

  if (!arenaHeading) return;

  const container =
    arenaHeading.parentElement;

  if (!container) return;

  /*
    Prevent duplicate creation.
  */

  if (
    document.getElementById(
      "cyberGameModeSelector"
    )
  ) {

    return;
  }

  /*
    Find the existing Penalty card.
  */

  const existingCard =
    container.querySelector(
      ".p-3\\.5"
    );

  if (!existingCard) return;

  /*
    Create new game mode container.
  */

  const selector =
    document.createElement("div");

  selector.id =
    "cyberGameModeSelector";

  selector.className =
    "grid grid-cols-1 sm:grid-cols-2 gap-3";

  /*
    Penalty button.
  */

  const penalty =
    document.createElement("button");

  penalty.type = "button";

  penalty.id =
    "gameModePenalty";

  penalty.onclick =
    () => selectGameMode(
      "penalty_shootout"
    );

  penalty.innerHTML = `
    <div class="text-left">
      <div class="font-bold text-sm text-slate-100">
        Penalty Shootout 1v1
      </div>
      <div class="text-xs text-slate-400 mt-1">
        Timing & reaction shooter duel
      </div>
    </div>
    <i class="fa-solid fa-futbol text-cyan-400 text-lg"></i>
  `;

  /*
    Ludo button.
  */

  const ludo =
    document.createElement("button");

  ludo.type = "button";

  ludo.id =
    "gameModeLudo";

  ludo.onclick =
    () => selectGameMode("ludo");

  ludo.innerHTML = `
    <div class="text-left">
      <div class="font-bold text-sm text-slate-100">
        Ludo 1v1
      </div>
      <div class="text-xs text-slate-400 mt-1">
        Dice strategy & token race
      </div>
    </div>
    <i class="fa-solid fa-dice text-emerald-400 text-lg"></i>
  `;

  selector.appendChild(penalty);

  selector.appendChild(ludo);

  /*
    Replace the old single card
    with the two game choices.
  */

  existingCard.replaceWith(
    selector
  );

  updateGameModeUI();
}

/* ==========================================================================
   13. SELECT GAME MODE
   ========================================================================== */

function selectGameMode(mode) {

  if (
    mode !== "penalty_shootout" &&
    mode !== "ludo"
  ) {

    mode =
      "penalty_shootout";
  }

  selectedGameMode =
    mode;

  updateGameModeUI();

  /*
    Reset the arena display.
  */

  const overlay =
    document.getElementById(
      "canvasOverlay"
    );

  if (overlay) {

    overlay.style.display =
      "flex";
  }

  const canvas =
    document.getElementById(
      "gameCanvas"
    );

  if (canvas) {

    canvas.onclick = null;

    const ctx =
      canvas.getContext("2d");

    if (ctx) {

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }
  }

  updateMatchOverlay();
}

/* ==========================================================================
   14. UPDATE GAME MODE UI
   ========================================================================== */

function updateGameModeUI() {

  const penalty =
    document.getElementById(
      "gameModePenalty"
    );

  const ludo =
    document.getElementById(
      "gameModeLudo"
    );

  const title =
    document.getElementById(
      "currentModeTitle"
    );

  if (selectedGameMode === "ludo") {

    if (penalty) {

      penalty.className =
        "p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between text-left hover:border-cyan-500/60 transition";
    }

    if (ludo) {

      ludo.className =
        "p-3.5 rounded-xl border border-emerald-500 bg-emerald-950/30 flex items-center justify-between text-left shadow-[0_0_15px_rgba(16,185,129,0.12)] transition";
    }

    if (title) {

      title.textContent =
        "Ludo 1v1";
    }

  } else {

    if (penalty) {

      penalty.className =
        "p-3.5 rounded-xl border border-cyan-500 bg-cyan-950/30 flex items-center justify-between text-left shadow-[0_0_15px_rgba(6,182,212,0.12)] transition";
    }

    if (ludo) {

      ludo.className =
        "p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between text-left hover:border-emerald-500/60 transition";
    }

    if (title) {

      title.textContent =
        "Penalty Shootout 1v1";
    }
  }
}

/* ==========================================================================
   15. UPDATE MATCH OVERLAY
   ========================================================================== */

function updateMatchOverlay() {

  const description =
    document.getElementById(
      "matchOverlayDesc"
    );

  if (!description) return;

  const prize =
    (
      selectedStake * 1.6
    ).toFixed(2);

  if (
    selectedGameMode === "ludo"
  ) {

    description.innerHTML =
      `Entry Stake: <strong class="text-cyan-400">$${selectedStake.toFixed(2)} USDT</strong>. ` +
      `Winner takes <strong class="text-emerald-400">$${prize} USDT</strong>. ` +
      `<br><span class="text-slate-500">Ludo 1v1 • First player to finish wins.</span>`;

  } else {

    description.innerHTML =
      `Entry Stake: <strong class="text-cyan-400">$${selectedStake.toFixed(2)} USDT</strong>. ` +
      `Winner takes <strong class="text-emerald-400">$${prize} USDT</strong> (20% rake).`;
  }
}

/* ==========================================================================
   END OF PART 1 OF 4
   ========================================================================== *//* ==========================================================================
   CYBERSTRIKE | SCRIPT.JS — PART 2 OF 4
   MATCHMAKING + PENALTY SHOOTOUT + LUDO ENGINE
   ========================================================================== */

/* ==========================================================================
   16. CYBER ALERT MODAL
   ========================================================================== */

function showCyberAlert(
  title,
  message,
  iconClass = "fa-gift text-cyan-400"
) {
  const titleElement =
    document.getElementById("cyberAlertTitle");

  const messageElement =
    document.getElementById("cyberAlertMessage");

  const iconElement =
    document.getElementById("cyberAlertIcon");

  if (titleElement) {
    titleElement.textContent = title;
  }

  if (messageElement) {
    messageElement.textContent = message;
  }

  if (iconElement) {
    iconElement.className =
      `fa-solid ${iconClass}`;
  }

  openModal("cyberAlertModal");
}

/* ==========================================================================
   17. OPEN / CLOSE MODALS
   ========================================================================== */

async function openModal(modalId) {

  const modal =
    document.getElementById(modalId);

  if (modalId === "withdrawModal") {

    try {

      if (supabaseClient) {

        const {
          data: { user }
        } = await supabaseClient.auth.getUser();

        if (user) {
          currentUser = user;
        }
      }

    } catch (error) {

      console.error(
        "User fetch error:",
        error
      );
    }

    const withdrawEmailInput =
      document.getElementById(
        "withdrawEmailInput"
      );

    if (
      withdrawEmailInput &&
      currentUser &&
      currentUser.email
    ) {

      withdrawEmailInput.value =
        currentUser.email;
    }

    const withdrawBalanceDisplay =
      document.getElementById(
        "withdrawBalanceDisplay"
      );

    if (withdrawBalanceDisplay) {

      const balance =
        Number(
          userProfile.balance || 0
        );

      withdrawBalanceDisplay.textContent =
        `${balance.toFixed(2)} USDT`;
    }
  }

  if (modal) {

    modal.classList.remove("hidden");
  }
}


function closeModal(modalId) {

  const modal =
    document.getElementById(modalId);

  if (modal) {

    modal.classList.add("hidden");
  }
}

/* ==========================================================================
   18. SELECT STAKE TIER
   ========================================================================== */

function selectStakeTier(stake) {

  selectedStake =
    Number(stake);

  [
    0.50,
    1.00,
    5.00
  ].forEach(tier => {

    const btn =
      document.getElementById(
        `stake-tier-${tier.toFixed(2)}`
      );

    if (!btn) return;

    if (
      tier === selectedStake
    ) {

      btn.className =
        "stake-tier-btn bg-cyan-500 text-slate-950 font-bold py-2 px-3 rounded text-sm shadow-glow transition-all";

    } else {

      btn.className =
        "stake-tier-btn bg-slate-800 border border-slate-700 hover:border-cyan-500 text-white font-bold py-2 px-3 rounded text-sm transition-all";
    }
  });

  const overviewStake =
    document.getElementById(
      "matchOverviewStake"
    );

  if (overviewStake) {

    overviewStake.innerHTML =
      `Entry Stake: <strong class="text-cyan-400">$${selectedStake.toFixed(2)} USDT</strong>`;
  }

  updateMatchOverlay();
}

/* ==========================================================================
   19. START MATCHMAKING
   ========================================================================== */

async function startMatchmaking() {

  if (!currentUser) {

    showCyberAlert(
      "LOGIN REQUIRED",
      "Please log in before entering the arena.",
      "fa-lock text-amber-400"
    );

    return;
  }

  if (!supabaseClient) {

    showCyberAlert(
      "CONNECTION ERROR",
      "Supabase connection unavailable.",
      "fa-triangle-exclamation text-rose-500"
    );

    return;
  }

  if (
    Number(userProfile.balance || 0)
    < selectedStake
  ) {

    showCyberAlert(
      "INSUFFICIENT BALANCE",
      `You need at least $${selectedStake.toFixed(2)} USDT to enter this match.`,
      "fa-wallet text-rose-400"
    );

    return;
  }

  try {

    showCyberAlert(
      "SEARCHING",
      `Searching for a ${selectedGameMode === "ludo" ? "Ludo" : "Penalty Shootout"} opponent...`,
      "fa-spinner fa-spin text-cyan-400"
    );

    const {
      data,
      error
    } =
      await supabaseClient.functions.invoke(
        "match",
        {
          body: {
            action: "START",
            stake: selectedStake,
            gameMode: selectedGameMode
          }
        }
      );

    if (error) {
      throw new Error(
        error.message ||
        "Match initialization failed."
      );
    }

    if (
      !data ||
      !data.success
    ) {

      throw new Error(
        data?.error ||
        data?.message ||
        "Could not start match."
      );
    }

    currentMatchId =
      data.matchId ||
      data.match_id ||
      null;

    closeModal(
      "cyberAlertModal"
    );

    showCyberAlert(
      "MATCH FOUND",
      "Opponent connected. Prepare for battle!",
      "fa-crosshairs text-cyan-400"
    );

    setTimeout(() => {

      closeModal(
        "cyberAlertModal"
      );

      if (
        selectedGameMode === "ludo"
      ) {

        startLudoGame();

      } else {

        startPenaltyShootout();
      }

    }, 1200);

  } catch (error) {

    console.error(
      "Matchmaking error:",
      error
    );

    showCyberAlert(
      "MATCHMAKING ERROR",
      error.message ||
      "Could not connect to match server.",
      "fa-triangle-exclamation text-rose-500"
    );
  }
}

/* ==========================================================================
   20. START PENALTY SHOOTOUT
   ========================================================================== */

function startPenaltyShootout() {

  const canvas =
    document.getElementById(
      "gameCanvas"
    );

  const overlay =
    document.getElementById(
      "canvasOverlay"
    );

  if (!canvas) {

    showCyberAlert(
      "GAME ERROR",
      "Game canvas element missing.",
      "fa-triangle-exclamation text-rose-500"
    );

    return;
  }

  matchActive = true;

  playerScore = 0;

  opponentScore = 0;

  if (overlay) {
    overlay.style.display = "none";
  }

  const ctx =
    canvas.getContext("2d");

  if (!ctx) return;

  canvas.onclick =
    handlePenaltyShot;

  drawPenaltyField(ctx);

  startPenaltyRound();
}

/* ==========================================================================
   21. DRAW PENALTY FIELD
   ========================================================================== */

function drawPenaltyField(ctx) {

  const width =
    ctx.canvas.width;

  const height =
    ctx.canvas.height;

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  /*
    Background
  */

  ctx.fillStyle =
    "#020617";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  /*
    Field area
  */

  ctx.fillStyle =
    "rgba(6,182,212,0.05)";

  ctx.fillRect(
    40,
    30,
    width - 80,
    height - 60
  );

  ctx.strokeStyle =
    "rgba(34,211,238,0.45)";

  ctx.lineWidth = 3;

  /*
    Goal
  */

  const goalWidth = 260;

  const goalHeight = 100;

  const goalX =
    (width - goalWidth) / 2;

  const goalY = 45;

  ctx.strokeRect(
    goalX,
    goalY,
    goalWidth,
    goalHeight
  );

  /*
    Penalty box
  */

  ctx.strokeRect(
    goalX - 70,
    goalY + goalHeight,
    goalWidth + 140,
    150
  );

  /*
    Penalty spot
  */

  ctx.beginPath();

  ctx.arc(
    width / 2,
    height - 115,
    7,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "rgba(255,255,255,0.8)";

  ctx.fill();

  /*
    Scoreboard
  */

  ctx.fillStyle =
    "#e2e8f0";

  ctx.font =
    "bold 24px Orbitron, sans-serif";

  ctx.textAlign = "center";

  ctx.fillText(
    `YOU ${playerScore}  -  ${opponentScore} OPPONENT`,
    width / 2,
    height - 35
  );
}

/* ==========================================================================
   22. START PENALTY ROUND
   ========================================================================== */

function startPenaltyRound() {

  if (!matchActive) return;

  const canvas =
    document.getElementById(
      "gameCanvas"
    );

  if (!canvas) return;

  const ctx =
    canvas.getContext("2d");

  drawPenaltyField(ctx);

  const centerX =
    canvas.width / 2;

  const goalkeeperY = 105;

  /*
    Goalkeeper
  */

  ctx.fillStyle =
    "rgba(16,185,129,0.85)";

  ctx.fillRect(
    centerX - 35,
    goalkeeperY,
    70,
    18
  );

  ctx.beginPath();

  ctx.arc(
    centerX,
    goalkeeperY - 12,
    10,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
    Ball
  */

  ctx.fillStyle =
    "#ffffff";

  ctx.beginPath();

  ctx.arc(
    centerX,
    canvas.height - 115,
    11,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
    Instruction
  */

  ctx.fillStyle =
    "#22d3ee";

  ctx.font =
    "bold 18px Rajdhani, sans-serif";

  ctx.textAlign =
    "center";

  ctx.fillText(
    "TAP INSIDE THE GOAL TO SHOOT",
    centerX,
    canvas.height - 70
  );

  canvas.onclick =
    handlePenaltyShot;
}

/* ==========================================================================
   23. HANDLE PENALTY SHOT
   ========================================================================== */

function handlePenaltyShot(event) {

  if (!matchActive) return;

  const canvas =
    document.getElementById(
      "gameCanvas"
    );

  if (!canvas) return;

  const rect =
    canvas.getBoundingClientRect();

  const scaleX =
    canvas.width /
    rect.width;

  const scaleY =
    canvas.height /
    rect.height;

  const x =
    (event.clientX - rect.left)
    * scaleX;

  const y =
    (event.clientY - rect.top)
    * scaleY;

  const goalLeft =
    (canvas.width - 260) / 2;

  const goalRight =
    goalLeft + 260;

  const goalTop = 45;

  const goalBottom = 145;

  const scored =
    x >= goalLeft &&
    x <= goalRight &&
    y >= goalTop &&
    y <= goalBottom;

  if (scored) {

    playerScore++;

    showCyberAlert(
      "GOAL!",
      "Target successfully hit!",
      "fa-futbol text-emerald-400"
    );

  } else {

    showCyberAlert(
      "MISS!",
      "The shot missed the goal frame.",
      "fa-xmark text-rose-500"
    );
  }

  /*
    Give the opponent a simple
    simulated result for this round.
  */

  if (Math.random() > 0.5) {
    opponentScore++;
  }

  setTimeout(() => {

    closeModal(
      "cyberAlertModal"
    );

    finish1v1Match();

  }, 800);
}

/* ==========================================================================
   24. START LUDO GAME
   ========================================================================== */

function startLudoGame() {

  const canvas =
    document.getElementById(
      "gameCanvas"
    );

  const overlay =
    document.getElementById(
      "canvasOverlay"
    );

  if (!canvas) {

    showCyberAlert(
      "GAME ERROR",
      "Game canvas element missing.",
      "fa-triangle-exclamation text-rose-500"
    );

    return;
  }

  matchActive = true;

  ludoGameOver = false;

  ludoPlayerTokens =
    [0, 0, 0, 0];

  ludoOpponentTokens =
    [0, 0, 0, 0];

  ludoPlayerHome = 0;

  ludoOpponentHome = 0;

  ludoTurn = "player";

  ludoDice = 0;

  ludoWaitingForToken = false;

  ludoLastMessage =
    "Your turn. Roll the dice.";

  playerScore = 0;

  opponentScore = 0;

  if (overlay) {
    overlay.style.display = "none";
  }

  buildLudoPaths();

  drawLudoBoard();

  canvas.onclick =
    handleLudoCanvasClick;
}

/* ==========================================================================
   25. BUILD LUDO PATHS
   ========================================================================== */

function buildLudoPaths() {

  const path = [];

  /*
    A simple 40-square circular
    Ludo-style track.
  */

  const cx = 600;

  const cy = 337;

  const radius = 235;

  for (
    let i = 0;
    i < 40;
    i++
  ) {

    const angle =
      (
        -Math.PI / 2
      ) +
      (
        i *
        (Math.PI * 2 / 40)
      );

    path.push({

      x:
        cx +
        Math.cos(angle) *
        radius,

      y:
        cy +
        Math.sin(angle) *
        radius
    });
  }

  ludoPlayerPath =
    path;

  ludoOpponentPath =
    path;
}

/* ==========================================================================
   26. DRAW LUDO BOARD
   ========================================================================== */

function drawLudoBoard() {

  const canvas =
    document.getElementById(
      "gameCanvas"
    );

  if (!canvas) return;

  const ctx =
    canvas.getContext("2d");

  if (!ctx) return;

  const width =
    canvas.width;

  const height =
    canvas.height;

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  /*
    Board background
  */

  ctx.fillStyle =
    "#020617";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  /*
    Board center
  */

  const cx = 600;

  const cy = 337;

  /*
    Outer board
  */

  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    270,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "#0f172a";

  ctx.fill();

  ctx.strokeStyle =
    "rgba(6,182,212,0.45)";

  ctx.lineWidth = 4;

  ctx.stroke();

  /*
    Home areas
  */

  drawLudoHomeArea(
    ctx,
    170,
    110,
    "rgba(6,182,212,0.12)",
    "YOU"
  );

  drawLudoHomeArea(
    ctx,
    850,
    110,
    "rgba(236,72,153,0.12)",
    "OPPONENT"
  );

  /*
    Track squares
  */

  ludoPlayerPath.forEach(
    (point, index) => {

      ctx.beginPath();

      ctx.arc(
        point.x,
        point.y,
        18,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        index % 5 === 0
          ? "rgba(34,211,238,0.18)"
          : "rgba(30,41,59,0.95)";

      ctx.fill();

      ctx.strokeStyle =
        "rgba(100,116,139,0.45)";

      ctx.lineWidth = 1;

      ctx.stroke();

      ctx.fillStyle =
        "#64748b";

      ctx.font =
        "10px Rajdhani, sans-serif";

      ctx.textAlign =
        "center";

      ctx.fillText(
        String(index + 1),
        point.x,
        point.y + 4
      );
    }
  );

  /*
    Draw tokens
  */

  drawLudoTokens(
    ctx
  );

  /*
    Center
  */

  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    75,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "rgba(15,23,42,0.95)";

  ctx.fill();

  ctx.strokeStyle =
    "rgba(16,185,129,0.55)";

  ctx.lineWidth = 3;

  ctx.stroke();

  /*
    Title
  */

  ctx.fillStyle =
    "#e2e8f0";

  ctx.font =
    "bold 24px Orbitron, sans-serif";

  ctx.textAlign =
    "center";

  ctx.fillText(
    "LUDO 1v1",
    cx,
    cy - 10
  );

  ctx.fillStyle =
    "#22d3ee";

  ctx.font =
    "bold 16px Rajdhani, sans-serif";

  ctx.fillText(
    `${ludoPlayerHome}/4 HOME`,
    cx,
    cy + 18
  );

  /*
    Dice display
  */

  drawLudoDice(
    ctx
  );

  /*
    Instructions
  */

  ctx.fillStyle =
    "#94a3b8";

  ctx.font =
    "16px Rajdhani, sans-serif";

  ctx.fillText(
    ludoLastMessage,
    cx,
    height - 25
  );
}

/* ==========================================================================
   27. DRAW LUDO HOME AREA
   ========================================================================== */

function drawLudoHomeArea(
  ctx,
  x,
  y,
  fill,
  label
) {

  ctx.fillStyle =
    fill;

  ctx.fillRect(
    x,
    y,
    280,
    130
  );

  ctx.strokeStyle =
    "rgba(100,116,139,0.4)";

  ctx.lineWidth = 2;

  ctx.strokeRect(
    x,
    y,
    280,
    130
  );

  ctx.fillStyle =
    "#cbd5e1";

  ctx.font =
    "bold 16px Orbitron, sans-serif";

  ctx.textAlign =
    "center";

  ctx.fillText(
    label,
    x + 140,
    y + 25
  );
}

/* ==========================================================================
   28. DRAW LUDO DICE
   ========================================================================== */

function drawLudoDice(ctx) {

  const x = 600;

  const y = 80;

  const size = 65;

  ctx.fillStyle =
    "#111827";

  ctx.fillRect(
    x - size / 2,
    y - size / 2,
    size,
    size
  );

  ctx.strokeStyle =
    "#22d3ee";

  ctx.lineWidth = 3;

  ctx.strokeRect(
    x - size / 2,
    y - size / 2,
    size,
    size
  );

  ctx.fillStyle =
    "#f8fafc";

  ctx.font =
    "bold 30px Orbitron, sans-serif";

  ctx.textAlign =
    "center";

  ctx.textBaseline =
    "middle";

  ctx.fillText(
    ludoDice
      ? String(ludoDice)
      : "🎲",
    x,
    y
  );

  ctx.textBaseline =
    "alphabetic";

  /*
    Roll button
  */

  ctx.fillStyle =
    ludoTurn === "player" &&
    !ludoWaitingForToken &&
    !ludoGameOver
      ? "#06b6d4"
      : "#334155";

  ctx.fillRect(
    x - 75,
    y + 45,
    150,
    40
  );

  ctx.fillStyle =
    ludoTurn === "player" &&
    !ludoWaitingForToken &&
    !ludoGameOver
      ? "#020617"
      : "#94a3b8";

  ctx.font =
    "bold 14px Orbitron, sans-serif";

  ctx.fillText(
    ludoTurn === "player" &&
    !ludoWaitingForToken &&
    !ludoGameOver
      ? "ROLL DICE"
      : ludoTurn === "opponent"
        ? "OPPONENT TURN"
        : "SELECT TOKEN",
    x,
    y + 71
  );
}

/* ==========================================================================
   END OF PART 2 OF 4
   ========================================================================== *//* ==========================================================================
   CYBERSTRIKE | SCRIPT.JS — PART 3 OF 4
   LUDO GAMEPLAY + MATCH RESOLUTION + VICTORY SPRINT
   ========================================================================== */

/* ==========================================================================
   29. DRAW LUDO TOKENS
   ========================================================================== */

function drawLudoTokens(ctx) {

  const path =
    ludoPlayerPath;

  /*
    PLAYER TOKENS
    */

  ludoPlayerTokens.forEach(
    (position, index) => {

      if (position <= 0) {

        /*
          Tokens still in base.
          Put them in the player's home area.
        */

        const basePositions = [
          { x: 235, y: 155 },
          { x: 315, y: 155 },
          { x: 235, y: 205 },
          { x: 315, y: 205 }
        ];

        drawLudoToken(
          ctx,
          basePositions[index].x,
          basePositions[index].y,
          "#22d3ee",
          index + 1
        );

      } else {

        const pathIndex =
          (position - 1) % path.length;

        const point =
          path[pathIndex];

        drawLudoToken(
          ctx,
          point.x,
          point.y,
          "#22d3ee",
          index + 1
        );
      }
    }
  );

  /*
    OPPONENT TOKENS
    */

  ludoOpponentTokens.forEach(
    (position, index) => {

      if (position <= 0) {

        const basePositions = [
          { x: 885, y: 155 },
          { x: 965, y: 155 },
          { x: 885, y: 205 },
          { x: 965, y: 205 }
        ];

        drawLudoToken(
          ctx,
          basePositions[index].x,
          basePositions[index].y,
          "#ec4899",
          index + 1
        );

      } else {

        const pathIndex =
          (position - 1) % path.length;

        const point =
          path[pathIndex];

        drawLudoToken(
          ctx,
          point.x,
          point.y,
          "#ec4899",
          index + 1
        );
      }
    }
  );
}

/* ==========================================================================
   30. DRAW SINGLE LUDO TOKEN
   ========================================================================== */

function drawLudoToken(
  ctx,
  x,
  y,
  color,
  number
) {

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    13,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    color;

  ctx.fill();

  ctx.strokeStyle =
    "#f8fafc";

  ctx.lineWidth = 2;

  ctx.stroke();

  ctx.fillStyle =
    "#020617";

  ctx.font =
    "bold 10px Rajdhani, sans-serif";

  ctx.textAlign =
    "center";

  ctx.fillText(
    String(number),
    x,
    y + 4
  );
}

/* ==========================================================================
   31. HANDLE LUDO CANVAS CLICK
   ========================================================================== */

function handleLudoCanvasClick(event) {

  if (!matchActive) return;

  if (ludoGameOver) return;

  if (ludoTurn !== "player") return;

  const canvas =
    document.getElementById(
      "gameCanvas"
    );

  if (!canvas) return;

  const rect =
    canvas.getBoundingClientRect();

  const scaleX =
    canvas.width /
    rect.width;

  const scaleY =
    canvas.height /
    rect.height;

  const x =
    (event.clientX - rect.left) *
    scaleX;

  const y =
    (event.clientY - rect.top) *
    scaleY;

  /*
    Check whether the player
    clicked the ROLL DICE button.
    */

  const diceX = 600;
  const diceY = 80;

  const rollLeft =
    diceX - 75;

  const rollRight =
    diceX + 75;

  const rollTop =
    diceY + 45;

  const rollBottom =
    diceY + 85;

  if (
    x >= rollLeft &&
    x <= rollRight &&
    y >= rollTop &&
    y <= rollBottom &&
    !ludoWaitingForToken
  ) {

    rollLudoDice();

    return;
  }

  /*
    If a token must be selected,
    detect which token was tapped.
    */

  if (ludoWaitingForToken) {

    const tokenIndex =
      findClickedLudoToken(
        x,
        y
      );

    if (
      tokenIndex !== -1
    ) {

      moveLudoPlayerToken(
        tokenIndex
      );
    }
  }
}

/* ==========================================================================
   32. FIND CLICKED LUDO TOKEN
   ========================================================================== */

function findClickedLudoToken(
  x,
  y
) {

  const canvas =
    document.getElementById(
      "gameCanvas"
    );

  if (!canvas) return -1;

  for (
    let i = 0;
    i < ludoPlayerTokens.length;
    i++
  ) {

    const position =
      ludoPlayerTokens[i];

    let tokenX;
    let tokenY;

    if (position <= 0) {

      const basePositions = [
        { x: 235, y: 155 },
        { x: 315, y: 155 },
        { x: 235, y: 205 },
        { x: 315, y: 205 }
      ];

      tokenX =
        basePositions[i].x;

      tokenY =
        basePositions[i].y;

    } else {

      const pathIndex =
        (position - 1) %
        ludoPlayerPath.length;

      tokenX =
        ludoPlayerPath[pathIndex].x;

      tokenY =
        ludoPlayerPath[pathIndex].y;
    }

    const distance =
      Math.sqrt(
        Math.pow(x - tokenX, 2) +
        Math.pow(y - tokenY, 2)
      );

    if (distance <= 30) {

      return i;
    }
  }

  return -1;
}

/* ==========================================================================
   33. ROLL LUDO DICE
   ========================================================================== */

function rollLudoDice() {

  if (!matchActive) return;

  if (ludoGameOver) return;

  if (ludoTurn !== "player") return;

  if (ludoWaitingForToken) return;

  ludoDice =
    Math.floor(
      Math.random() * 6
    ) + 1;

  ludoLastMessage =
    `You rolled ${ludoDice}.`;

  drawLudoBoard();

  /*
    Find legal moves.
    */

  const legalMoves =
    getLegalLudoMoves(
      ludoPlayerTokens,
      ludoDice
    );

  if (
    legalMoves.length === 0
  ) {

    ludoLastMessage =
      `You rolled ${ludoDice}, but there is no legal move.`;

    drawLudoBoard();

    setTimeout(() => {

      ludoTurn =
        "opponent";

      ludoLastMessage =
        "Opponent is thinking...";

      drawLudoBoard();

      setTimeout(
        playOpponentLudoTurn,
        900
      );

    }, 700);

    return;
  }

  /*
    If only one token can move,
    move it automatically.
    */

  if (
    legalMoves.length === 1
  ) {

    setTimeout(() => {

      moveLudoPlayerToken(
        legalMoves[0]
      );

    }, 350);

    return;
  }

  /*
    Otherwise let player choose
    a token.
    */

  ludoWaitingForToken =
    true;

  ludoLastMessage =
    "Tap one of your highlighted tokens.";

  drawLudoBoard();
}

/* ==========================================================================
   34. GET LEGAL LUDO MOVES
   ========================================================================== */

function getLegalLudoMoves(
  tokens,
  dice
) {

  const moves = [];

  tokens.forEach(
    (position, index) => {

      /*
        Token in base.
        Needs a 6 to enter.
      */

      if (position === 0) {

        if (dice === 6) {

          moves.push(index);
        }

        return;
      }

      /*
        Finished token cannot move.
      */

      if (position >= 40) {
        return;
      }

      /*
        Need exact count to finish.
      */

      if (
        position + dice <= 40
      ) {

        moves.push(index);
      }
    }
  );

  return moves;
}

/* ==========================================================================
   35. MOVE PLAYER LUDO TOKEN
   ========================================================================== */

function moveLudoPlayerToken(
  tokenIndex
) {

  if (!ludoWaitingForToken &&
      ludoDice === 0) {

    return;
  }

  const token =
    ludoPlayerTokens[tokenIndex];

  const dice =
    ludoDice;

  /*
    Verify move.
    */

  const legalMoves =
    getLegalLudoMoves(
      ludoPlayerTokens,
      dice
    );

  if (
    !legalMoves.includes(
      tokenIndex
    )
  ) {

    ludoLastMessage =
      "That token cannot move with this dice.";

    drawLudoBoard();

    return;
  }

  /*
    Bring token out of base
    on a six.
    */

  if (
    token === 0 &&
    dice === 6
  ) {

    ludoPlayerTokens[tokenIndex] =
      1;

  } else {

    ludoPlayerTokens[tokenIndex] =
      token + dice;
  }

  /*
    Check whether token reached home.
    */

  if (
    ludoPlayerTokens[tokenIndex] >= 40
  ) {

    ludoPlayerTokens[tokenIndex] =
      40;

    ludoPlayerHome++;

    ludoLastMessage =
      "Your token reached HOME!";

  } else {

    ludoLastMessage =
      `Token ${tokenIndex + 1} moved ${dice} spaces.`;
  }

  /*
    Capture opponent token.
    */

  checkLudoCapture(
    tokenIndex
  );

  ludoWaitingForToken =
    false;

  ludoDice = 0;

  /*
    Update score.
    */

  playerScore =
    ludoPlayerHome;

  /*
    Check victory.
    */

  if (
    ludoPlayerHome >= 4
  ) {

    finishLudoGame(
      true
    );

    return;
  }

  drawLudoBoard();

  /*
    A six gives another turn.
    */

  if (dice === 6) {

    ludoTurn =
      "player";

    ludoLastMessage =
      "You rolled a 6! Roll again.";

    drawLudoBoard();

    return;
  }

  /*
    Opponent turn.
    */

  ludoTurn =
    "opponent";

  ludoLastMessage =
    "Opponent is thinking...";

  drawLudoBoard();

  setTimeout(
    playOpponentLudoTurn,
    900
  );
}

/* ==========================================================================
   36. CHECK LUDO CAPTURE
   ========================================================================== */

function checkLudoCapture(
  tokenIndex
) {

  const playerPosition =
    ludoPlayerTokens[tokenIndex];

  if (
    playerPosition <= 0 ||
    playerPosition >= 40
  ) {

    return;
  }

  for (
    let i = 0;
    i < ludoOpponentTokens.length;
    i++
  ) {

    const opponentPosition =
      ludoOpponentTokens[i];

    if (
      opponentPosition > 0 &&
      opponentPosition < 40 &&
      opponentPosition ===
        playerPosition
    ) {

      /*
        Send opponent token
        back to base.
        */

      ludoOpponentTokens[i] =
        0;

      ludoLastMessage =
        `You captured opponent token ${i + 1}!`;

      break;
    }
  }
}

/* ==========================================================================
   37. OPPONENT LUDO TURN
   ========================================================================== */

function playOpponentLudoTurn() {

  if (!matchActive) return;

  if (ludoGameOver) return;

  if (
    ludoTurn !== "opponent"
  ) {

    return;
  }

  const dice =
    Math.floor(
      Math.random() * 6
    ) + 1;

  ludoDice =
    dice;

  const legalMoves =
    getLegalLudoMoves(
      ludoOpponentTokens,
      dice
    );

  /*
    No move.
    */

  if (
    legalMoves.length === 0
  ) {

    ludoLastMessage =
      `Opponent rolled ${dice}. No move.`;

    drawLudoBoard();

    setTimeout(() => {

      ludoDice = 0;

      ludoTurn =
        "player";

      ludoLastMessage =
        "Your turn. Roll the dice.";

      drawLudoBoard();

    }, 700);

    return;
  }

  /*
    Simple AI:
    Prefer a token already on
    the board, otherwise use
    the first legal token.
    */

  let selectedToken =
    legalMoves[0];

  for (
    let i = 0;
    i < legalMoves.length;
    i++
  ) {

    if (
      ludoOpponentTokens[
        legalMoves[i]
      ] > 0
    ) {

      selectedToken =
        legalMoves[i];

      break;
    }
  }

  const currentPosition =
    ludoOpponentTokens[
      selectedToken
    ];

  if (
    currentPosition === 0 &&
    dice === 6
  ) {

    ludoOpponentTokens[
      selectedToken
    ] = 1;

  } else {

    ludoOpponentTokens[
      selectedToken
    ] =
      currentPosition + dice;
  }

  /*
    Opponent reaches home.
    */

  if (
    ludoOpponentTokens[
      selectedToken
    ] >= 40
  ) {

    ludoOpponentTokens[
      selectedToken
    ] = 40;

    ludoOpponentHome++;

    ludoLastMessage =
      "Opponent reached HOME!";
  } else {

    ludoLastMessage =
      `Opponent rolled ${dice}.`;
  }

  /*
    Update opponent score.
    */

  opponentScore =
    ludoOpponentHome;

  /*
    Check if opponent won.
    */

  if (
    ludoOpponentHome >= 4
  ) {

    finishLudoGame(
      false
    );

    return;
  }

  drawLudoBoard();

  /*
    Six gives opponent another
    turn.
    */

  if (dice === 6) {

    setTimeout(() => {

      ludoDice = 0;

      ludoLastMessage =
        "Opponent rolled a 6 again.";

      drawLudoBoard();

      setTimeout(
        playOpponentLudoTurn,
        600
      );

    }, 600);

    return;
  }

  /*
    Return control to player.
    */

  setTimeout(() => {

    ludoDice = 0;

    ludoTurn =
      "player";

    ludoLastMessage =
      "Your turn. Roll the dice.";

    drawLudoBoard();

  }, 800);
}

/* ==========================================================================
   38. FINISH LUDO GAME
   ========================================================================== */

function finishLudoGame(
  playerWon
) {

  if (ludoGameOver) return;

  ludoGameOver =
    true;

  matchActive =
    false;

  playerScore =
    ludoPlayerHome;

  opponentScore =
    ludoOpponentHome;

  const message =
    playerWon
      ? "You got all 4 tokens home!"
      : "The opponent got all 4 tokens home.";

  showCyberAlert(
    playerWon
      ? "LUDO VICTORY!"
      : "LUDO DEFEAT",
    message,
    playerWon
      ? "fa-trophy text-emerald-400"
      : "fa-xmark text-rose-500"
  );

  setTimeout(() => {

    closeModal(
      "cyberAlertModal"
    );

    finish1v1Match();

  }, 1500);
}

/* ==========================================================================
   39. FINISH 1v1 MATCH
   ========================================================================== */

async function finish1v1Match() {

  if (
    !currentUser ||
    !supabaseClient
  ) {

    return;
  }

  if (
    selectedGameMode !== "ludo" &&
    !matchActive
  ) {

    /*
      Penalty Shootout sets
      matchActive false before
      calling this function.
      Allow resolution to continue.
      */

  }

  /*
    Prevent duplicate resolution.
    */

  const resolvingMatch =
    currentMatchId;

  if (!resolvingMatch) {

    console.warn(
      "No match ID available."
    );
  }

  try {

    showCyberAlert(
      "RESOLVING MATCH",
      "Calculating the match result...",
      "fa-spinner fa-spin text-cyan-400"
    );

    const {
      data,
      error
    } =
      await supabaseClient.functions.invoke(
        "match",
        {
          body: {
            action: "RESOLVE",

            matchId:
              currentMatchId,

            stake:
              selectedStake,

            gameMode:
              selectedGameMode,

            playerScore:
              playerScore,

            opponentScore:
              opponentScore
          }
        }
      );

    if (error) {

      throw new Error(
        error.message ||
        "Match resolution failed."
      );
    }

    if (
      !data ||
      !data.success
    ) {

      throw new Error(
        data?.error ||
        data?.message ||
        "Could not resolve match."
      );
    }

    await fetchUserProfile();

    const won =
      playerScore >
      opponentScore;

    const draw =
      playerScore ===
      opponentScore;

    let title =
      "MATCH COMPLETE";

    let message =
      data.message ||
      "Match resolution completed.";

    let icon =
      "fa-circle-info text-cyan-400";

    if (won) {

      title =
        "VICTORY!";

      icon =
        "fa-trophy text-emerald-400";

    } else if (draw) {

      title =
        "DRAW";

      icon =
        "fa-handshake text-amber-400";

    } else {

      title =
        "DEFEAT";

      icon =
        "fa-xmark text-rose-500";
    }

    showCyberAlert(
      title,
      message,
      icon
    );

    setTimeout(() => {

      closeModal(
        "cyberAlertModal"
      );

      const overlay =
        document.getElementById(
          "canvasOverlay"
        );

      if (overlay) {

        overlay.style.display =
          "flex";
      }

      currentMatchId =
        null;

      /*
        Reset canvas.
        */

      const canvas =
        document.getElementById(
          "gameCanvas"
        );

      if (canvas) {

        canvas.onclick = null;
      }

    }, 2200);

  } catch (error) {

    console.error(
      "Match resolution error:",
      error
    );

    showCyberAlert(
      "MATCH ERROR",
      error.message ||
      "Resolution failure.",
      "fa-triangle-exclamation text-rose-500"
    );
  }
}

/* ==========================================================================
   40. WEEKLY SPRINT PROGRESS
   ========================================================================== */

function updateSprintProgress() {

  const wins =
    Number(
      userProfile.sprint_wins || 0
    );

  const winsDisplay =
    document.getElementById(
      "sprintWinsCount"
    );

  const progressBar =
    document.getElementById(
      "sprintProgressBar"
    );

  const nextRewardLabel =
    document.getElementById(
      "nextRewardLabel"
    );

  if (winsDisplay) {

    winsDisplay.textContent =
      wins;
  }

  let nextTarget = 20;

  let nextReward = 2.00;

  if (
    wins >= 20 &&
    wins < 50
  ) {

    nextTarget = 50;

    nextReward = 5.00;

  } else if (
    wins >= 50 &&
    wins < 100
  ) {

    nextTarget = 100;

    nextReward = 10.00;

  } else if (
    wins >= 100 &&
    wins < 1000
  ) {

    nextTarget = 1000;

    nextReward = 100.00;

  } else if (
    wins >= 1000
  ) {

    nextTarget = 1000;

    nextReward = 100.00;
  }

  if (progressBar) {

    const percentage =
      Math.min(
        (
          wins /
          nextTarget
        ) * 100,
        100
      );

    progressBar.style.width =
      `${percentage}%`;
  }

  if (nextRewardLabel) {

    if (wins >= 1000) {

      nextRewardLabel.textContent =
        "MAX MILESTONES CLAIMED";

    } else {

      nextRewardLabel.textContent =
        `NEXT REWARD: ${nextReward.toFixed(2)} USDT`;
    }
  }

  updateMilestoneButtons();
}

/* ==========================================================================
   41. UPDATE MILESTONE BUTTONS
   ========================================================================== */

function updateMilestoneButtons() {

  const wins =
    Number(
      userProfile.sprint_wins || 0
    );

  const claimed =
    Array.isArray(
      userProfile.claimed_milestones
    )
      ? userProfile.claimed_milestones
      : [];

  const milestones = [

    {
      id: "claim20Btn",
      wins: 20
    },

    {
      id: "claim50Btn",
      wins: 50
    },

    {
      id: "claim100Btn",
      wins: 100
    },

    {
      id: "claim1000Btn",
      wins: 1000
    }

  ];

  milestones.forEach(
    milestone => {

      const button =
        document.getElementById(
          milestone.id
        );

      if (!button) return;

      const isClaimed =
        claimed.includes(
          milestone.wins
        );

      if (isClaimed) {

        button.disabled =
          true;

        button.textContent =
          "CLAIMED";

        button.className =
          "sprint-claim-btn claimed-glowing";

      } else if (
        wins >= milestone.wins
      ) {

        button.disabled =
          false;

        button.textContent =
          "CLAIM";

        button.className =
          "sprint-claim-btn ready";

      } else {

        button.disabled =
          true;

        button.textContent =
          "LOCKED";

        button.className =
          "sprint-claim-btn locked";
      }
    }
  );
}

/* ==========================================================================
   42. CLAIM MILESTONE
   ========================================================================== */

