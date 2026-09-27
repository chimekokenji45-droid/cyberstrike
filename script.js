/* ============================================================
   CYBERSTRIKE — 1v1 COMPETITIVE ARENA
   SCRIPT.JS — PART 1 OF 5
   ============================================================ */

"use strict";

/* ============================================================
   1. SUPABASE CONFIGURATION
   ============================================================ */

const SUPABASE_URL = "https://btugwhcoypxtlgmsxqci.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__DjyCoKhrV9vpmAUY-T3lg_0f-Ji2-h";

let supabaseClient = null;


/* ============================================================
   2. GLOBAL PLAYER STATE
   ============================================================ */

let currentUser = null;

let playerBalance = 0;

let weeklyWins = 0;

let weeklySprintStartedAt = null;

let weeklyWeekKey = null;

let selectedGame = "Penalty Shootout";

let selectedStake = 0.50;

let walletLoading = false;

let countdownTimer = null;


/* ============================================================
   3. PENALTY SHOOTOUT STATE
   ============================================================ */

let penaltyMatchId = null;

let penaltyRoundActive = false;

let penaltyTimeLeft = 15;

let penaltyTimer = null;

let penaltyPlayerScore = 0;

let penaltyOpponentScore = 0;

let penaltyActionLocked = false;


/* ============================================================
   4. CYBERSTRIKE SETTINGS
   ============================================================ */

const CYBERSTRIKE_GAMES = [
    "Penalty Shootout",
    "Ludo Race",
    "Chess",
    "Fighting"
];

const CYBERSTRIKE_STAKES = [
    0.50,
    1.00,
    2.00,
    5.00
];

const PLATFORM_FEE_PERCENT = 20;

const CURRENCY = "USDT";

const MIN_DEPOSIT = 0.50;

const MIN_WITHDRAWAL = 0.50;


/* ============================================================
   5. EDGE FUNCTIONS
   ============================================================ */

const DEPOSIT_FUNCTION_NAME =
    "cyberstrike-deposit";

const WITHDRAW_FUNCTION_NAME =
    "cyberstrike-withdraw";

const MATCHMAKING_FUNCTION_NAME =
    "cyberstrike-matchmaking";

const MILESTONE_FUNCTION_NAME =
    "cyberstrike-milestone";

/*
   This function must exist on Supabase before real
   Penalty Shootout matches can be securely played.
*/

const PENALTY_ACTION_FUNCTION_NAME =
    "cyberstrike-penalty-action";


/* ============================================================
   6. INITIALIZE SUPABASE
   ============================================================ */

function initializeSupabase() {

    if (
        typeof window.supabase === "undefined"
    ) {
        console.error(
            "Supabase library was not loaded."
        );

        showMessage(
            "Supabase library failed to load.",
            "error"
        );

        return false;
    }

    if (
        SUPABASE_URL === "YOUR_SUPABASE_URL" ||
        SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY"
    ) {
        console.warn(
            "Supabase URL and anon key still need to be configured."
        );

        return false;
    }

    try {

        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            );

        console.log(
            "CYBERSTRIKE Supabase initialized."
        );

        return true;

    } catch (error) {

        console.error(
            "Supabase initialization failed:",
            error
        );

        return false;
    }
}


/* ============================================================
   7. PAGE INITIALIZATION
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "CYBERSTRIKE loading..."
        );

        initializeSupabase();

        if (!supabaseClient) {
            return;
        }

        setupAuthListener();

        await checkCurrentSession();

        startWeeklyCountdown();

        updateSelectedGameDisplay();

        updateSelectedStakeDisplay();

        updatePayoutDisplay();

    }
);


/* ============================================================
   8. AUTH STATE LISTENER
   ============================================================ */

function setupAuthListener() {

    if (!supabaseClient) {
        return;
    }

    supabaseClient.auth.onAuthStateChange(
        async function (event, session) {

            console.log(
                "Auth event:",
                event
            );

            if (session && session.user) {

                currentUser = session.user;

                await loadPlayerData();

                showDashboard();

            } else {

                currentUser = null;

                resetLocalWalletState();

                showLoginScreen();
            }

        }
    );
}


/* ============================================================
   9. CHECK EXISTING SESSION
   ============================================================ */

async function checkCurrentSession() {

    if (!supabaseClient) {
        return;
    }

    try {

        const result =
            await supabaseClient.auth.getSession();

        const session =
            result.data
                ? result.data.session
                : null;

        if (session && session.user) {

            currentUser = session.user;

            console.log(
                "Existing CYBERSTRIKE session found."
            );

            await loadPlayerData();

            showDashboard();

        } else {

            showLoginScreen();

        }

    } catch (error) {

        console.error(
            "Session check failed:",
            error
        );

        showLoginScreen();
    }
}


/* ============================================================
   10. LOGIN
   ============================================================ */

async function loginUser(
    email,
    password
) {

    if (!supabaseClient) {

        showMessage(
            "Supabase is not connected.",
            "error"
        );

        return false;
    }

    email =
        String(email || "")
            .trim();

    password =
        String(password || "");

    if (!email || !password) {

        showAuthMessage(
            "Enter your email and password."
        );

        return false;
    }

    showAuthMessage(
        "Connecting to CYBERSTRIKE..."
    );

    try {

        const result =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (result.error) {

            console.error(
                "Login error:",
                result.error
            );

            showAuthMessage(
                result.error.message ||
                "Login failed."
            );

            return false;
        }

        currentUser =
            result.data.user;

        await loadPlayerData();

        showDashboard();

        showMessage(
            "Login successful.",
            "success"
        );

        return true;

    } catch (error) {

        console.error(
            "Login exception:",
            error
        );

        showAuthMessage(
            error.message ||
            "Unable to login."
        );

        return false;
    }
}


/* ============================================================
   11. REGISTER
   ============================================================ */

async function registerUser(
    email,
    password
) {

    if (!supabaseClient) {

        showAuthMessage(
            "Supabase is not connected."
        );

        return false;
    }

    email =
        String(email || "")
            .trim();

    password =
        String(password || "");

    if (!email || !password) {

        showAuthMessage(
            "Enter an email and password."
        );

        return false;
    }

    if (password.length < 6) {

        showAuthMessage(
            "Password must contain at least 6 characters."
        );

        return false;
    }

    showAuthMessage(
        "Creating your CYBERSTRIKE account..."
    );

    try {

        const result =
            await supabaseClient.auth.signUp({
                email: email,
                password: password
            });

        if (result.error) {

            console.error(
                "Registration error:",
                result.error
            );

            showAuthMessage(
                result.error.message ||
                "Registration failed."
            );

            return false;
        }

        if (result.data.user) {

            currentUser =
                result.data.user;

            /*
              Player profile creation can be handled
              by your Supabase database trigger.
            */

            await loadPlayerData();

            showDashboard();

            showMessage(
                "Account created successfully.",
                "success"
            );
        }

        return true;

    } catch (error) {

        console.error(
            "Registration exception:",
            error
        );

        showAuthMessage(
            error.message ||
            "Unable to create account."
        );

        return false;
    }
}


/* ============================================================
   12. LOGOUT
   ============================================================ */

async function logoutUser() {

    if (!supabaseClient) {
        return;
    }

    try {

        await supabaseClient.auth.signOut();

        currentUser = null;

        resetLocalWalletState();

        showLoginScreen();

    } catch (error) {

        console.error(
            "Logout failed:",
            error
        );
    }
}


/* ============================================================
   13. LOAD PLAYER DATA
   ============================================================ */

async function loadPlayerData() {

    if (!supabaseClient || !currentUser) {
        return;
    }

    try {

        const result =
            await supabaseClient
                .from("players")
                .select(
                    "id,email,balance,weekly_wins,weekly_sprint_started_at"
                )
                .eq(
                    "id",
                    currentUser.id
                )
                .maybeSingle();

        if (result.error) {

            console.error(
                "Player data error:",
                result.error
            );

            /*
              Do NOT create demo money.

              If the player row is missing, balance
              remains zero until the real database
              profile is created.
            */

            playerBalance = 0;

            weeklyWins = 0;

            weeklySprintStartedAt = null;

            updateDashboard();

            return;
        }

        if (!result.data) {

            console.warn(
                "No player profile found."
            );

            playerBalance = 0;

            weeklyWins = 0;

            weeklySprintStartedAt = null;

            updateDashboard();

            return;
        }

        const player =
            result.data;

        playerBalance =
            Number(player.balance || 0);

        weeklyWins =
            Number(player.weekly_wins || 0);

        weeklySprintStartedAt =
            player.weekly_sprint_started_at || null;

        console.log(
            "Player data loaded:",
            {
                balance: playerBalance,
                weeklyWins: weeklyWins
            }
        );

        updateDashboard();

    } catch (error) {

        console.error(
            "Failed to load player data:",
            error
        );

        playerBalance = 0;

        weeklyWins = 0;

        updateDashboard();
    }
}


/* ============================================================
   14. UPDATE DASHBOARD
   ============================================================ */

function updateDashboard() {

    updateBalanceDisplay();

    updatePlayerEmail();

    updateWeeklySprint();

    updateMilestoneButtons();

    updateSelectedGameDisplay();

    updateSelectedStakeDisplay();

    updatePayoutDisplay();
}


/* ============================================================
   15. BALANCE DISPLAY
   ============================================================ */

function updateBalanceDisplay() {

    const elements =
        document.querySelectorAll(
            "#userBalanceDisplay"
        );

    elements.forEach(
        function (element) {

            element.textContent =
                Number(playerBalance || 0)
                    .toFixed(2) +
                " USDT";

        }
    );
}


/* ============================================================
   16. PLAYER EMAIL DISPLAY
   ============================================================ */

function updatePlayerEmail() {

    if (!currentUser) {
        return;
    }

    const elements =
        document.querySelectorAll(
            "#userEmailDisplay"
        );

    elements.forEach(
        function (element) {

            element.textContent =
                currentUser.email || "";

        }
    );
}


/* ============================================================
   17. RESET LOCAL WALLET STATE
   ============================================================ */

function resetLocalWalletState() {

    playerBalance = 0;

    weeklyWins = 0;

    weeklySprintStartedAt = null;

    weeklyWeekKey = null;

    penaltyMatchId = null;

    penaltyRoundActive = false;

    penaltyTimeLeft = 15;

    penaltyPlayerScore = 0;

    penaltyOpponentScore = 0;

    stopPenaltyTimer();

    updateBalanceDisplay();
}


/* ============================================================
   18. GET PLAYER BALANCE
   ============================================================ */

function getPlayerBalance() {

    return Number(
        playerBalance || 0
    );
}


/* ============================================================
   19. CALCULATE WINNER PAYOUT
   ============================================================ */

function calculateWinnerPayout(
    stake
) {

    const amount =
        Number(stake || 0);

    const totalPot =
        amount * 2;

    const platformFee =
        totalPot *
        (PLATFORM_FEE_PERCENT / 100);

    const winnerPayout =
        totalPot -
        platformFee;

    return Number(
        winnerPayout.toFixed(2)
    );
}


/* ============================================================
   20. SELECT GAME
   ============================================================ */

function selectGame(game) {

    if (
        !CYBERSTRIKE_GAMES.includes(game)
    ) {
        return;
    }

    selectedGame = game;

    updateSelectedGameDisplay();

    updatePayoutDisplay();

    console.log(
        "Selected game:",
        selectedGame
    );
}


/* ============================================================
   21. SELECT STAKE
   ============================================================ */

function selectStake(
    button,
    amount
) {

    const stake =
        Number(amount);

    if (
        !CYBERSTRIKE_STAKES.includes(stake)
    ) {
        return;
    }

    selectedStake = stake;

    document
        .querySelectorAll(".stake")
        .forEach(
            function (item) {

                item.classList.remove(
                    "active"
                );

            }
        );

    if (button) {

        button.classList.add(
            "active"
        );
    }

    updateSelectedStakeDisplay();

    updatePayoutDisplay();
}


/* ============================================================
   22. SELECTED GAME DISPLAY
   ============================================================ */

function updateSelectedGameDisplay() {

    const elements =
        document.querySelectorAll(
            "#selectedGameDisplay"
        );

    elements.forEach(
        function (element) {

            element.textContent =
                selectedGame;

        }
    );
}


/* ============================================================
   23. SELECTED STAKE DISPLAY
   ============================================================ */

function updateSelectedStakeDisplay() {

    const elements =
        document.querySelectorAll(
            "#selectedStakeDisplay"
        );

    elements.forEach(
        function (element) {

            element.textContent =
                Number(selectedStake)
                    .toFixed(2) +
                " USDT";

        }
    );
}/* ============================================================
   CYBERSTRIKE — SCRIPT.JS
   PART 2 OF 5
   WEEKLY SPRINT + DASHBOARD + MATCHMAKING
   ============================================================ */


/* ============================================================
   24. FIXED CALENDAR WEEK
   MONDAY 00:00 → SUNDAY 23:59
   ============================================================ */

function getMondayStart(date = new Date()) {

    const d = new Date(date);

    d.setHours(0, 0, 0, 0);

    const day = d.getDay();

    /*
      Sunday = 0
      Monday = 1
      Tuesday = 2
      ...
      Saturday = 6
    */

    const daysSinceMonday =
        day === 0 ? 6 : day - 1;

    d.setDate(
        d.getDate() - daysSinceMonday
    );

    return d;
}


/* ============================================================
   25. GET NEXT MONDAY
   ============================================================ */

function getNextMondayStart(date = new Date()) {

    const monday =
        getMondayStart(date);

    const nextMonday =
        new Date(monday);

    nextMonday.setDate(
        nextMonday.getDate() + 7
    );

    return nextMonday;
}


/* ============================================================
   26. WEEK KEY
   ============================================================ */

function getCurrentWeekKey(date = new Date()) {

    const monday =
        getMondayStart(date);

    const year =
        monday.getFullYear();

    const month =
        String(
            monday.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            monday.getDate()
        ).padStart(2, "0");

    return (
        year +
        "-" +
        month +
        "-" +
        day
    );
}


/* ============================================================
   27. WEEKLY SPRINT INFORMATION
   ============================================================ */

function getWeeklySprintInfo() {

    const now =
        new Date();

    const monday =
        getMondayStart(now);

    const nextMonday =
        getNextMondayStart(now);

    const weekKey =
        getCurrentWeekKey(now);

    const totalMilliseconds =
        nextMonday.getTime() -
        monday.getTime();

    const remainingMilliseconds =
        Math.max(
            0,
            nextMonday.getTime() -
            now.getTime()
        );

    return {

        weekKey: weekKey,

        start: monday,

        end: nextMonday,

        totalMilliseconds:
            totalMilliseconds,

        remainingMilliseconds:
            remainingMilliseconds
    };
}


/* ============================================================
   28. UPDATE WEEKLY SPRINT
   ============================================================ */

function updateWeeklySprint() {

    const sprint =
        getWeeklySprintInfo();

    weeklyWeekKey =
        sprint.weekKey;

    /*
      IMPORTANT:

      The browser only displays the current
      calendar week.

      Actual weekly-win reset and milestone
      eligibility must still be verified by
      the Supabase backend.
    */

    const wins =
        Number(
            weeklyWins || 0
        );

    const weeklyWinsElements =
        document.querySelectorAll(
            "#weeklyWins"
        );

    weeklyWinsElements.forEach(
        function (element) {

            element.textContent =
                wins.toString();

        }
    );


    /* --------------------------------------------------------
       PROGRESS
       -------------------------------------------------------- */

    let progressPercent = 0;

    if (wins >= 1000) {

        progressPercent = 100;

    } else {

        progressPercent =
            Math.min(
                100,
                (wins / 1000) * 100
            );
    }


    const progressElements =
        document.querySelectorAll(
            "#weeklyProgressPercent"
        );

    progressElements.forEach(
        function (element) {

            element.textContent =
                Math.floor(
                    progressPercent
                ) +
                "%";

        }
    );


    const bars =
        document.querySelectorAll(
            "#weeklyProgressBar"
        );

    bars.forEach(
        function (bar) {

            bar.style.width =
                progressPercent +
                "%";

        }
    );


    /* --------------------------------------------------------
       NEXT REWARD
       -------------------------------------------------------- */

    let nextRewardText =
        "NEXT REWARD: 2.00 USDT";

    if (wins >= 1000) {

        nextRewardText =
            "ALL WEEKLY REWARDS REACHED";

    } else if (wins >= 100) {

        nextRewardText =
            "NEXT REWARD: 100.00 USDT";

    } else if (wins >= 50) {

        nextRewardText =
            "NEXT REWARD: 10.00 USDT";

    } else if (wins >= 20) {

        nextRewardText =
            "NEXT REWARD: 5.00 USDT";
    }


    const rewardLabels =
        document.querySelectorAll(
            "#nextRewardLabel"
        );

    rewardLabels.forEach(
        function (element) {

            element.textContent =
                nextRewardText;

        }
    );


    updateCountdownDisplay();
}


/* ============================================================
   29. UPDATE MILESTONE BUTTONS
   ============================================================ */

function updateMilestoneButtons() {

    updateMilestoneButton(
        "claim20Btn",
        20
    );

    updateMilestoneButton(
        "claim50Btn",
        50
    );

    updateMilestoneButton(
        "claim100Btn",
        100
    );

    updateMilestoneButton(
        "claim1000Btn",
        1000
    );
}


/* ============================================================
   30. MILESTONE BUTTON STATE
   ============================================================ */

function updateMilestoneButton(
    elementId,
    requiredWins
) {

    const button =
        document.getElementById(
            elementId
        );

    if (!button) {
        return;
    }

    const wins =
        Number(
            weeklyWins || 0
        );

    if (wins >= requiredWins) {

        button.disabled = false;

        button.classList.add(
            "milestone-ready"
        );

    } else {

        button.disabled = true;

        button.classList.remove(
            "milestone-ready"
        );
    }
}


/* ============================================================
   31. CLAIM WEEKLY MILESTONE
   ============================================================ */

async function claimMilestone(
    requiredWins,
    rewardAmount
) {

    if (!currentUser) {

        showMessage(
            "Please login first.",
            "error"
        );

        return;
    }

    const wins =
        Number(
            weeklyWins || 0
        );

    if (wins < requiredWins) {

        showMessage(
            "You need " +
            requiredWins +
            " verified wins first.",
            "error"
        );

        return;
    }

    showMessage(
        "Verifying milestone...",
        "info"
    );

    try {

        const result =
            await supabaseClient.functions.invoke(
                MILESTONE_FUNCTION_NAME,
                {
                    body: {

                        user_id:
                            currentUser.id,

                        required_wins:
                            requiredWins,

                        reward_amount:
                            rewardAmount,

                        week_key:
                            getCurrentWeekKey()
                    }
                }
            );

        if (result.error) {

            console.error(
                "Milestone error:",
                result.error
            );

            showMessage(
                getFunctionErrorMessage(
                    result.error
                ),
                "error"
            );

            return;
        }

        const data =
            result.data || {};

        if (
            data.success === false
        ) {

            showMessage(
                data.message ||
                "Milestone could not be claimed.",
                "error"
            );

            return;
        }

        showMessage(
            data.message ||
            (
                "Milestone claimed: +" +
                Number(rewardAmount)
                    .toFixed(2) +
                " USDT"
            ),
            "success"
        );

        await loadPlayerData();

    } catch (error) {

        console.error(
            "Milestone exception:",
            error
        );

        showMessage(
            error.message ||
            "Milestone request failed.",
            "error"
        );
    }
}


/* ============================================================
   32. START WEEKLY COUNTDOWN
   ============================================================ */

function startWeeklyCountdown() {

    if (countdownTimer) {

        clearInterval(
            countdownTimer
        );
    }

    updateCountdownDisplay();

    countdownTimer =
        setInterval(
            function () {

                updateCountdownDisplay();

            },
            1000
        );
}


/* ============================================================
   33. COUNTDOWN DISPLAY
   ============================================================ */

function updateCountdownDisplay() {

    const sprint =
        getWeeklySprintInfo();

    const remaining =
        sprint.remainingMilliseconds;

    const totalSeconds =
        Math.max(
            0,
            Math.floor(
                remaining / 1000
            )
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


    const formatted =
        String(days) +
        "D " +
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");


    const countdownElements =
        document.querySelectorAll(
            "#countdown"
        );

    countdownElements.forEach(
        function (element) {

            element.textContent =
                formatted;

        }
    );


    /*
      When Monday arrives, refresh player data.

      This does NOT award or reset anything locally.
      The backend remains authoritative.
    */

    if (
        remaining <= 1000
    ) {

        setTimeout(
            async function () {

                if (currentUser) {

                    await loadPlayerData();

                }

            },
            1500
        );
    }
}


/* ============================================================
   34. SHOW LOGIN SCREEN
   ============================================================ */

function showLoginScreen() {

    const authGate =
        document.getElementById(
            "authGate"
        );

    const appContainer =
        document.getElementById(
            "appContainer"
        );

    if (authGate) {

        authGate.style.display =
            "flex";

    }

    if (appContainer) {

        appContainer.style.display =
            "none";

    }
}


/* ============================================================
   35. SHOW DASHBOARD
   ============================================================ */

function showDashboard() {

    const authGate =
        document.getElementById(
            "authGate"
        );

    const appContainer =
        document.getElementById(
            "appContainer"
        );

    if (authGate) {

        authGate.style.display =
            "none";

    }

    if (appContainer) {

        appContainer.style.display =
            "block";

    }

    updateDashboard();
}


/* ============================================================
   36. AUTH MESSAGE
   ============================================================ */

function showAuthMessage(
    message
) {

    const element =
        document.getElementById(
            "authMessage"
        );

    if (element) {

        element.textContent =
            message;
    }

    console.log(
        "AUTH:",
        message
    );
}


/* ============================================================
   37. GENERAL MESSAGE
   ============================================================ */

function showMessage(
    message,
    type = "info"
) {

    const element =
        document.getElementById(
            "cyberMessage"
        );

    if (element) {

        element.textContent =
            message;

        element.className =
            "cyber-message " +
            type;

        element.style.display =
            "block";

        setTimeout(
            function () {

                element.style.display =
                    "none";

            },
            5000
        );

    } else {

        console.log(
            "[" +
            type.toUpperCase() +
            "] " +
            message
        );
    }
}


/* ============================================================
   38. FIND OPPONENT
   ============================================================ */

async function findOpponent() {

    if (!currentUser) {

        showMessage(
            "Please login first.",
            "error"
        );

        return;
    }

    const stake =
        Number(selectedStake);

    if (
        !CYBERSTRIKE_STAKES.includes(
            stake
        )
    ) {

        showMessage(
            "Invalid stake amount.",
            "error"
        );

        return;
    }

    if (
        playerBalance < stake
    ) {

        showMessage(
            "Insufficient USDT balance.",
            "error"
        );

        return;
    }


    /*
      The browser does NOT deduct the stake.

      The matchmaking Edge Function must:
      1. Verify the user.
      2. Verify balance.
      3. Lock/deduct the stake.
      4. Create or join a match.
      5. Return the secure match information.
    */

    showMessage(
        "Searching for an opponent...",
        "info"
    );


    try {

        const result =
            await supabaseClient.functions.invoke(
                MATCHMAKING_FUNCTION_NAME,
                {
                    body: {

                        game:
                            selectedGame,

                        stake:
                            stake,

                        currency:
                            CURRENCY

                    }
                }
            );


        if (result.error) {

            console.error(
                "Matchmaking error:",
                result.error
            );

            showMessage(
                getFunctionErrorMessage(
                    result.error
                ),
                "error"
            );

            return;
        }


        const data =
            result.data || {};


        if (data.success === false) {

            showMessage(
                data.message ||
                "Unable to find an opponent.",
                "error"
            );

            return;
        }


        /*
          Refresh wallet because the server
          may have locked the stake.
        */

        await loadPlayerData();


        /*
          Save match ID if returned.
        */

        if (data.match_id) {

            penaltyMatchId =
                data.match_id;
        }


        /*
          If Penalty Shootout has been matched,
          launch the secure game screen.
        */

        if (
            selectedGame ===
            "Penalty Shootout"
        ) {

            startPenaltyShootout(
                data
            );

            return;
        }


        showMessage(
            data.message ||
            "Opponent found.",
            "success"
        );


    } catch (error) {

        console.error(
            "Matchmaking exception:",
            error
        );

        showMessage(
            error.message ||
            "Matchmaking failed.",
            "error"
        );
    }
}


/* ============================================================
   39. HANDLE LOGOUT
   ============================================================ */

async function handleLogout() {

    await logoutUser();
}


/* ============================================================
   40. LOGIN FORM SUPPORT
   ============================================================ */

async function handleLogin() {

    const emailInput =
        document.getElementById(
            "loginEmail"
        );

    const passwordInput =
        document.getElementById(
            "loginPassword"
        );

    if (!emailInput || !passwordInput) {

        showAuthMessage(
            "Login fields were not found."
        );

        return;
    }

    await loginUser(
        emailInput.value,
        passwordInput.value
    );
}


/* ============================================================
   41. ENTER KEY LOGIN
   ============================================================ */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key !== "Enter"
        ) {
            return;
        }

        const activeElement =
            document.activeElement;

        if (
            activeElement &&
            (
                activeElement.id ===
                "loginEmail" ||
                activeElement.id ===
                "loginPassword"
            )
        ) {

            handleLogin();
        }
    }
);


/* ============================================================
   END OF PART 2
   ============================================================ *//* ============================================================
   CYBERSTRIKE — SCRIPT.JS
   PART 3 OF 5
   WALLET + DEPOSIT + WITHDRAWAL
   ============================================================ */


/* ============================================================
   42. UPDATE POTENTIAL PAYOUT
   ============================================================ */

function updatePayoutDisplay() {

    const payout =
        calculateWinnerPayout(
            selectedStake
        );

    const elements =
        document.querySelectorAll(
            "#potentialPayout"
        );

    elements.forEach(
        function (element) {

            element.textContent =
                payout.toFixed(2) +
                " USDT";

        }
    );
}


/* ============================================================
   43. OPEN DEPOSIT MODAL
   ============================================================ */

function openDepositModal() {

    if (!currentUser) {

        showMessage(
            "Please login first.",
            "error"
        );

        return;
    }

    removeWalletModal();

    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "cyberDepositModal";

    modal.className =
        "cyber-wallet-modal";


    modal.innerHTML = `
        <div class="cyber-wallet-box">

            <button
                type="button"
                class="cyber-close-wallet"
                onclick="closeWalletModal()"
            >
                ×
            </button>

            <div class="cyber-wallet-title">
                DEPOSIT USDT
            </div>

            <div class="cyber-wallet-subtitle">
                Secure CYBERSTRIKE Deposit
            </div>

            <label class="cyber-wallet-label">
                AMOUNT
            </label>

            <input
                id="depositAmount"
                class="cyber-wallet-input"
                type="number"
                min="0.50"
                step="0.50"
                placeholder="0.50"
            >

            <div class="cyber-wallet-info">
                Minimum deposit:
                <strong>0.50 USDT</strong>
            </div>

            <div
                id="depositStatus"
                class="cyber-wallet-status"
            ></div>

            <button
                type="button"
                class="cyber-wallet-primary"
                onclick="createDeposit()"
            >
                CONTINUE TO PAYMENT
            </button>

            <button
                type="button"
                class="cyber-wallet-secondary"
                onclick="closeWalletModal()"
            >
                CANCEL
            </button>

            <div class="cyber-wallet-note">
                Your balance is credited only after
                the payment is verified by the server.
            </div>

        </div>
    `;

    document.body.appendChild(
        modal
    );
}


/* ============================================================
   44. CREATE DEPOSIT
   ============================================================ */

async function createDeposit() {

    if (!currentUser) {

        showMessage(
            "Please login first.",
            "error"
        );

        return;
    }


    const input =
        document.getElementById(
            "depositAmount"
        );

    if (!input) {
        return;
    }


    const amount =
        Number(input.value);


    if (
        !Number.isFinite(amount) ||
        amount < MIN_DEPOSIT
    ) {

        setWalletStatus(
            "Minimum deposit is 0.50 USDT.",
            "error"
        );

        return;
    }


    const roundedAmount =
        Number(
            amount.toFixed(2)
        );


    setWalletStatus(
        "Creating secure payment...",
        "loading"
    );


    try {

        const result =
            await supabaseClient.functions.invoke(
                DEPOSIT_FUNCTION_NAME,
                {
                    body: {

                        amount:
                            roundedAmount,

                        currency:
                            CURRENCY

                    }
                }
            );


        if (result.error) {

            console.error(
                "Deposit function error:",
                result.error
            );

            setWalletStatus(
                getFunctionErrorMessage(
                    result.error
                ),
                "error"
            );

            return;
        }


        const data =
            result.data || {};


        if (
            data.success === false
        ) {

            setWalletStatus(
                data.message ||
                "Deposit could not be created.",
                "error"
            );

            return;
        }


        /*
          The backend should return the hosted
          payment URL.

          We accept several common field names
          so the frontend is flexible.
        */

        const paymentUrl =
            data.checkout_url ||
            data.payment_url ||
            data.redirect_url ||
            data.url;


        if (!paymentUrl) {

            console.error(
                "Deposit response:",
                data
            );

            setWalletStatus(
                "Payment link was not returned by the server.",
                "error"
            );

            return;
        }


        setWalletStatus(
            "Opening secure payment...",
            "success"
        );


        /*
          Open payment in the current browser tab.
          This avoids popup blocking on mobile.
        */

        window.location.href =
            paymentUrl;


    } catch (error) {

        console.error(
            "Deposit exception:",
            error
        );

        setWalletStatus(
            error.message ||
            "Deposit request failed.",
            "error"
        );
    }
}


/* ============================================================
   45. OPEN WITHDRAW MODAL
   ============================================================ */

function openWithdrawModal() {

    if (!currentUser) {

        showMessage(
            "Please login first.",
            "error"
        );

        return;
    }


    removeWalletModal();


    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "cyberWithdrawModal";

    modal.className =
        "cyber-wallet-modal";


    modal.innerHTML = `
        <div class="cyber-wallet-box">

            <button
                type="button"
                class="cyber-close-wallet"
                onclick="closeWalletModal()"
            >
                ×
            </button>

            <div class="cyber-wallet-title">
                CASHOUT WINNINGS
            </div>

            <div class="cyber-wallet-subtitle">
                FaucetPay USDT Withdrawal
            </div>

            <div class="cyber-wallet-balance">
                AVAILABLE:
                <strong>
                    ${Number(playerBalance || 0).toFixed(2)}
                    USDT
                </strong>
            </div>

            <label class="cyber-wallet-label">
                AMOUNT
            </label>

            <input
                id="withdrawAmount"
                class="cyber-wallet-input"
                type="number"
                min="0.50"
                step="0.50"
                placeholder="0.50"
            >

            <label class="cyber-wallet-label">
                FAUCETPAY DESTINATION
            </label>

            <input
                id="withdrawDestination"
                class="cyber-wallet-input"
                type="text"
                placeholder="Your FaucetPay destination"
            >

            <div class="cyber-wallet-warning">
                Make sure your destination is correct.
                Withdrawals are processed by the secure
                CYBERSTRIKE server.
            </div>

            <div
                id="withdrawStatus"
                class="cyber-wallet-status"
            ></div>

            <button
                type="button"
                class="cyber-wallet-primary"
                onclick="requestWithdrawal()"
            >
                REQUEST CASHOUT
            </button>

            <button
                type="button"
                class="cyber-wallet-secondary"
                onclick="closeWalletModal()"
            >
                CANCEL
            </button>

        </div>
    `;


    document.body.appendChild(
        modal
    );
}


/* ============================================================
   46. REQUEST WITHDRAWAL
   ============================================================ */

async function requestWithdrawal() {

    if (!currentUser) {

        showMessage(
            "Please login first.",
            "error"
        );

        return;
    }


    const amountInput =
        document.getElementById(
            "withdrawAmount"
        );

    const destinationInput =
        document.getElementById(
            "withdrawDestination"
        );


    if (
        !amountInput ||
        !destinationInput
    ) {

        return;
    }


    const amount =
        Number(
            amountInput.value
        );


    const destination =
        String(
            destinationInput.value || ""
        ).trim();


    if (
        !Number.isFinite(amount) ||
        amount < MIN_WITHDRAWAL
    ) {

        setWalletStatus(
            "Minimum withdrawal is 0.50 USDT.",
            "error"
        );

        return;
    }


    if (
        amount >
        Number(playerBalance || 0)
    ) {

        setWalletStatus(
            "Insufficient available balance.",
            "error"
        );

        return;
    }


    if (!destination) {

        setWalletStatus(
            "Enter your FaucetPay destination.",
            "error"
        );

        return;
    }


    const roundedAmount =
        Number(
            amount.toFixed(2)
        );


    setWalletStatus(
        "Submitting secure withdrawal...",
        "loading"
    );


    try {

        const result =
            await supabaseClient.functions.invoke(
                WITHDRAW_FUNCTION_NAME,
                {
                    body: {

                        amount:
                            roundedAmount,

                        destination:
                            destination,

                        currency:
                            CURRENCY

                    }
                }
            );


        if (result.error) {

            console.error(
                "Withdrawal function error:",
                result.error
            );

            setWalletStatus(
                getFunctionErrorMessage(
                    result.error
                ),
                "error"
            );

            return;
        }


        const data =
            result.data || {};


        if (
            data.success === false
        ) {

            setWalletStatus(
                data.message ||
                "Withdrawal failed.",
                "error"
            );

            return;
        }


        /*
          The server must deduct/lock the funds
          atomically before sending the payout.
        */

        setWalletStatus(
            data.message ||
            "Withdrawal submitted successfully.",
            "success"
        );


        await loadPlayerData();


        setTimeout(
            function () {

                closeWalletModal();

            },
            1800
        );


    } catch (error) {

        console.error(
            "Withdrawal exception:",
            error
        );

        setWalletStatus(
            error.message ||
            "Withdrawal request failed.",
            "error"
        );
    }
}


/* ============================================================
   47. FUNCTION ERROR MESSAGE
   ============================================================ */

function getFunctionErrorMessage(
    error
) {

    if (!error) {

        return "Request failed.";
    }


    if (
        error.context &&
        error.context.body
    ) {

        try {

            if (
                typeof error.context.body ===
                "string"
            ) {

                return error.context.body;
            }

        } catch (_) {

            // Ignore parsing problem.
        }
    }


    if (error.message) {

        return error.message;
    }


    return "Request failed. Please try again.";
}


/* ============================================================
   48. WALLET STATUS
   ============================================================ */

function setWalletStatus(
    message,
    type = "info"
) {

    const depositStatus =
        document.getElementById(
            "depositStatus"
        );

    const withdrawStatus =
        document.getElementById(
            "withdrawStatus"
        );


    const elements = [
        depositStatus,
        withdrawStatus
    ];


    elements.forEach(
        function (element) {

            if (!element) {
                return;
            }

            element.textContent =
                message;

            element.className =
                "cyber-wallet-status " +
                type;

        }
    );
}


/* ============================================================
   49. CLOSE WALLET MODAL
   ============================================================ */

function closeWalletModal() {

    removeWalletModal();
}


/* ============================================================
   50. REMOVE WALLET MODAL
   ============================================================ */

function removeWalletModal() {

    const depositModal =
        document.getElementById(
            "cyberDepositModal"
        );

    const withdrawModal =
        document.getElementById(
            "cyberWithdrawModal"
        );


    if (depositModal) {

        depositModal.remove();
    }


    if (withdrawModal) {

        withdrawModal.remove();
    }
}


/* ============================================================
   51. CLICK OUTSIDE WALLET MODAL
   ============================================================ */

document.addEventListener(
    "click",
    function (event) {

        const target =
            event.target;


        if (
            target &&
            target.classList &&
            target.classList.contains(
                "cyber-wallet-modal"
            )
        ) {

            closeWalletModal();
        }
    }
);


/* ============================================================
   52. ESCAPE CLOSE
   ============================================================ */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape"
        ) {

            const modal =
                document.querySelector(
                    ".cyber-wallet-modal"
                );

            if (modal) {

                closeWalletModal();
            }
        }
    }
);


/* ============================================================
   53. WALLET MODAL CSS
   ============================================================ */

function injectWalletStyles() {

    if (
        document.getElementById(
            "cyberWalletStyles"
        )
    ) {

        return;
    }


    const style =
        document.createElement(
            "style"
        );

    style.id =
        "cyberWalletStyles";


    style.textContent = `
        .cyber-wallet-modal {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(0,0,0,.82);
        }

        .cyber-wallet-box {
            position: relative;
            width: 100%;
            max-width: 430px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 24px;
            border-radius: 18px;
            background: #07111f;
            border: 1px solid rgba(34,211,238,.45);
            box-shadow:
                0 0 40px rgba(0,0,0,.65);
        }

        .cyber-close-wallet {
            position: absolute;
            top: 10px;
            right: 14px;
            width: 38px;
            height: 38px;
            border: 0;
            border-radius: 50%;
            background: transparent;
            color: #fff;
            font-size: 28px;
            cursor: pointer;
        }

        .cyber-wallet-title {
            margin-bottom: 6px;
            color: #22d3ee;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 1px;
        }

        .cyber-wallet-subtitle {
            margin-bottom: 22px;
            color: #94a3b8;
            font-size: 13px;
        }

        .cyber-wallet-label {
            display: block;
            margin-top: 15px;
            margin-bottom: 7px;
            color: #cbd5e1;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: .8px;
        }

        .cyber-wallet-input {
            box-sizing: border-box;
            width: 100%;
            padding: 13px 14px;
            border: 1px solid #334155;
            border-radius: 10px;
            outline: none;
            background: #0f172a;
            color: #fff;
            font-size: 15px;
        }

        .cyber-wallet-input:focus {
            border-color: #22d3ee;
        }

        .cyber-wallet-info,
        .cyber-wallet-balance {
            margin-top: 10px;
            color: #94a3b8;
            font-size: 13px;
        }

        .cyber-wallet-balance strong,
        .cyber-wallet-info strong {
            color: #22d3ee;
        }

        .cyber-wallet-warning {
            margin-top: 12px;
            padding: 10px;
            border-radius: 8px;
            background: rgba(245,158,11,.08);
            color: #fbbf24;
            font-size: 12px;
            line-height: 1.5;
        }

        .cyber-wallet-status {
            min-height: 20px;
            margin: 14px 0;
            font-size: 13px;
        }

        .cyber-wallet-status.error {
            color: #fb7185;
        }

        .cyber-wallet-status.success {
            color: #34d399;
        }

        .cyber-wallet-status.loading {
            color: #22d3ee;
        }

        .cyber-wallet-status.info {
            color: #cbd5e1;
        }

        .cyber-wallet-primary,
        .cyber-wallet-secondary {
            width: 100%;
            margin-top: 9px;
            padding: 13px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 800;
            letter-spacing: .5px;
        }

        .cyber-wallet-primary {
            border: 1px solid #22d3ee;
            background: #0891b2;
            color: #fff;
        }

        .cyber-wallet-secondary {
            border: 1px solid #334155;
            background: transparent;
            color: #cbd5e1;
        }

        .cyber-wallet-note {
            margin-top: 16px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
            text-align: center;
        }
    `;


    document.head.appendChild(
        style
    );
}


/* ============================================================
   54. INJECT WALLET STYLES
   ============================================================ */

injectWalletStyles();


/* ============================================================
   END OF PART 3
   ============================================================ *//* ============================================================
   CYBERSTRIKE — SCRIPT.JS
   PART 4 OF 5
   PENALTY SHOOTOUT — 15 SECOND GAME
   ============================================================ */


/* ============================================================
   55. START PENALTY SHOOTOUT
   ============================================================ */

function startPenaltyShootout(matchData = {}) {

    penaltyMatchId =
        matchData.match_id ||
        matchData.id ||
        penaltyMatchId;


    if (!penaltyMatchId) {

        showMessage(
            "Match ID was not returned by the server.",
            "error"
        );

        return;
    }


    penaltyPlayerScore = 0;

    penaltyOpponentScore = 0;

    penaltyTimeLeft = 15;

    penaltyRoundActive = true;

    penaltyActionLocked = false;


    stopPenaltyTimer();

    createPenaltyGameUI();

    updatePenaltyGameUI();

    startPenaltyTimer();


    showMessage(
        "Penalty Shootout started!",
        "success"
    );
}


/* ============================================================
   56. CREATE PENALTY GAME UI
   ============================================================ */

function createPenaltyGameUI() {

    removePenaltyGameUI();


    const overlay =
        document.createElement(
            "div"
        );

    overlay.id =
        "penaltyGameOverlay";


    overlay.innerHTML = `
        <div class="penalty-game-box">

            <div class="penalty-game-header">

                <div class="penalty-game-title">
                    PENALTY SHOOTOUT
                </div>

                <div class="penalty-game-subtitle">
                    1v1 • 15 SECOND ROUND
                </div>

            </div>


            <div class="penalty-scoreboard">

                <div class="penalty-player-card">

                    <div class="penalty-player-label">
                        YOU
                    </div>

                    <div
                        id="penaltyPlayerScore"
                        class="penalty-score"
                    >
                        0
                    </div>

                </div>


                <div class="penalty-vs">
                    VS
                </div>


                <div class="penalty-player-card">

                    <div class="penalty-player-label">
                        OPPONENT
                    </div>

                    <div
                        id="penaltyOpponentScore"
                        class="penalty-score"
                    >
                        0
                    </div>

                </div>

            </div>


            <div class="penalty-timer-label">
                TIME
            </div>


            <div
                id="penaltyTimer"
                class="penalty-timer"
            >
                15
            </div>


            <div
                id="penaltyGameMessage"
                class="penalty-game-message"
            >
                SHOOT!
            </div>


            <div class="penalty-shot-area">

                <button
                    id="penaltyShootButton"
                    type="button"
                    class="penalty-shoot-button"
                    onclick="takePenaltyShot()"
                >
                    ⚽ SHOOT
                </button>

            </div>


            <div class="penalty-game-note">

                Every successful shot gives
                <strong>1 point</strong>.

                <br>

                Highest verified score wins.

            </div>


            <button
                type="button"
                class="penalty-cancel-button"
                onclick="leavePenaltyGame()"
            >
                LEAVE MATCH
            </button>

        </div>
    `;


    document.body.appendChild(
        overlay
    );


    injectPenaltyStyles();
}


/* ============================================================
   57. UPDATE PENALTY UI
   ============================================================ */

function updatePenaltyGameUI() {

    const playerScore =
        document.getElementById(
            "penaltyPlayerScore"
        );

    const opponentScore =
        document.getElementById(
            "penaltyOpponentScore"
        );

    const timer =
        document.getElementById(
            "penaltyTimer"
        );


    if (playerScore) {

        playerScore.textContent =
            String(
                penaltyPlayerScore
            );
    }


    if (opponentScore) {

        opponentScore.textContent =
            String(
                penaltyOpponentScore
            );
    }


    if (timer) {

        timer.textContent =
            String(
                Math.max(
                    0,
                    penaltyTimeLeft
                )
            );
    }
}


/* ============================================================
   58. START 15 SECOND TIMER
   ============================================================ */

function startPenaltyTimer() {

    stopPenaltyTimer();


    penaltyTimeLeft = 15;

    updatePenaltyGameUI();


    penaltyTimer =
        setInterval(
            function () {

                if (!penaltyRoundActive) {

                    stopPenaltyTimer();

                    return;
                }


                penaltyTimeLeft--;

                updatePenaltyGameUI();


                if (
                    penaltyTimeLeft <= 0
                ) {

                    penaltyTimeLeft = 0;

                    updatePenaltyGameUI();

                    stopPenaltyTimer();

                    finishPenaltyRound();
                }

            },
            1000
        );
}


/* ============================================================
   59. STOP PENALTY TIMER
   ============================================================ */

function stopPenaltyTimer() {

    if (penaltyTimer) {

        clearInterval(
            penaltyTimer
        );

        penaltyTimer = null;
    }
}


/* ============================================================
   60. TAKE PENALTY SHOT
   ============================================================ */

async function takePenaltyShot() {

    if (!penaltyRoundActive) {

        return;
    }


    if (penaltyActionLocked) {

        return;
    }


    if (
        penaltyTimeLeft <= 0
    ) {

        return;
    }


    if (!penaltyMatchId) {

        showPenaltyMessage(
            "Match is not ready."
        );

        return;
    }


    penaltyActionLocked = true;

    setPenaltyShootButton(
        false
    );


    showPenaltyMessage(
        "Verifying shot..."
    );


    try {

        const result =
            await supabaseClient.functions.invoke(
                PENALTY_ACTION_FUNCTION_NAME,
                {
                    body: {

                        match_id:
                            penaltyMatchId,

                        action:
                            "shoot"

                    }
                }
            );


        if (result.error) {

            console.error(
                "Penalty action error:",
                result.error
            );

            showPenaltyMessage(
                "Shot could not be verified."
            );

            penaltyActionLocked = false;

            setPenaltyShootButton(
                true
            );

            return;
        }


        const data =
            result.data || {};


        if (
            data.success === false
        ) {

            showPenaltyMessage(
                data.message ||
                "Shot rejected."
            );

            penaltyActionLocked = false;

            setPenaltyShootButton(
                true
            );

            return;
        }


        /*
          IMPORTANT:

          The score comes from the server.

          The browser does NOT add a point itself.
        */

        if (
            data.player_score !== undefined
        ) {

            penaltyPlayerScore =
                Number(
                    data.player_score
                );
        }


        if (
            data.opponent_score !== undefined
        ) {

            penaltyOpponentScore =
                Number(
                    data.opponent_score
                );
        }


        if (
            data.time_left !== undefined
        ) {

            penaltyTimeLeft =
                Math.max(
                    0,
                    Number(
                        data.time_left
                    )
                );
        }


        updatePenaltyGameUI();


        if (
            data.shot_result === "goal"
        ) {

            showPenaltyMessage(
                "⚽ GOAL! +1"
            );

        } else if (
            data.shot_result === "miss"
        ) {

            showPenaltyMessage(
                "MISS"
            );

        } else {

            showPenaltyMessage(
                data.message ||
                "Shot verified."
            );
        }


        /*
          If the server says the match is finished,
          finish immediately.
        */

        if (
            data.match_finished === true ||
            data.finished === true
        ) {

            penaltyRoundActive = false;

            stopPenaltyTimer();

            updatePenaltyGameUI();

            finishPenaltyRound(
                data
            );

            return;
        }


        penaltyActionLocked = false;

        setPenaltyShootButton(
            true
        );


    } catch (error) {

        console.error(
            "Penalty shot exception:",
            error
        );


        showPenaltyMessage(
            error.message ||
            "Shot request failed."
        );


        penaltyActionLocked = false;

        setPenaltyShootButton(
            true
        );
    }
}


/* ============================================================
   61. FINISH PENALTY ROUND
   ============================================================ */

async function finishPenaltyRound(
    finalData = {}
) {

    if (!penaltyMatchId) {

        return;
    }


    penaltyRoundActive = false;

    stopPenaltyTimer();

    setPenaltyShootButton(
        false
    );


    showPenaltyMessage(
        "FINAL SCORE: " +
        penaltyPlayerScore +
        " - " +
        penaltyOpponentScore
    );


    /*
      The server must verify the final score and
      determine the actual winner.

      We do not calculate the wallet result here.
    */


    try {

        const result =
            await supabaseClient.functions.invoke(
                PENALTY_ACTION_FUNCTION_NAME,
                {
                    body: {

                        match_id:
                            penaltyMatchId,

                        action:
                            "finish",

                        client_player_score:
                            penaltyPlayerScore,

                        client_opponent_score:
                            penaltyOpponentScore

                    }
                }
            );


        if (result.error) {

            console.error(
                "Penalty finish error:",
                result.error
            );


            showPenaltyMessage(
                "Final result is being verified..."
            );


            setTimeout(
                async function () {

                    await loadPlayerData();

                },
                1500
            );


            return;
        }


        const data =
            result.data || {};


        /*
          Server-authoritative result.
        */

        if (
            data.player_score !== undefined
        ) {

            penaltyPlayerScore =
                Number(
                    data.player_score
                );
        }


        if (
            data.opponent_score !== undefined
        ) {

            penaltyOpponentScore =
                Number(
                    data.opponent_score
                );
        }


        updatePenaltyGameUI();


        if (
            data.result === "win" ||
            data.winner === "player"
        ) {

            showPenaltyResult(
                "YOU WIN!",
                data.message ||
                "Match completed successfully."
            );

        } else if (
            data.result === "loss" ||
            data.winner === "opponent"
        ) {

            showPenaltyResult(
                "YOU LOST",
                data.message ||
                "Match completed."
            );

        } else if (
            data.result === "draw"
        ) {

            showPenaltyResult(
                "DRAW",
                data.message ||
                "The match ended in a draw."
            );

        } else {

            showPenaltyResult(
                "MATCH COMPLETE",
                data.message ||
                "Final result verified by server."
            );
        }


        /*
          Refresh balance and weekly wins.

          If the server verified a win, the backend
          is responsible for increasing weekly_wins.
        */

        await loadPlayerData();


    } catch (error) {

        console.error(
            "Penalty finish exception:",
            error
        );


        showPenaltyResult(
            "RESULT PENDING",
            "The server is verifying the final result."
        );


        await loadPlayerData();
    }
}


/* ============================================================
   62. PENALTY MESSAGE
   ============================================================ */

function showPenaltyMessage(
    message
) {

    const element =
        document.getElementById(
            "penaltyGameMessage"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;
}


/* ============================================================
   63. PENALTY RESULT
   ============================================================ */

function showPenaltyResult(
    title,
    message
) {

    const element =
        document.getElementById(
            "penaltyGameMessage"
        );


    if (element) {

        element.innerHTML =
            "<strong>" +
            title +
            "</strong><br>" +
            message;
    }


    setPenaltyShootButton(
        false
    );


    setTimeout(
        function () {

            removePenaltyGameUI();

            penaltyMatchId = null;

            penaltyRoundActive = false;

            penaltyPlayerScore = 0;

            penaltyOpponentScore = 0;

            penaltyTimeLeft = 15;

        },
        4000
    );
}


/* ============================================================
   64. ENABLE / DISABLE SHOOT BUTTON
   ============================================================ */

function setPenaltyShootButton(
    enabled
) {

    const button =
        document.getElementById(
            "penaltyShootButton"
        );


    if (!button) {
        return;
    }


    button.disabled =
        !enabled;


    button.style.opacity =
        enabled
            ? "1"
            : "0.45";


    button.style.pointerEvents =
        enabled
            ? "auto"
            : "none";
}


/* ============================================================
   65. LEAVE PENALTY GAME
   ============================================================ */

function leavePenaltyGame() {

    if (
        penaltyRoundActive
    ) {

        const confirmed =
            window.confirm(
                "Leave this match? The server will determine the match result according to its rules."
            );


        if (!confirmed) {

            return;
        }
    }


    penaltyRoundActive = false;

    stopPenaltyTimer();

    penaltyActionLocked = false;

    penaltyMatchId = null;

    removePenaltyGameUI();


    showMessage(
        "You left the game screen.",
        "info"
    );
}


/* ============================================================
   66. REMOVE PENALTY GAME UI
   ============================================================ */

function removePenaltyGameUI() {

    const overlay =
        document.getElementById(
            "penaltyGameOverlay"
        );


    if (overlay) {

        overlay.remove();
    }
}


/* ============================================================
   67. PENALTY GAME CSS
   ============================================================ */

function injectPenaltyStyles() {

    if (
        document.getElementById(
            "cyberPenaltyStyles"
        )
    ) {

        return;
    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "cyberPenaltyStyles";


    style.textContent = `
        #penaltyGameOverlay {
            position: fixed;
            inset: 0;
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
            background: rgba(0,0,0,.90);
        }

        .penalty-game-box {
            width: 100%;
            max-width: 520px;
            padding: 24px;
            border: 1px solid rgba(34,211,238,.5);
            border-radius: 20px;
            background: #06111f;
            box-shadow:
                0 0 45px rgba(0,0,0,.8);
            text-align: center;
        }

        .penalty-game-header {
            margin-bottom: 20px;
        }

        .penalty-game-title {
            color: #22d3ee;
            font-size: 25px;
            font-weight: 900;
            letter-spacing: 1px;
        }

        .penalty-game-subtitle {
            margin-top: 5px;
            color: #64748b;
            font-size: 11px;
            letter-spacing: 1px;
        }

        .penalty-scoreboard {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
        }

        .penalty-player-card {
            flex: 1;
            padding: 15px;
            border: 1px solid #1e3a4a;
            border-radius: 14px;
            background: #0b1728;
        }

        .penalty-player-label {
            color: #94a3b8;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1px;
        }

        .penalty-score {
            margin-top: 4px;
            color: #fff;
            font-size: 42px;
            font-weight: 900;
        }

        .penalty-vs {
            color: #64748b;
            font-size: 13px;
            font-weight: 900;
        }

        .penalty-timer-label {
            margin-top: 25px;
            color: #64748b;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 2px;
        }

        .penalty-timer {
            margin-top: 3px;
            color: #22d3ee;
            font-size: 52px;
            font-weight: 900;
            line-height: 1;
        }

        .penalty-game-message {
            min-height: 42px;
            margin-top: 18px;
            color: #e2e8f0;
            font-size: 15px;
            line-height: 1.5;
        }

        .penalty-shot-area {
            margin-top: 15px;
        }

        .penalty-shoot-button {
            width: 100%;
            min-height: 68px;
            border: 1px solid #22d3ee;
            border-radius: 14px;
            background: #0891b2;
            color: #fff;
            font-size: 20px;
            font-weight: 900;
            cursor: pointer;
            transition: transform .12s ease;
        }

        .penalty-shoot-button:active {
            transform: scale(.97);
        }

        .penalty-shoot-button:disabled {
            cursor: not-allowed;
        }

        .penalty-game-note {
            margin-top: 15px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.6;
        }

        .penalty-game-note strong {
            color: #cbd5e1;
        }

        .penalty-cancel-button {
            margin-top: 20px;
            padding: 10px 18px;
            border: 1px solid #334155;
            border-radius: 9px;
            background: transparent;
            color: #94a3b8;
            cursor: pointer;
            font-size: 11px;
            font-weight: 700;
        }
    `;


    document.head.appendChild(
        style
    );
}


/* ============================================================
   68. PENALTY PAGE VISIBILITY SAFETY
   ============================================================ */

document.addEventListener(
    "visibilitychange",
    function () {

        /*
          We intentionally DO NOT pause the
          penalty timer when the browser is hidden.

          The server must remain authoritative.
        */

        if (
            document.visibilityState ===
            "visible"
        ) {

            updatePenaltyGameUI();
        }
    }
);


/* ============================================================
   END OF PART 4
   ============================================================ *//* ============================================================
   CYBERSTRIKE — SCRIPT.JS
   PART 5 OF 5
   FINAL CONTROLS + REFRESH + EXPORTS
   ============================================================ */


/* ============================================================
   69. REFRESH PLAYER WALLET
   ============================================================ */

async function refreshPlayerWallet() {

    if (!currentUser) {

        return;
    }


    if (walletLoading) {

        return;
    }


    walletLoading = true;


    try {

        await loadPlayerData();

    } catch (error) {

        console.error(
            "Wallet refresh failed:",
            error
        );

    } finally {

        walletLoading = false;
    }
}


/* ============================================================
   70. MANUAL REFRESH BUTTON
   ============================================================ */

async function refreshBalance() {

    if (!currentUser) {

        showMessage(
            "Please login first.",
            "error"
        );

        return;
    }


    showMessage(
        "Refreshing wallet...",
        "info"
    );


    await refreshPlayerWallet();


    showMessage(
        "Wallet updated.",
        "success"
    );
}


/* ============================================================
   71. REFRESH WHEN PAGE BECOMES VISIBLE
   ============================================================ */

document.addEventListener(
    "visibilitychange",
    async function () {

        if (
            document.visibilityState ===
            "visible"
        ) {

            if (currentUser) {

                await refreshPlayerWallet();
            }
        }
    }
);


/* ============================================================
   72. REFRESH WHEN WINDOW GETS FOCUS
   ============================================================ */

window.addEventListener(
    "focus",
    async function () {

        if (currentUser) {

            await refreshPlayerWallet();
        }
    }
);


/* ============================================================
   73. SAFE NUMBER HELPER
   ============================================================ */

function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);


    if (
        Number.isFinite(number)
    ) {

        return number;
    }


    return fallback;
}


/* ============================================================
   74. FORMAT USDT
   ============================================================ */

function formatUSDT(
    value
) {

    return (
        safeNumber(value)
            .toFixed(2) +
        " USDT"
    );
}


/* ============================================================
   75. FORMAT STAKE
   ============================================================ */

function formatStake(
    value
) {

    return (
        safeNumber(value)
            .toFixed(2) +
        " USDT"
    );
}


/* ============================================================
   76. SAFE GAME SELECTION
   ============================================================ */

function handleGameSelection(
    game
) {

    selectGame(game);

    updateSelectedGameDisplay();

    updatePayoutDisplay();
}


/* ============================================================
   77. SAFE STAKE SELECTION
   ============================================================ */

function handleStakeSelection(
    button,
    amount
) {

    selectStake(
        button,
        amount
    );

    updatePayoutDisplay();
}


/* ============================================================
   78. START MATCH BUTTON SUPPORT
   ============================================================ */

async function startMatch() {

    await findOpponent();
}


/* ============================================================
   79. CANCEL MATCHMAKING
   ============================================================ */

async function cancelMatchmaking() {

    /*
      This only cancels the waiting screen locally.

      If the backend has already locked funds,
      the backend must provide its own cancellation/
      refund mechanism.

      We never refund money from the browser.
    */

    showMessage(
        "Matchmaking cancellation is controlled by the server.",
        "info"
    );
}


/* ============================================================
   80. GAME CARD CLICK SUPPORT
   ============================================================ */

function selectGameMode(
    game
) {

    handleGameSelection(
        game
    );
}


/* ============================================================
   81. STAKE BUTTON CLICK SUPPORT
   ============================================================ */

function chooseStake(
    button,
    amount
) {

    handleStakeSelection(
        button,
        amount
    );
}


/* ============================================================
   82. LOGIN BUTTON COMPATIBILITY
   ============================================================ */

window.handleLogin =
    handleLogin;


/* ============================================================
   83. REGISTER COMPATIBILITY
   ============================================================ */

window.registerUser =
    registerUser;


/* ============================================================
   84. LOGOUT COMPATIBILITY
   ============================================================ */

window.handleLogout =
    handleLogout;

window.logoutUser =
    logoutUser;


/* ============================================================
   85. WALLET COMPATIBILITY
   ============================================================ */

window.openDepositModal =
    openDepositModal;

window.createDeposit =
    createDeposit;

window.openWithdrawModal =
    openWithdrawModal;

window.requestWithdrawal =
    requestWithdrawal;

window.closeWalletModal =
    closeWalletModal;


/* ============================================================
   86. GAME COMPATIBILITY
   ============================================================ */

window.selectGame =
    selectGame;

window.selectGameMode =
    selectGameMode;

window.selectStake =
    selectStake;

window.chooseStake =
    chooseStake;

window.findOpponent =
    findOpponent;

window.startMatch =
    startMatch;


/* ============================================================
   87. WEEKLY SPRINT COMPATIBILITY
   ============================================================ */

window.claimMilestone =
    claimMilestone;

window.updateWeeklySprint =
    updateWeeklySprint;


/* ============================================================
   88. PENALTY SHOOTOUT COMPATIBILITY
   ============================================================ */

window.startPenaltyShootout =
    startPenaltyShootout;

window.takePenaltyShot =
    takePenaltyShot;

window.leavePenaltyGame =
    leavePenaltyGame;


/* ============================================================
   89. REFRESH COMPATIBILITY
   ============================================================ */

window.refreshBalance =
    refreshBalance;

window.refreshPlayerWallet =
    refreshPlayerWallet;


/* ============================================================
   90. DEBUG INFORMATION
   ============================================================ */

window.CYBERSTRIKE =
    {

        version:
            "1.0.0",

        currency:
            CURRENCY,

        selectedGame:
            function () {

                return selectedGame;
            },

        selectedStake:
            function () {

                return selectedStake;
            },

        balance:
            function () {

                return playerBalance;
            },

        weeklyWins:
            function () {

                return weeklyWins;
            },

        weeklyWeekKey:
            function () {

                return getCurrentWeekKey();
            },

        penaltyMatchId:
            function () {

                return penaltyMatchId;
            }

    };


/* ============================================================
   91. INITIAL UI SAFETY
   ============================================================ */

function initializeCyberstrikeUI() {

    /*
      These calls are safe even when the corresponding
      elements do not exist in the current HTML.
    */

    updateBalanceDisplay();

    updatePlayerEmail();

    updateSelectedGameDisplay();

    updateSelectedStakeDisplay();

    updatePayoutDisplay();

    updateWeeklySprint();

    updateMilestoneButtons();
}


/* ============================================================
   92. FINAL INITIALIZATION
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            initializeCyberstrikeUI();

        }
    );

} else {

    initializeCyberstrikeUI();
}


/* ============================================================
   93. CONSOLE STATUS
   ============================================================ */

console.log(
    "=============================================="
);

console.log(
    "CYBERSTRIKE SCRIPT LOADED"
);

console.log(
    "Game:",
    selectedGame
);

console.log(
    "Stake:",
    formatStake(selectedStake)
);

console.log(
    "Weekly system:",
    "MONDAY → SUNDAY"
);

console.log(
    "Penalty timer:",
    "15 seconds"
);

console.log(
    "Currency:",
    CURRENCY
);

console.log(
    "=============================================="
);


/* ============================================================
   END OF SCRIPT.JS
   ============================================================ */
