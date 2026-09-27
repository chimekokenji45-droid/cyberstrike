/* ==========================================================================
   CYBERSTRIKE | 1v1 COMPETITIVE ARENA
   COMPLETE SCRIPT.JS
   PART 1 OF 4

   AUTHENTICATION
   SUPABASE
   PLAYER WALLET
   GAME SELECTION
   STAKE SELECTION
   WEEKLY SPRINT
   ========================================================================== */


/* ==========================================================================
   1. SUPABASE CONFIGURATION
   ========================================================================== */

const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

let supabaseClient = null;


/* ==========================================================================
   2. CYBERSTRIKE STATE
   ========================================================================== */

let currentUser = null;

let playerBalance = 0;

let weeklyWins = 0;

let weeklySprintStartedAt = null;

let selectedGame = "Penalty Shootout";

let selectedStake = 0.50;

let countdownTimer = null;

let walletLoading = false;


/* ==========================================================================
   3. CONSTANTS
   ========================================================================== */

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

const DEPOSIT_FUNCTION_NAME =
    "cyberstrike-deposit";

const WITHDRAW_FUNCTION_NAME =
    "cyberstrike-withdraw";


/* ==========================================================================
   4. INITIALIZE SUPABASE
   ========================================================================== */

function initializeSupabase() {

    if (
        typeof supabase === "undefined"
    ) {
        console.error(
            "CYBERSTRIKE: Supabase library not loaded."
        );

        showMessage(
            "Supabase library failed to load.",
            "error"
        );

        return false;
    }


    if (
        SUPABASE_URL ===
        "YOUR_SUPABASE_URL" ||

        SUPABASE_ANON_KEY ===
        "YOUR_SUPABASE_ANON_KEY"
    ) {

        console.error(
            "CYBERSTRIKE: Add your Supabase URL and anon key."
        );

        showMessage(
            "Supabase configuration is missing.",
            "error"
        );

        return false;
    }


    try {

        supabaseClient =
            supabase.createClient(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            );


        console.log(
            "CYBERSTRIKE: Supabase connected."
        );

        return true;

    } catch (error) {

        console.error(
            "Supabase initialization error:",
            error
        );

        showMessage(
            "Unable to connect to Supabase.",
            "error"
        );

        return false;
    }
}


/* ==========================================================================
   5. PAGE START
   ========================================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "CYBERSTRIKE starting..."
        );


        const connected =
            initializeSupabase();


        if (!connected) {
            return;
        }


        setupAuthListener();


        await checkCurrentSession();


        startCountdown();


        updateDashboard();

    }
);


/* ==========================================================================
   6. CHECK CURRENT SESSION
   ========================================================================== */

async function checkCurrentSession() {

    if (!supabaseClient) {
        return;
    }


    try {

        showLoading();


        const {
            data,
            error
        } =
            await supabaseClient.auth.getSession();


        if (error) {

            console.error(
                "Session error:",
                error
            );

            currentUser = null;

            showLoginScreen();

            return;
        }


        if (
            data &&
            data.session &&
            data.session.user
        ) {

            currentUser =
                data.session.user;


            console.log(
                "Logged in:",
                currentUser.email
            );


            await loadPlayerData();


            showDashboard();

        } else {

            currentUser = null;

            resetLocalWalletState();

            showLoginScreen();
        }


    } catch (error) {

        console.error(
            "Session check failed:",
            error
        );

        currentUser = null;

        showLoginScreen();
    }
}


/* ==========================================================================
   7. AUTH STATE LISTENER
   ========================================================================== */

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


            if (
                session &&
                session.user
            ) {

                currentUser =
                    session.user;


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


/* ==========================================================================
   8. LOGIN
   ========================================================================== */

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
        String(
            email || ""
        ).trim();


    password =
        String(
            password || ""
        );


    if (
        !email ||
        !password
    ) {

        showMessage(
            "Enter your email and password.",
            "error"
        );

        return false;
    }


    try {

        showLoading();


        const {
            data,
            error
        } =
            await supabaseClient.auth
                .signInWithPassword({

                    email:
                        email,

                    password:
                        password

                });


        if (error) {

            console.error(
                "Login error:",
                error
            );


            showLoginScreen();


            showMessage(
                error.message ||
                "Login failed.",
                "error"
            );


            return false;
        }


        if (
            !data ||
            !data.user
        ) {

            showLoginScreen();


            showMessage(
                "Login failed.",
                "error"
            );


            return false;
        }


        currentUser =
            data.user;


        await loadPlayerData();


        showDashboard();


        showMessage(
            "Login successful.",
            "success"
        );


        return true;


    } catch (error) {

        console.error(
            "Unexpected login error:",
            error
        );


        showLoginScreen();


        showMessage(
            "Unable to login right now.",
            "error"
        );


        return false;
    }
}


/* ==========================================================================
   9. REGISTER
   ========================================================================== */

async function registerUser(
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
        String(
            email || ""
        ).trim();


    password =
        String(
            password || ""
        );


    if (
        !email ||
        !password
    ) {

        showMessage(
            "Enter an email and password.",
            "error"
        );

        return false;
    }


    if (
        password.length < 6
    ) {

        showMessage(
            "Password must contain at least 6 characters.",
            "error"
        );

        return false;
    }


    try {

        showLoading();


        const {
            data,
            error
        } =
            await supabaseClient.auth
                .signUp({

                    email:
                        email,

                    password:
                        password

                });


        if (error) {

            console.error(
                "Registration error:",
                error
            );


            showLoginScreen();


            showMessage(
                error.message ||
                "Registration failed.",
                "error"
            );


            return false;
        }


        if (
            data &&
            data.session &&
            data.user
        ) {

            currentUser =
                data.user;


            await loadPlayerData();


            showDashboard();


            showMessage(
                "Account created successfully.",
                "success"
            );


            return true;
        }


        showLoginScreen();


        showMessage(
            "Account created. Check your email if confirmation is required.",
            "success"
        );


        return true;


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );


        showLoginScreen();


        showMessage(
            "Unable to create account.",
            "error"
        );


        return false;
    }
}


/* ==========================================================================
   10. LOGOUT
   ========================================================================== */

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
            "Logout error:",
            error
        );


        showMessage(
            "Unable to logout.",
            "error"
        );
    }
}


/* ==========================================================================
   11. LOAD PLAYER DATA
   ========================================================================== */

async function loadPlayerData() {

    if (
        !supabaseClient ||
        !currentUser
    ) {
        return;
    }


    if (walletLoading) {
        return;
    }


    walletLoading = true;


    try {

        const {
            data,
            error
        } =
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


        if (error) {

            console.error(
                "Player data error:",
                error
            );


            playerBalance = 0;

            weeklyWins = 0;

            weeklySprintStartedAt =
                null;


            updateDashboard();


            showMessage(
                "Wallet data could not be loaded.",
                "error"
            );


            return;
        }


        if (!data) {

            console.warn(
                "No player record found."
            );


            playerBalance = 0;

            weeklyWins = 0;

            weeklySprintStartedAt =
                null;


            updateDashboard();


            return;
        }


        playerBalance =
            Number(
                data.balance || 0
            );


        weeklyWins =
            Number(
                data.weekly_wins || 0
            );


        weeklySprintStartedAt =
            data.weekly_sprint_started_at ||
            null;


        updateDashboard();


        console.log(
            "Wallet:",
            playerBalance,
            CURRENCY
        );


    } catch (error) {

        console.error(
            "loadPlayerData error:",
            error
        );


        playerBalance = 0;

        weeklyWins = 0;

        weeklySprintStartedAt =
            null;


        updateDashboard();


    } finally {

        walletLoading = false;
    }
}


/* ==========================================================================
   12. UPDATE DASHBOARD
   ========================================================================== */

function updateDashboard() {

    updateBalanceDisplay();

    updatePlayerEmail();

    updateWeeklySprint();

    updateSelectedGameDisplay();

    updateSelectedStakeDisplay();
}


/* ==========================================================================
   13. UPDATE BALANCE
   ========================================================================== */

function updateBalanceDisplay() {

    const elements =
        document.querySelectorAll(
            ".balance, #userBalanceDisplay, [data-balance]"
        );


    const safeBalance =
        Number.isFinite(
            playerBalance
        )
            ? Math.max(
                0,
                playerBalance
            )
            : 0;


    const formatted =
        safeBalance.toFixed(2) +
        " " +
        CURRENCY;


    elements.forEach(
        function (element) {

            element.textContent =
                formatted;

        }
    );
}


/* ==========================================================================
   14. UPDATE USER EMAIL
   ========================================================================== */

function updatePlayerEmail() {

    if (!currentUser) {
        return;
    }


    const elements =
        document.querySelectorAll(
            "#userEmail, #playerEmail, [data-user-email]"
        );


    elements.forEach(
        function (element) {

            element.textContent =
                currentUser.email || "";

        }
    );
}


/* ==========================================================================
   15. RESET LOCAL STATE
   ========================================================================== */

function resetLocalWalletState() {

    playerBalance = 0;

    weeklyWins = 0;

    weeklySprintStartedAt =
        null;

    selectedGame =
        "Penalty Shootout";

    selectedStake =
        0.50;


    updateDashboard();
}


/* ==========================================================================
   16. GET BALANCE
   ========================================================================== */

function getPlayerBalance() {

    return Number(
        Number(
            playerBalance || 0
        ).toFixed(2)
    );
}


/* ==========================================================================
   17. CALCULATE WINNER PAYOUT
   ========================================================================== */

function calculateWinnerPayout(
    stake
) {

    const numericStake =
        Number(stake);


    if (
        !CYBERSTRIKE_STAKES.includes(
            numericStake
        )
    ) {
        return 0;
    }


    const totalPot =
        numericStake * 2;


    const platformFee =
        totalPot *
        (
            PLATFORM_FEE_PERCENT /
            100
        );


    const winnerAmount =
        totalPot -
        platformFee;


    return Number(
        winnerAmount.toFixed(2)
    );
}


/* ==========================================================================
   18. SELECT GAME
   ========================================================================== */

function selectGame(game) {

    if (
        !CYBERSTRIKE_GAMES.includes(
            game
        )
    ) {

        showMessage(
            "Invalid game selected.",
            "error"
        );

        return;
    }


    selectedGame =
        game;


    updateSelectedGameDisplay();


    showMessage(
        game +
        " selected. Stake: " +
        selectedStake.toFixed(2) +
        " USDT",
        "success"
    );
}


/* ==========================================================================
   19. SELECT STAKE
   ========================================================================== */

function selectStake(
    button,
    amount
) {

    const numericAmount =
        Number(amount);


    if (
        !CYBERSTRIKE_STAKES.includes(
            numericAmount
        )
    ) {

        showMessage(
            "Invalid stake amount.",
            "error"
        );

        return;
    }


    selectedStake =
        numericAmount;


    document
        .querySelectorAll(
            ".stake, [data-stake]"
        )
        .forEach(
            function (element) {

                element.classList.remove(
                    "active",
                    "selected"
                );

            }
        );


    if (button) {

        button.classList.add(
            "active",
            "selected"
        );
    }


    updateSelectedStakeDisplay();


    showMessage(
        "Stake selected: " +
        numericAmount.toFixed(2) +
        " USDT",
        "success"
    );
}


/* ==========================================================================
   20. UPDATE SELECTED GAME
   ========================================================================== */

function updateSelectedGameDisplay() {

    const elements =
        document.querySelectorAll(
            "#selectedGame, [data-selected-game]"
        );


    elements.forEach(
        function (element) {

            element.textContent =
                selectedGame;

        }
    );
}


/* ==========================================================================
   21. UPDATE SELECTED STAKE
   ========================================================================== */

function updateSelectedStakeDisplay() {

    const elements =
        document.querySelectorAll(
            "#selectedStake, [data-selected-stake]"
        );


    elements.forEach(
        function (element) {

            element.textContent =
                selectedStake.toFixed(2) +
                " USDT";

        }
    );


    const payout =
        calculateWinnerPayout(
            selectedStake
        );


    const payoutElements =
        document.querySelectorAll(
            "#potentialPayout, [data-potential-payout]"
        );


    payoutElements.forEach(
        function (element) {

            element.textContent =
                payout.toFixed(2) +
                " USDT";

        }
    );
               }/* ==========================================================================
   CYBERSTRIKE | SCRIPT.JS
   PART 2 OF 4

   WEEKLY SPRINT
   COUNTDOWN
   UI HELPERS
   AUTH UI
   MESSAGES
   ========================================================================== */


/* ==========================================================================
   1. WEEKLY SPRINT
   ========================================================================== */

function updateWeeklySprint() {

    const winsElement = document.getElementById("weeklyWins");
    const rewardElement = document.getElementById("nextRewardLabel");
    const progressElement = document.getElementById("weeklyProgressPercent");
    const progressBar = document.getElementById("weeklyProgressBar");

    if (winsElement) {
        winsElement.textContent = String(weeklyWins);
    }

    let nextReward = "2.00 USDT";
    let targetWins = 20;

    if (weeklyWins >= 1000) {
        nextReward = "100.00 USDT";
        targetWins = 1000;
    } else if (weeklyWins >= 100) {
        nextReward = "100.00 USDT";
        targetWins = 1000;
    } else if (weeklyWins >= 50) {
        nextReward = "10.00 USDT";
        targetWins = 100;
    } else if (weeklyWins >= 20) {
        nextReward = "5.00 USDT";
        targetWins = 50;
    }

    if (rewardElement) {
        rewardElement.textContent = "NEXT REWARD: " + nextReward;
    }

    const percentage = Math.min(
        100,
        Math.floor((weeklyWins / targetWins) * 100)
    );

    if (progressElement) {
        progressElement.textContent = percentage + "%";
    }

    if (progressBar) {
        progressBar.style.width = percentage + "%";
    }

    updateMilestoneButtons();
}


/* ==========================================================================
   2. MILESTONE BUTTONS
   ========================================================================== */

function updateMilestoneButtons() {

    const claim20 = document.getElementById("claim20Btn");
    const claim50 = document.getElementById("claim50Btn");
    const claim100 = document.getElementById("claim100Btn");
    const claim1000 = document.getElementById("claim1000Btn");

    updateMilestoneButton(claim20, weeklyWins >= 20);
    updateMilestoneButton(claim50, weeklyWins >= 50);
    updateMilestoneButton(claim100, weeklyWins >= 100);
    updateMilestoneButton(claim1000, weeklyWins >= 1000);
}


function updateMilestoneButton(button, unlocked) {

    if (!button) return;

    button.disabled = !unlocked;

    if (unlocked) {
        button.style.opacity = "1";
        button.style.cursor = "pointer";
    } else {
        button.style.opacity = "0.45";
        button.style.cursor = "not-allowed";
    }
}


/* ==========================================================================
   3. MILESTONE CLAIM
   ========================================================================== */

async function claimMilestone(requiredWins, rewardAmount) {

    if (!currentUser) {
        showMessage("Please login first.", "error");
        return;
    }

    if (weeklyWins < requiredWins) {
        showMessage(
            "You need " + requiredWins + " verified wins to unlock this reward.",
            "error"
        );
        return;
    }

    showMessage(
        "Milestone rewards are verified by the CYBERSTRIKE server.",
        "info"
    );

    /*
       IMPORTANT:

       The reward should NOT be added directly from the browser.

       The final production version should call a Supabase Edge Function
       which checks the player's verified wins and makes the reward credit
       server-side.

       This prevents players from changing weeklyWins in browser tools.
    */

    const rewardFunction = "cyberstrike-milestone";

    if (!supabaseClient) {
        showMessage("Supabase is not connected.", "error");
        return;
    }

    try {

        showLoading(true);

        const { data, error } =
            await supabaseClient.functions.invoke(
                rewardFunction,
                {
                    body: {
                        required_wins: requiredWins,
                        reward_amount: rewardAmount
                    }
                }
            );

        showLoading(false);

        if (error) {
            console.error("Milestone error:", error);
            showMessage(
                "Milestone verification failed.",
                "error"
            );
            return;
        }

        if (!data) {
            showMessage(
                "No response from milestone server.",
                "error"
            );
            return;
        }

        if (data.success === false) {
            showMessage(
                data.message || "Milestone could not be claimed.",
                "error"
            );
            return;
        }

        if (typeof data.balance !== "undefined") {
            playerBalance = Number(data.balance) || 0;
            updateBalanceDisplay();
        }

        if (typeof data.weekly_wins !== "undefined") {
            weeklyWins = Number(data.weekly_wins) || weeklyWins;
            updateWeeklySprint();
        }

        showMessage(
            data.message ||
            ("Milestone reward of " +
                rewardAmount.toFixed(2) +
                " USDT credited."),
            "success"
        );

    } catch (err) {

        showLoading(false);

        console.error("Milestone exception:", err);

        showMessage(
            "Unable to contact the milestone server.",
            "error"
        );
    }
}


/* ==========================================================================
   4. WEEKLY COUNTDOWN
   ========================================================================== */

function startWeeklyCountdown() {

    if (countdownTimer) {
        clearInterval(countdownTimer);
    }

    updateCountdownDisplay();

    countdownTimer = setInterval(
        updateCountdownDisplay,
        1000
    );
}


function updateCountdownDisplay() {

    const countdownElement =
        document.getElementById("countdown");

    if (!countdownElement) return;

    if (!weeklySprintStartedAt) {
        countdownElement.textContent = "7 DAYS";
        return;
    }

    const startTime =
        new Date(weeklySprintStartedAt).getTime();

    if (!Number.isFinite(startTime)) {
        countdownElement.textContent = "7 DAYS";
        return;
    }

    const sprintDuration =
        7 * 24 * 60 * 60 * 1000;

    const endTime =
        startTime + sprintDuration;

    const remaining =
        endTime - Date.now();

    if (remaining <= 0) {

        countdownElement.textContent =
            "RESETTING...";

        return;
    }

    const totalSeconds =
        Math.floor(remaining / 1000);

    const days =
        Math.floor(totalSeconds / 86400);

    const hours =
        Math.floor(
            (totalSeconds % 86400) / 3600
        );

    const minutes =
        Math.floor(
            (totalSeconds % 3600) / 60
        );

    const seconds =
        totalSeconds % 60;

    countdownElement.textContent =
        String(days).padStart(2, "0") +
        "D " +
        String(hours).padStart(2, "0") +
        "H " +
        String(minutes).padStart(2, "0") +
        "M " +
        String(seconds).padStart(2, "0") +
        "S";
}


/* ==========================================================================
   5. GENERIC LOADING STATE
   ========================================================================== */

function showLoading(isLoading) {

    const button =
        document.getElementById("loginButton");

    if (!button) return;

    if (isLoading) {

        if (!button.dataset.originalText) {
            button.dataset.originalText =
                button.textContent;
        }

        button.disabled = true;
        button.textContent = "CONNECTING...";

    } else {

        button.disabled = false;

        if (button.dataset.originalText) {
            button.textContent =
                button.dataset.originalText;
        }
    }
}


/* ==========================================================================
   6. MESSAGE SYSTEM
   ========================================================================== */

function showMessage(message, type = "info") {

    const messageElement =
        document.getElementById("cyberMessage");

    if (!messageElement) {
        console.log(
            "[" + type.toUpperCase() + "]",
            message
        );
        return;
    }

    messageElement.textContent = message;

    messageElement.style.display = "block";

    messageElement.dataset.type = type;

    if (type === "error") {
        messageElement.style.borderColor =
            "#ef4444";
    } else if (type === "success") {
        messageElement.style.borderColor =
            "#22c55e";
    } else {
        messageElement.style.borderColor =
            "#06b6d4";
    }

    clearTimeout(
        messageElement._hideTimer
    );

    messageElement._hideTimer =
        setTimeout(() => {

            messageElement.style.display =
                "none";

        }, 5000);
}


/* ==========================================================================
   7. AUTH SCREEN
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

    const emailInput =
        document.getElementById("loginEmail");

    const passwordInput =
        document.getElementById("loginPassword");

    if (emailInput) {
        emailInput.disabled = false;
    }

    if (passwordInput) {
        passwordInput.disabled = false;
    }

    showAuthMessage("");
}


/* ==========================================================================
   8. DASHBOARD SCREEN
   ========================================================================== */

function showDashboard() {

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

    updateDashboard();

    startWeeklyCountdown();
}


/* ==========================================================================
   9. AUTH MESSAGE
   ========================================================================== */

function showAuthMessage(message, type = "error") {

    const element =
        document.getElementById("authMessage");

    if (!element) {
        if (message) {
            console.log(
                "[" + type.toUpperCase() + "]",
                message
            );
        }
        return;
    }

    element.textContent = message;

    if (!message) {
        element.style.display = "none";
        return;
    }

    element.style.display = "block";

    if (type === "success") {
        element.style.color = "#22c55e";
    } else {
        element.style.color = "#ef4444";
    }
}


/* ==========================================================================
   10. FIND OPPONENT
   ========================================================================== */

async function findOpponent() {

    if (!currentUser) {
        showMessage(
            "Please login before finding an opponent.",
            "error"
        );
        return;
    }

    if (!CYBERSTRIKE_GAMES.includes(selectedGame)) {
        showMessage(
            "Please select a valid game.",
            "error"
        );
        return;
    }

    if (!CYBERSTRIKE_STAKES.includes(selectedStake)) {
        showMessage(
            "Please select a valid stake.",
            "error"
        );
        return;
    }

    const requiredBalance =
        Number(selectedStake);

    if (playerBalance < requiredBalance) {
        showMessage(
            "Insufficient USDT balance.",
            "error"
        );
        return;
    }

    /*
       Matchmaking will be handled by the secure
       CYBERSTRIKE Edge Function.

       The browser must never decide:
       - who the opponent is
       - whether money is deducted
       - who wins
       - the final payout

       Those decisions belong on the server.
    */

    if (!supabaseClient) {
        showMessage(
            "Supabase is not connected.",
            "error"
        );
        return;
    }

    try {

        showMessage(
            "Searching for an opponent...",
            "info"
        );

        const { data, error } =
            await supabaseClient.functions.invoke(
                "cyberstrike-matchmaking",
                {
                    body: {
                        game: selectedGame,
                        stake: selectedStake
                    }
                }
            );

        if (error) {

            console.error(
                "Matchmaking error:",
                error
            );

            showMessage(
                "MATCHMAKING ERROR",
                "error"
            );

            return;
        }

        if (!data) {

            showMessage(
                "No matchmaking response.",
                "error"
            );

            return;
        }

        if (data.success === false) {

            showMessage(
                data.message ||
                "Unable to find an opponent.",
                "error"
            );

            return;
        }

        if (data.match_id) {

            showMessage(
                "Opponent found. Match starting...",
                "success"
            );

            /*
               The actual game screen will use
               data.match_id in the next part.
            */

            window.CYBERSTRIKE_MATCH_ID =
                data.match_id;
        }

    } catch (error) {

        console.error(
            "Matchmaking exception:",
            error
        );

        showMessage(
            "Unable to connect to matchmaking.",
            "error"
        );
    }
}


/* ==========================================================================
   11. LOGOUT UI
   ========================================================================== */

async function handleLogout() {

    await logoutUser();
}


/* ==========================================================================
   12. KEYBOARD LOGIN SUPPORT
   ========================================================================== */

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key !== "Enter") return;

        const email =
            document.getElementById("loginEmail");

        const password =
            document.getElementById("loginPassword");

        if (!email || !password) return;

        if (
            document.activeElement === email ||
            document.activeElement === password
        ) {

            event.preventDefault();

            loginUser(
                email.value,
                password.value
            );
        }
    }
);


/* ==========================================================================
   END OF PART 2

   PART 3 WILL CONTAIN:

   - DEPOSIT MODAL
   - CASHOUT MODAL
   - USDT WALLET UI
   - SUPABASE EDGE FUNCTION CALLS
   - DEPOSIT CHECKOUT REDIRECT
   - WITHDRAWAL REQUEST
   ========================================================================== */
