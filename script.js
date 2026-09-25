// ============================================================
// CYBERSTRIKE - FAUCETPAY DEPOSIT WEBHOOK
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// IMPORTANT:
// This must match your FaucetPay merchant username.
const FAUCETPAY_MERCHANT_USERNAME = "chimeko45";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

function jsonResponse(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

Deno.serve(async (req) => {
  try {
    // --------------------------------------------------------
    // CORS
    // --------------------------------------------------------
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
        }
      });
    }

    // FaucetPay should send POST
    if (req.method !== "POST") {
      return jsonResponse({
        success: false,
        error: "POST request required."
      }, 405);
    }

    // --------------------------------------------------------
    // READ FAUCETPAY CALLBACK
    // --------------------------------------------------------
    const bodyText = await req.text();

    const params = new URLSearchParams(bodyText);

    const token = params.get("token");
    const transactionId = params.get("transaction_id");
    const merchantUsername = params.get("merchant_username");
    const custom = params.get("custom");

    if (!token) {
      console.error("Missing FaucetPay token.");

      return jsonResponse({
        success: false,
        error: "Missing FaucetPay verification token."
      }, 400);
    }

    if (!custom) {
      console.error("Missing custom user ID.");

      return jsonResponse({
        success: false,
        error: "Missing user identifier."
      }, 400);
    }

    // --------------------------------------------------------
    // VERIFY PAYMENT DIRECTLY WITH FAUCETPAY
    // --------------------------------------------------------
    const verifyResponse = await fetch(
      `https://faucetpay.io/merchant/get-payment/${encodeURIComponent(token)}`
    );

    if (!verifyResponse.ok) {
      console.error(
        "FaucetPay verification HTTP error:",
        verifyResponse.status
      );

      return jsonResponse({
        success: false,
        error: "FaucetPay verification request failed."
      }, 502);
    }

    const payment = await verifyResponse.json();

    console.log(
      "FaucetPay verification response:",
      JSON.stringify(payment)
    );

    // --------------------------------------------------------
    // VERIFY PAYMENT VALIDITY
    // --------------------------------------------------------
    if (!payment.valid) {
      return jsonResponse({
        success: false,
        error: "FaucetPay payment verification failed."
      }, 400);
    }

    // --------------------------------------------------------
    // VERIFY MERCHANT
    // --------------------------------------------------------
    if (
      payment.merchant_username !== FAUCETPAY_MERCHANT_USERNAME
    ) {
      console.error(
        "Merchant mismatch:",
        payment.merchant_username
      );

      return jsonResponse({
        success: false,
        error: "Merchant verification failed."
      }, 400);
    }

    // Also check the callback merchant username when provided.
    if (
      merchantUsername &&
      merchantUsername !== FAUCETPAY_MERCHANT_USERNAME
    ) {
      console.error(
        "Callback merchant mismatch:",
        merchantUsername
      );

      return jsonResponse({
        success: false,
        error: "Invalid merchant username."
      }, 400);
    }

    // --------------------------------------------------------
    // VERIFY CUSTOM USER ID
    // --------------------------------------------------------
    if (payment.custom !== custom) {
      console.error(
        "Custom/user ID mismatch:",
        payment.custom,
        custom
      );

      return jsonResponse({
        success: false,
        error: "User verification failed."
      }, 400);
    }

    // --------------------------------------------------------
    // VERIFY CURRENCY
    // --------------------------------------------------------
    const currency = String(
      payment.currency1 || ""
    ).toUpperCase();

    if (currency !== "USDT") {
      return jsonResponse({
        success: false,
        error: `Unsupported deposit currency: ${currency}`
      }, 400);
    }

    // --------------------------------------------------------
    // GET AUTHORITATIVE PAYMENT AMOUNT
    // --------------------------------------------------------
    const amount = Number(payment.amount1);

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({
        success: false,
        error: "Invalid payment amount."
      }, 400);
    }

    // Never credit an amount from the browser.
    // We use FaucetPay's verified amount above.
    const amountRounded = Math.round(amount * 100000000) / 100000000;

    // --------------------------------------------------------
    // VERIFY SUPABASE USER EXISTS
    // --------------------------------------------------------
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, balance")
        .eq("id", custom)
        .maybeSingle();

    if (profileError) {
      console.error(
        "Profile lookup error:",
        profileError
      );

      return jsonResponse({
        success: false,
        error: "Could not find user profile."
      }, 500);
    }

    if (!profile) {
      console.error(
        "Profile not found for user:",
        custom
      );

      return jsonResponse({
        success: false,
        error: "User profile does not exist."
      }, 404);
    }

    // --------------------------------------------------------
    // DUPLICATE PROTECTION
    //
    // The same FaucetPay callback may be retried.
    // We store transaction IDs in a small table.
    // --------------------------------------------------------
    if (transactionId) {
      const { data: existingDeposit, error: duplicateCheckError } =
        await supabase
          .from("deposit_transactions")
          .select("id")
          .eq("transaction_id", String(transactionId))
          .maybeSingle();

      if (duplicateCheckError) {
        console.error(
          "Duplicate check error:",
          duplicateCheckError
        );

        return jsonResponse({
          success: false,
          error: "Could not verify transaction status."
        }, 500);
      }

      if (existingDeposit) {
        console.log(
          "Duplicate FaucetPay callback ignored:",
          transactionId
        );

        return jsonResponse({
          success: true,
          message: "Deposit already credited."
        });
      }
    }

    // --------------------------------------------------------
    // CALCULATE NEW BALANCE
    // --------------------------------------------------------
    const oldBalance = Number(profile.balance) || 0;
    const newBalance =
      Math.round((oldBalance + amountRounded) * 100000000) /
      100000000;

    // --------------------------------------------------------
    // UPDATE USER BALANCE
    // --------------------------------------------------------
    const { error: balanceError } =
      await supabase
        .from("profiles")
        .update({
          balance: newBalance
        })
        .eq("id", custom);

    if (balanceError) {
      console.error(
        "Balance update error:",
        balanceError
      );

      return jsonResponse({
        success: false,
        error: "Could not update user balance."
      }, 500);
    }

    // --------------------------------------------------------
    // SAVE TRANSACTION
    // --------------------------------------------------------
    if (transactionId) {
      const { error: insertError } =
        await supabase
          .from("deposit_transactions")
          .insert({
            transaction_id: String(transactionId),
            user_id: custom,
            amount: amountRounded,
            currency: "USDT"
          });

      if (insertError) {
        console.error(
          "Deposit transaction record error:",
          insertError
        );

        // IMPORTANT:
        // Balance was already updated.
        // Returning 200 prevents FaucetPay from repeatedly
        // retrying the callback.
        return jsonResponse({
          success: true,
          message: "Deposit credited, transaction record warning.",
          amount: amountRounded
        });
      }
    }

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------
    console.log(
      `CYBERSTRIKE DEPOSIT SUCCESS: user=${custom}, amount=${amountRounded} USDT, transaction=${transactionId}`
    );

    return jsonResponse({
      success: true,
      message: "Deposit successfully credited.",
      user_id: custom,
      amount: amountRounded,
      currency: "USDT",
      transaction_id: transactionId,
      old_balance: oldBalance,
      new_balance: newBalance
    }, 200);

  } catch (error) {
    console.error(
      "Deposit function fatal error:",
      error
    );

    return jsonResponse({
      success: false,
      error: "Internal deposit processing error."
    }, 500);
  }
});
