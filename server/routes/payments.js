const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query, transaction } = require('../config/database');
const { 
  authenticateJWT, 
  requireRole, 
  requireVerifiedEmail, 
  requireActiveAccount 
} = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { sendEmail } = require('../services/email');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Get subscription plans
router.get('/plans',
  async (req, res) => {
    try {
      const result = await query(`
        SELECT * FROM subscription_plans
        WHERE is_active = true
        ORDER BY price ASC
      `);

      res.json({ plans: result.rows });
    } catch (error) {
      logger.error('Get subscription plans error:', error);
      res.status(500).json({ error: 'Failed to fetch subscription plans' });
    }
  }
);

// Create Razorpay order for subscription
router.post('/create-order',
  authenticateJWT,
  requireRole(['employer', 'recruiter']),
  requireVerifiedEmail,
  requireActiveAccount,
  validate(schemas.subscription),
  async (req, res) => {
    try {
      const { plan_id } = req.body;
      const userId = req.user.id;

      // Get plan details
      const planResult = await query(
        'SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true',
        [plan_id]
      );

      if (planResult.rows.length === 0) {
        return res.status(404).json({ error: 'Subscription plan not found' });
      }

      const plan = planResult.rows[0];

      // Create Razorpay order
      const orderOptions = {
        amount: plan.price * 100, // Convert to paise
        currency: plan.currency || 'INR',
        receipt: `order_${userId}_${Date.now()}`,
        payment_capture: 1,
        notes: {
          plan_id: plan_id,
          user_id: userId,
          plan_name: plan.name
        }
      };

      const order = await razorpay.orders.create(orderOptions);

      // Store order in database
      await query(`
        INSERT INTO payments (user_id, amount, currency, razorpay_order_id, status, description)
        VALUES ($1, $2, $3, $4, 'pending', $5)
      `, [userId, plan.price, plan.currency, order.id, `Subscription: ${plan.name}`]);

      logger.info(`Payment order created: ${order.id} for user ${userId}`);

      res.json({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        plan: {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          price: plan.price
        }
      });
    } catch (error) {
      logger.error('Create payment order error:', error);
      res.status(500).json({ error: 'Failed to create payment order' });
    }
  }
);

// Verify payment and activate subscription
router.post('/verify-payment',
  authenticateJWT,
  requireRole(['employer', 'recruiter']),
  async (req, res) => {
    try {
      const { 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature,
        plan_id 
      } = req.body;
      const userId = req.user.id;

      // Verify signature
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }

      // Get plan details
      const planResult = await query(
        'SELECT * FROM subscription_plans WHERE id = $1',
        [plan_id]
      );

      if (planResult.rows.length === 0) {
        return res.status(404).json({ error: 'Subscription plan not found' });
      }

      const plan = planResult.rows[0];

      // Process subscription in transaction
      const subscription = await transaction(async (client) => {
        // Update payment status
        await client.query(`
          UPDATE payments SET
            razorpay_payment_id = $1,
            status = 'completed',
            payment_date = NOW()
          WHERE razorpay_order_id = $2 AND user_id = $3
        `, [razorpay_payment_id, razorpay_order_id, userId]);

        // Calculate subscription dates
        const startDate = new Date();
        const endDate = new Date();
        
        if (plan.billing_cycle === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (plan.billing_cycle === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }

        // Deactivate existing subscriptions
        await client.query(
          'UPDATE subscriptions SET status = $1 WHERE user_id = $2 AND status = $3',
          ['cancelled', userId, 'active']
        );

        // Create new subscription
        const subscriptionResult = await client.query(`
          INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date, auto_renew)
          VALUES ($1, $2, 'active', $3, $4, true)
          RETURNING *
        `, [userId, plan_id, startDate, endDate]);

        const newSubscription = subscriptionResult.rows[0];

        // Update employer/recruiter with subscription
        if (req.user.role === 'employer') {
          await client.query(
            'UPDATE employers SET subscription_id = $1 WHERE user_id = $2',
            [newSubscription.id, userId]
          );
        } else if (req.user.role === 'recruiter') {
          await client.query(
            'UPDATE recruiters SET subscription_id = $1 WHERE user_id = $2',
            [newSubscription.id, userId]
          );
        }

        return newSubscription;
      });

      // Send confirmation email
      try {
        await sendEmail({
          to: req.user.email,
          template: 'subscription-activated',
          data: {
            name: req.user.first_name,
            planName: plan.name,
            amount: plan.price,
            currency: plan.currency,
            billingCycle: plan.billing_cycle,
            startDate: subscription.start_date,
            endDate: subscription.end_date,
            dashboardUrl: `${process.env.FRONTEND_URL}/${req.user.role === 'employer' ? 'employer' : 'recruiter'}`
          }
        });
      } catch (emailError) {
        logger.error('Failed to send subscription confirmation email:', emailError);
      }

      logger.info(`Subscription activated: ${subscription.id} for user ${userId}`);

      res.json({
        message: 'Payment verified and subscription activated',
        subscription: {
          id: subscription.id,
          plan_name: plan.name,
          status: subscription.status,
          start_date: subscription.start_date,
          end_date: subscription.end_date
        }
      });
    } catch (error) {
      logger.error('Verify payment error:', error);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  }
);

// Get user's subscription details
router.get('/subscription',
  authenticateJWT,
  requireRole(['employer', 'recruiter']),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await query(`
        SELECT s.*, sp.name as plan_name, sp.description as plan_description,
               sp.price, sp.currency, sp.billing_cycle, sp.features,
               sp.job_posting_limit, sp.resume_access_limit, sp.featured_jobs_limit
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.user_id = $1 AND s.status IN ('active', 'trial')
        ORDER BY s.created_at DESC
        LIMIT 1
      `, [userId]);

      if (result.rows.length === 0) {
        return res.json({ subscription: null });
      }

      const subscription = result.rows[0];

      // Get usage statistics
      let usageStats = {};
      if (req.user.role === 'employer') {
        const employerResult = await query(
          'SELECT jobs_posted_count FROM employers WHERE user_id = $1',
          [userId]
        );
        if (employerResult.rows.length > 0) {
          usageStats.jobs_posted_this_month = await query(`
            SELECT COUNT(*) as count
            FROM jobs j
            JOIN employers e ON j.employer_id = e.id
            WHERE e.user_id = $1 
              AND j.created_at >= date_trunc('month', CURRENT_DATE)
              AND j.deleted_at IS NULL
          `, [userId]).then(r => parseInt(r.rows[0].count));
        }
      }

      res.json({
        subscription: {
          ...subscription,
          usage: usageStats
        }
      });
    } catch (error) {
      logger.error('Get subscription error:', error);
      res.status(500).json({ error: 'Failed to fetch subscription details' });
    }
  }
);

// Cancel subscription
router.post('/subscription/cancel',
  authenticateJWT,
  requireRole(['employer', 'recruiter']),
  async (req, res) => {
    try {
      const userId = req.user.id;

      // Update subscription status
      const result = await query(`
        UPDATE subscriptions SET
          status = 'cancelled',
          auto_renew = false,
          updated_at = NOW()
        WHERE user_id = $1 AND status = 'active'
        RETURNING *
      `, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      logger.info(`Subscription cancelled: ${result.rows[0].id} for user ${userId}`);

      res.json({
        message: 'Subscription cancelled successfully',
        subscription: result.rows[0]
      });
    } catch (error) {
      logger.error('Cancel subscription error:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }
);

// Razorpay webhook handler
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const body = req.body;

      // Verify webhook signature
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');

      if (generated_signature !== signature) {
        logger.warn('Invalid webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }

      const event = JSON.parse(body.toString());
      
      logger.info(`Razorpay webhook received: ${event.event}`);

      // Handle different event types
      switch (event.event) {
        case 'payment.captured':
          // Payment was successful
          await handlePaymentCaptured(event.payload.payment.entity);
          break;
        
        case 'payment.failed':
          // Payment failed
          await handlePaymentFailed(event.payload.payment.entity);
          break;
          
        case 'subscription.cancelled':
          // Subscription was cancelled
          await handleSubscriptionCancelled(event.payload.subscription.entity);
          break;
          
        default:
          logger.info(`Unhandled webhook event: ${event.event}`);
      }

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Helper functions for webhook handling
async function handlePaymentCaptured(payment) {
  try {
    await query(
      'UPDATE payments SET status = $1 WHERE razorpay_payment_id = $2',
      ['completed', payment.id]
    );
    logger.info(`Payment captured: ${payment.id}`);
  } catch (error) {
    logger.error('Handle payment captured error:', error);
  }
}

async function handlePaymentFailed(payment) {
  try {
    await query(
      'UPDATE payments SET status = $1 WHERE razorpay_payment_id = $2',
      ['failed', payment.id]
    );
    logger.info(`Payment failed: ${payment.id}`);
  } catch (error) {
    logger.error('Handle payment failed error:', error);
  }
}

async function handleSubscriptionCancelled(subscription) {
  try {
    await query(
      'UPDATE subscriptions SET status = $1 WHERE razorpay_subscription_id = $2',
      ['cancelled', subscription.id]
    );
    logger.info(`Subscription cancelled via webhook: ${subscription.id}`);
  } catch (error) {
    logger.error('Handle subscription cancelled error:', error);
  }
}

module.exports = router;