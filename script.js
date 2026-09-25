/* ==========================================================================
   CYBERSTRIKE | 1v1 USDT ARENA
   SCRIPT.JS — PART 1 OF 4
   ========================================================================== */


/* ==========================================================================
   1. SUPABASE CONFIGURATION
   ========================================================================== */

const SUPABASE_URL =
  "https://btugwhcoypxtlgmsxqci.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable__DjyCoKhrV9vpmAUY-T3lg_0f-Ji2-h";

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
    const {
      data: {
        session
      }
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
});


/* ==========================================================================
   5. AUTH STATE LISTENER
   ========================================================================== */

if (supabaseClient) {

  supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

      console.log(
        "Auth event:",
        event
      );

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
    appContainer.style.display = "block";
  }

  updateBalanceDisplay();
  updateSprintProgress();
  setupDepositListener();
}


/* ==========================================================================
   8. LOAD USER PROFILE
   ========================================================================== */

async function fetchUserProfile() {

  if (!supabaseClient || !currentUser) {
    return;
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
      balance: Number(data.balance || 0),
      sprint_wins: Number(data.sprint_wins || 0),
      claimed_milestones:
        Array.isArray(data.claimed_milestones)
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
      `${balance.toFixed(2)} USDT`;
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
   10. LOGIN
   ========================================================================== */

async function handleLogin() {

  const emailInput =
    document.getElementById("loginEmail");

  const passwordInput =
    document.getElementById("loginPassword");

  const message =
    document.getElementById("authMessage");

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
    }

    return;
  }

  if (!supabaseClient) {

    if (message) {
      message.textContent =
        "Supabase connection is not available.";
    }

    return;
  }

  try {

    if (message) {
      message.textContent =
        "CONNECTING TO CYBERSTRIKE...";
    }

    const {
      data,
      error
    } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {

      /*
        If login fails, try creating the account.
        This keeps the current CYBERSTRIKE login flow.
      */

      const signup =
        await supabaseClient.auth.signUp({
          email,
          password
        });

      if (signup.error) {
        throw error;
      }

      if (message) {
        message.textContent =
          "ACCOUNT CREATED. PLEASE CHECK YOUR EMAIL IF CONFIRMATION IS REQUIRED.";
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

    console.error(
      "Login error:",
      error
    );

    if (message) {
      message.textContent =
        error.message ||
        "Login failed. Please try again.";
    }
  }
}


/* ==========================================================================
   11. LOGOUT
   ========================================================================== */

async function logout() {

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

  showLoginScreen();
}


/* ==========================================================================
   END OF PART 1 OF 4
   ========================================================================== *//* ==========================================================================
   CYBERSTRIKE | SCRIPT.JS — PART 2 OF 4
   ========================================================================== */


/* ==========================================================================
   12. CYBER ALERT
   ========================================================================== */

function showCyberAlert(title, message, iconClass = "") {

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

  if (iconElement && iconClass) {
    iconElement.className =
      `fas ${iconClass}`;
  }

  const alertElement =
    document.getElementById("cyberAlert");

  if (alertElement) {
    alertElement.classList.remove("hidden");
  }
}


/* ==========================================================================
   13. OPEN / CLOSE MODALS
   ========================================================================== */

function openModal(modalId) {

  const modal =
    document.getElementById(modalId);

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
   14. SELECT GAME MODE
   ========================================================================== */

function selectGameMode(mode) {

  selectedGameMode = mode;

  document
    .querySelectorAll("[id^='mode-']")
    .forEach(card => {
      card.classList.remove(
        "border-cyan-400",
        "border-emerald-400"
      );
    });

  const selectedCard =
    document.getElementById(
      `mode-${mode}`
    );

  if (selectedCard) {
    selectedCard.classList.add(
      "border-cyan-400"
    );
  }

  console.log(
    "Selected game mode:",
    selectedGameMode
  );
}


/* ==========================================================================
   15. SELECT STAKE
   ========================================================================== */

function selectStakeTier(stake) {

  selectedStake =
    Number(stake);

  document
    .querySelectorAll("[data-stake]")
    .forEach(button => {

      button.classList.remove(
        "border-cyan-400",
        "bg-cyan-500/20"
      );
    });

  const selectedButton =
    document.querySelector(
      `[data-stake="${selectedStake}"]`
    );

  if (selectedButton) {
    selectedButton.classList.add(
      "border-cyan-400",
      "bg-cyan-500/20"
    );
  }

  console.log(
    "Selected stake:",
    selectedStake
  );
}


/* ==========================================================================
   16. START MATCHMAKING
   ========================================================================== */

async function startMatchmaking() {

  if (!currentUser) {
    showCyberAlert(
      "LOGIN REQUIRED",
      "Please log in before entering the arena."
    );
    return;
  }

  if (!supabaseClient) {
    showCyberAlert(
      "CONNECTION ERROR",
      "Supabase is not connected."
    );
    return;
  }

  try {

    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();

    if (!session) {
      throw new Error(
        "Your login session has expired."
      );
    }

    showCyberAlert(
      "SEARCHING",
      "Searching for an opponent...",
      "fa-spinner fa-spin text-cyan-400"
    );

    const response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/match`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization":
              `Bearer ${session.access_token}`,
            "apikey":
              SUPABASE_ANON_KEY
          },

          body: JSON.stringify({
            action: "START",
            stake: selectedStake,
            gameMode: selectedGameMode
          })
        }
      );

    const rawText =
      await response.text();

    let result = {};

    try {
      result =
        rawText
          ? JSON.parse(rawText)
          : {};
    } catch {
      result = {
        error:
          rawText ||
          "Invalid server response."
      };
    }

    if (!response.ok) {
      throw new Error(
        result.error ||
        result.message ||
        `Match server returned HTTP ${response.status}.`
      );
    }

    if (!result.success) {
      throw new Error(
        result.error ||
        result.message ||
        "Could not start matchmaking."
      );
    }

    currentMatchId =
      result.matchId ||
      result.match_id ||
      null;

    closeModal("cyberAlert");

    showCyberAlert(
      "MATCH FOUND",
      "Opponent connected. Prepare for battle!",
      "fa-crosshairs text-cyan-400"
    );

    setTimeout(() => {
      closeModal("cyberAlert");
      startPenaltyShootout();
    }, 1200);

  } catch (error) {

    console.error(
      "Matchmaking error:",
      error
    );

    showCyberAlert(
      "MATCHMAKING ERROR",
      error.message ||
      "Could not connect to matchmaking server.",
      "fa-triangle-exclamation text-rose-500"
    );
  }
}


/* ==========================================================================
   17. PENALTY SHOOTOUT GAME
   ========================================================================== */

function startPenaltyShootout() {

  const canvas =
    document.getElementById("gameCanvas");

  const overlay =
    document.getElementById("canvasOverlay");

  if (!canvas) {
    showCyberAlert(
      "GAME ERROR",
      "Game canvas was not found."
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

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  drawPenaltyField(ctx);

  startPenaltyRound();
}


/* ==========================================================================
   18. DRAW PENALTY FIELD
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
    Penalty area
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
    Center line
  */

  ctx.beginPath();

  ctx.moveTo(
    0,
    height / 2
  );

  ctx.lineTo(
    width,
    height / 2
  );

  ctx.strokeStyle =
    "rgba(34,211,238,0.15)";

  ctx.stroke();
}


/* ==========================================================================
   19. START PENALTY ROUND
   ========================================================================== */

function startPenaltyRound() {

  if (!matchActive) return;

  const canvas =
    document.getElementById("gameCanvas");

  if (!canvas) return;

  const ctx =
    canvas.getContext("2d");

  drawPenaltyField(ctx);

  /*
    Draw goalkeeper
  */

  const centerX =
    canvas.width / 2;

  const goalkeeperY = 105;

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
    "white";

  ctx.beginPath();

  ctx.arc(
    centerX,
    canvas.height - 115,
    11,
    0,
    Math.PI * 2
  );

  ctx.fill();

  canvas.onclick =
    handlePenaltyShot;
}


/* ==========================================================================
   20. HANDLE PENALTY SHOT
   ========================================================================== */

function handlePenaltyShot(event) {

  if (!matchActive) return;

  const canvas =
    document.getElementById("gameCanvas");

  if (!canvas) return;

  const rect =
    canvas.getBoundingClientRect();

  const scaleX =
    canvas.width / rect.width;

  const scaleY =
    canvas.height / rect.height;

  const x =
    (event.clientX - rect.left) *
    scaleX;

  const y =
    (event.clientY - rect.top) *
    scaleY;

  /*
    Goal boundaries
  */

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
      "Perfect shot!",
      "fa-futbol text-emerald-400"
    );

  } else {

    showCyberAlert(
      "MISS!",
      "The shot missed the target.",
      "fa-xmark text-rose-500"
    );
  }

  setTimeout(() => {

    closeModal("cyberAlert");

    finish1v1Match();

  }, 800);
}


/* ==========================================================================
   END OF PART 2 OF 4
   ========================================================================== *//* ==========================================================================
   CYBERSTRIKE | SCRIPT.JS — PART 3 OF 4
   ========================================================================== */


/* ==========================================================================
   21. FINISH 1v1 MATCH
   ========================================================================== */

async function finish1v1Match() {

  if (!currentUser || !matchActive) {
    return;
  }

  matchActive = false;

  try {

    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();

    if (!session) {
      throw new Error(
        "Your login session has expired."
      );
    }

    showCyberAlert(
      "RESOLVING MATCH",
      "Calculating match result...",
      "fa-spinner fa-spin text-cyan-400"
    );

    const response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/match`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization":
              `Bearer ${session.access_token}`,
            "apikey":
              SUPABASE_ANON_KEY
          },

          body: JSON.stringify({
            action: "RESOLVE",
            matchId: currentMatchId,
            stake: selectedStake,
            playerScore: playerScore,
            opponentScore: opponentScore
          })
        }
      );

    const rawText =
      await response.text();

    let result = {};

    try {
      result =
        rawText
          ? JSON.parse(rawText)
          : {};
    } catch {
      result = {
        error:
          rawText ||
          "Invalid server response."
      };
    }

    if (!response.ok) {
      throw new Error(
        result.error ||
        result.message ||
        `Match server returned HTTP ${response.status}.`
      );
    }

    if (!result.success) {
      throw new Error(
        result.error ||
        result.message ||
        "Could not resolve the match."
      );
    }

    /*
      Refresh real balance and sprint data.
    */

    await fetchUserProfile();

    const won =
      playerScore > opponentScore;

    const draw =
      playerScore === opponentScore;

    let title = "MATCH COMPLETE";
    let message = "The match has been resolved.";

    if (won) {
      title = "VICTORY";
      message =
        result.message ||
        "You won the match!";
    } else if (draw) {
      title = "DRAW";
      message =
        result.message ||
        "The match ended in a draw.";
    } else {
      title = "DEFEAT";
      message =
        result.message ||
        "Your opponent won this match.";
    }

    showCyberAlert(
      title,
      message,
      won
        ? "fa-trophy text-emerald-400"
        : "fa-circle-info text-cyan-400"
    );

    setTimeout(() => {

      closeModal("cyberAlert");

      const overlay =
        document.getElementById(
          "canvasOverlay"
        );

      if (overlay) {
        overlay.style.display = "flex";
      }

    }, 1800);

  } catch (error) {

    console.error(
      "Match resolution error:",
      error
    );

    showCyberAlert(
      "MATCH ERROR",
      error.message ||
      "Could not resolve the match.",
      "fa-triangle-exclamation text-rose-500"
    );

    matchActive = false;
  }
}


/* ==========================================================================
   22. WEEKLY SPRINT PROGRESS
   ========================================================================== */

function updateSprintProgress() {

  const wins =
    Number(userProfile.sprint_wins || 0);

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

    const percentage =
      Math.min(
        (wins / nextTarget) * 100,
        100
      );

    progressBar.style.width =
      `${percentage}%`;
  }

  if (nextRewardLabel) {

    if (wins >= 1000) {

      nextRewardLabel.textContent =
        "ALL MILESTONES REACHED";

    } else {

      nextRewardLabel.textContent =
        `NEXT REWARD: ${nextReward.toFixed(2)} USDT`;
    }
  }

  updateMilestoneButtons();
}


/* ==========================================================================
   23. UPDATE MILESTONE BUTTONS
   ========================================================================== */

function updateMilestoneButtons() {

  const wins =
    Number(userProfile.sprint_wins || 0);

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

      const alreadyClaimed =
        claimed.includes(
          milestone.wins
        );

      if (alreadyClaimed) {

        button.disabled = true;
        button.textContent = "CLAIMED";

      } else if (
        wins >= milestone.wins
      ) {

        button.disabled = false;
        button.textContent = "CLAIM";

      } else {

        button.disabled = true;
        button.textContent = "LOCKED";
      }
    }
  );
}


/* ==========================================================================
   24. CLAIM MILESTONE
   ========================================================================== */

async function claimMilestone(
  targetWins,
  rewardAmount
) {

  if (!currentUser) {

    showCyberAlert(
      "NOT LOGGED IN",
      "Please log in before claiming a milestone."
    );

    return;
  }

  const wins =
    Number(userProfile.sprint_wins || 0);

  const claimed =
    Array.isArray(
      userProfile.claimed_milestones
    )
      ? userProfile.claimed_milestones
      : [];

  if (wins < targetWins) {

    showCyberAlert(
      "MILESTONE LOCKED",
      `You need ${targetWins} wins to claim this reward.`
    );

    return;
  }

  if (claimed.includes(targetWins)) {

    showCyberAlert(
      "ALREADY CLAIMED",
      "This milestone has already been claimed."
    );

    return;
  }

  try {

    showCyberAlert(
      "PROCESSING",
      "Verifying your milestone reward...",
      "fa-spinner fa-spin text-cyan-400"
    );

    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();

    if (!session) {
      throw new Error(
        "Your login session has expired."
      );
    }

    const response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/milestone`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization":
              `Bearer ${session.access_token}`,
            "apikey":
              SUPABASE_ANON_KEY
          },

          body: JSON.stringify({
            targetWins,
            rewardAmount
          })
        }
      );

    const rawText =
      await response.text();

    let result = {};

    try {
      result =
        rawText
          ? JSON.parse(rawText)
          : {};
    } catch {
      result = {
        error:
          rawText ||
          "Invalid server response."
      };
    }

    if (!response.ok) {

      throw new Error(
        result.error ||
        result.message ||
        `Server returned HTTP ${response.status}.`
      );
    }

    if (!result.success) {

      throw new Error(
        result.error ||
        result.message ||
        "Milestone reward was rejected."
      );
    }

    await fetchUserProfile();

    showCyberAlert(
      "REWARD CLAIMED",
      `${Number(rewardAmount).toFixed(2)} USDT has been added to your balance.`,
      "fa-circle-check text-emerald-400"
    );

  } catch (error) {

    console.error(
      "Milestone claim error:",
      error
    );

    showCyberAlert(
      "CLAIM FAILED",
      error.message ||
      "Could not process milestone reward.",
      "fa-triangle-exclamation text-rose-500"
    );
  }
}


/* ==========================================================================
   END OF PART 3 OF 4
   ========================================================================== *//* ==========================================================================
   CYBERSTRIKE | SCRIPT.JS — PART 4 OF 4
   ========================================================================== */


/* ==========================================================================
   25. WITHDRAWAL / FAUCETPAY PAYOUT
   ========================================================================== */

async function confirmWithdrawal() {

  const amountInput =
    document.getElementById("withdrawAmountInput");

  const emailInput =
    document.getElementById("withdrawEmailInput");

  const amount =
    parseFloat(
      amountInput
        ? amountInput.value
        : 0
    );

  const recipientEmail =
    emailInput
      ? emailInput.value.trim()
      : "";


  if (!currentUser) {

    showCyberAlert(
      "LOGIN REQUIRED",
      "Please log in before withdrawing."
    );

    return;
  }


  if (!recipientEmail) {

    showCyberAlert(
      "MISSING EMAIL",
      "Please enter your FaucetPay account email."
    );

    return;
  }


  if (!recipientEmail.includes("@")) {

    showCyberAlert(
      "INVALID EMAIL",
      "Please enter a valid FaucetPay email address."
    );

    return;
  }


  if (!amount || amount < 0.50) {

    showCyberAlert(
      "INVALID CASHOUT",
      "Minimum withdrawal is 0.50 USDT."
    );

    return;
  }


  if (
    amount >
    Number(userProfile.balance || 0)
  ) {

    showCyberAlert(
      "INSUFFICIENT BALANCE",
      "You cannot withdraw more than your current balance."
    );

    return;
  }


  try {

    showCyberAlert(
      "PROCESSING",
      "Sending payout request...",
      "fa-spinner fa-spin text-cyan-400"
    );


    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();


    if (
      !session ||
      !session.access_token
    ) {

      throw new Error(
        "Your login session has expired. Please log in again."
      );
    }


    const response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/withdraw`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${session.access_token}`,

            "apikey":
              SUPABASE_ANON_KEY
          },

          body: JSON.stringify({
            amount:
              Number(amount),

            recipientEmail:
              recipientEmail
          })
        }
      );


    /*
      Read the response as TEXT first.
      This lets us see the real server error.
    */

    const rawText =
      await response.text();


    console.log(
      "Withdrawal HTTP status:",
      response.status
    );

    console.log(
      "Withdrawal server response:",
      rawText
    );


    let result = {};


    try {

      result =
        rawText
          ? JSON.parse(rawText)
          : {};

    } catch {

      result = {
        error:
          rawText ||
          "Server returned an unreadable response."
      };
    }


    if (!response.ok) {

      throw new Error(
        result.error ||
        result.message ||
        `Payout server returned HTTP ${response.status}.`
      );
    }


    if (!result.success) {

      throw new Error(
        result.error ||
        result.message ||
        "Payout request was rejected."
      );
    }


    /*
      Payment succeeded.
      Reload the real balance from Supabase.
    */

    await fetchUserProfile();


    if (amountInput) {
      amountInput.value = "";
    }

    if (emailInput) {
      emailInput.value = "";
    }


    closeModal(
      "withdrawModal"
    );


    showCyberAlert(
      "CASHOUT SUCCESSFUL",
      `Payout of ${amount.toFixed(2)} USDT was dispatched successfully.`,
      "fa-circle-check text-emerald-400"
    );


  } catch (error) {

    console.error(
      "WITHDRAWAL ERROR:",
      error
    );


    /*
      IMPORTANT:
      This now shows the REAL backend error
      instead of only saying CONNECTION ERROR.
    */

    showCyberAlert(
      "PAYOUT ERROR",
      error.message ||
      "Could not connect to the payout server.",
      "fa-triangle-exclamation text-rose-500"
    );
  }
}


/* ==========================================================================
   26. DEPOSIT LISTENER
   ========================================================================== */

function setupDepositListener() {

  if (
    !supabaseClient ||
    !currentUser
  ) {
    return;
  }


  try {

    supabaseClient
      .channel(
        `profile-${currentUser.id}`
      )
      .on(
        "postgres_changes",

        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",

          filter:
            `id=eq.${currentUser.id}`
        },

        payload => {

          console.log(
            "Profile update:",
            payload
          );


          if (payload.new) {

            userProfile.balance =
              Number(
                payload.new.balance || 0
              );


            if (
              payload.new.sprint_wins !==
              undefined
            ) {

              userProfile.sprint_wins =
                Number(
                  payload.new.sprint_wins || 0
                );
            }


            if (
              payload.new.claimed_milestones !==
              undefined
            ) {

              userProfile.claimed_milestones =
                Array.isArray(
                  payload.new.claimed_milestones
                )
                  ? payload.new.claimed_milestones
                  : [];
            }


            updateBalanceDisplay();

            updateSprintProgress();
          }
        }
      )
      .subscribe(status => {

        console.log(
          "Profile listener:",
          status
        );
      });

  } catch (error) {

    console.error(
      "Profile listener error:",
      error
    );
  }
}


/* ==========================================================================
   27. DEPOSIT CONFIRMATION
   ========================================================================== */

async function confirmDeposit() {

  const amountInput =
    document.getElementById(
      "depositAmountInput"
    );

  const amount =
    parseFloat(
      amountInput
        ? amountInput.value
        : 0
    );


  if (!currentUser) {

    showCyberAlert(
      "LOGIN REQUIRED",
      "Please log in before making a deposit."
    );

    return;
  }


  if (!amount || amount < 0.50) {

    showCyberAlert(
      "INVALID DEPOSIT",
      "Minimum deposit is 0.50 USDT."
    );

    return;
  }


  /*
    IMPORTANT:
    No demo balance is created here.

    Deposits are handled by the FaucetPay
    merchant payment flow already connected
    to the HTML.
  */

  const userIdField =
    document.getElementById(
      "custom_user_id"
    );


  if (userIdField) {

    userIdField.value =
      currentUser.id;
  }


  console.log(
    "Deposit prepared:",
    amount
  );
}


/* ==========================================================================
   28. WEEKLY SPRINT COUNTDOWN
   ========================================================================== */

function initSprintCountdown() {

  const countdown =
    document.getElementById(
      "sprintCountdown"
    );

  if (!countdown) {
    return;
  }


  function updateCountdown() {

    const now =
      new Date();

    const day =
      now.getDay();

    const daysUntilMonday =
      day === 0
        ? 1
        : 8 - day;


    const nextMonday =
      new Date(now);

    nextMonday.setDate(
      now.getDate() +
      daysUntilMonday
    );

    nextMonday.setHours(
      0,
      0,
      0,
      0
    );


    const difference =
      nextMonday.getTime() -
      now.getTime();


    if (difference <= 0) {
      countdown.textContent =
        "00:00:00";
      return;
    }


    const totalSeconds =
      Math.floor(
        difference / 1000
      );


    const days =
      Math.floor(
        totalSeconds / 86400
      );

    const hours =
      Math.floor(
        (totalSeconds % 86400) /
        3600
      );

    const minutes =
      Math.floor(
        (totalSeconds % 3600) /
        60
      );

    const seconds =
      totalSeconds % 60;


    countdown.textContent =
      `${days}d ` +
      `${String(hours).padStart(2, "0")}:` +
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;
  }


  updateCountdown();

  setInterval(
    updateCountdown,
    1000
  );
}


/* ==========================================================================
   29. PAYMENT REDIRECT CHECK
   ========================================================================== */

function checkPaymentRedirect() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const payment =
    params.get("payment");


  if (
    payment === "success"
  ) {

    showCyberAlert(
      "PAYMENT RECEIVED",
      "Your deposit payment was received. Your balance will update after confirmation.",
      "fa-circle-check text-emerald-400"
    );
  }


  if (
    payment === "cancelled"
  ) {

    showCyberAlert(
      "PAYMENT CANCELLED",
      "The deposit payment was cancelled."
    );
  }
}


/* ==========================================================================
   30. CLOSE ALERT WHEN CLICKED
   ========================================================================== */

document.addEventListener(
  "click",
  event => {

    const alertBox =
      document.getElementById(
        "cyberAlert"
      );

    if (
      alertBox &&
      event.target === alertBox
    ) {

      alertBox.classList.add(
        "hidden"
      );
    }
  }
);


/* ==========================================================================
   END OF SCRIPT.JS — PART 4 OF 4
   ========================================================================== */
