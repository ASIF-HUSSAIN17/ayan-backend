const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const db = require("./db");
const { authenticateToken } = require("./middleware");
require("dotenv").config();

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID,
  key_secret: process.env.RZP_KEY_SECRET,
});

// Helper: get wallet by userId
async function getWalletRow(userId) {
  const [rows] = await db.query("SELECT * FROM wallets WHERE user_id = ?", [
    userId,
  ]);
  return rows[0];
}

// Create order (protected)
// frontend sends Authorization header Bearer <token>
// server uses req.user.userId so user cannot spoof
router.post("/create-order", authenticateToken, async (req, res) => {
  // console.log(authenticateToken);
  try {
    const userId = req.user.userId;
    const { amount } = req.body;
    if (!amount || isNaN(Number(amount)))
      return res.status(400).json({ error: "amount required" });

    const amountPaise = Math.round(Number(amount) * 100);

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `wallet_${userId}_${Date.now()}`,
      notes: { userId: String(userId) },
    });

    res.json(order);
  } catch (err) {
    console.error("create-order err", err);
    res
      .status(500)
      .json({ error: "order creation failed", details: err.message || err });
  }
});

// Create payment link (protected) - fallback
router.post("/create-payment-link", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;
    if (!amount || isNaN(Number(amount)))
      return res.status(400).json({ error: "amount required" });

    const payload = {
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      accept_partial: false,
      description: "Add Money to Wallet",
      customer: {
        name: "User",
        contact: "9999999999",
        email: "test@example.com",
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { userId: String(userId) },
    };

    const link = await razorpay.paymentLink.create(payload);
    res.json({ ok: true, link });
  } catch (err) {
    console.error("create-payment-link err", err);
    res
      .status(500)
      .json({
        error: "create payment link failed",
        details: err.message || err,
      });
  }
});

// Verify payment (protected) - frontend posts after checkout
router.post("/verify-payment", authenticateToken, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: "missing params" });
    }

    // verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RZP_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: "invalid signature" });
    }

    // fetch payment details
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const amountPaise = payment.amount || 0;
    const amount = amountPaise / 100;

    // get userId from payment notes or from auth
    let paymentUserId =
      (payment && payment.notes && payment.notes.userId) || null;
    const authUserId = req.user.userId;
    if (paymentUserId && String(paymentUserId) !== String(authUserId)) {
      return res.status(403).json({ error: "payment not for this user" });
    }

    const userId = authUserId;

    // credit DB wallet (atomic-ish)
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [walletRows] = await conn.query(
        "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
        [userId]
      );
      if (!walletRows.length) {
        // create wallet row if missing
        await conn.query(
          "INSERT INTO wallets (user_id, balance) VALUES (?, 0)",
          [userId]
        );
      }
      const [wRes] = await conn.query(
        "SELECT * FROM wallets WHERE user_id = ?",
        [userId]
      );
      const current = Number(wRes[0].balance || 0);
      const newBalance = (current + Number(amount)).toFixed(2);

      await conn.query("UPDATE wallets SET balance = ? WHERE user_id = ?", [
        newBalance,
        userId,
      ]);

      // ledger (optional table) - here we just log to console and return
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    console.log(
      `Credited user ${userId} with ₹${amount} via payment ${razorpay_payment_id}`
    );
    res.json({ ok: true, amountCredited: amount });
  } catch (err) {
    console.error("verify-payment err", err);
    res
      .status(500)
      .json({ error: "verification failed", details: err.message || err });
  }
});
// Deduct money from wallet
// router.post('/wallet/deduct', authenticateToken, async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     const { amount } = req.body;

//     if (!amount || isNaN(Number(amount))) {
//       return res.status(400).json({ error: 'Valid amount required' });
//     }

//     const conn = await db.getConnection();
//     try {
//       await conn.beginTransaction();

//       const [rows] = await conn.query('SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]);
//       if (!rows.length) {
//         await conn.rollback();
//         return res.status(400).json({ error: 'Wallet not found' });
//       }

//       const currentBalance = Number(rows[0].balance || 0);
//       if (currentBalance < amount) {
//         await conn.rollback();
//         return res.status(400).json({ error: 'Insufficient balance' });
//       }

//       const newBalance = (currentBalance - amount).toFixed(2);
//       await conn.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [newBalance, userId]);

//       await conn.commit();
//       return res.json({ ok: true, newBalance });
//     } catch (err) {
//       await conn.rollback();
//       throw err;
//     } finally {
//       conn.release();
//     }
//   } catch (err) {
//     console.error('deduct err', err);
//     return res.status(500).json({ error: 'server error', details: err.message });
//   }
// });
// Deduct money from wallet
router.post("/wallet/deduct", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    const amountNum = parseFloat(Number(amount).toFixed(2));
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "Valid amount required" });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        "SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE",
        [userId]
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(400).json({ error: "Wallet not found" });
      }

      // Convert to number safely
      const currentBalance = parseFloat(rows[0].balance || 0);
      if (isNaN(currentBalance)) {
        await conn.rollback();
        return res.status(500).json({ error: "Invalid balance in DB" });
      }

      if (currentBalance < amountNum) {
        await conn.rollback();
        return res.status(400).json({ error: "Insufficient balance" });
      }

      const newBalance = parseFloat((currentBalance - amountNum).toFixed(2));
      await conn.query("UPDATE wallets SET balance = ? WHERE user_id = ?", [
        newBalance,
        userId,
      ]);

      await conn.commit();
      return res.json({ ok: true, newBalance });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("deduct err", err);
    return res
      .status(500)
      .json({ error: "server error", details: err.message });
  }
});

// Get wallet balance (protected)
router.get("/wallet", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await db.query(
      "SELECT balance FROM wallets WHERE user_id = ?",
      [userId]
    );
    if (!rows.length) return res.json({ wallet: 0 });
    res.json({ wallet: Number(rows[0].balance || 0) });
  } catch (err) {
    console.error("wallet err", err);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
