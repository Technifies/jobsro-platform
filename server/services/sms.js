const twilio = require('twilio');
const logger = require('../utils/logger');

// Initialize Twilio client
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// SMS templates
const smsTemplates = {
  'interview-reminder': {
    message: 'Hi {name}! Reminder: Your interview for {jobTitle} at {companyName} is scheduled for {dateTime}. Join: {meetingUrl}'
  },
  'application-status': {
    message: 'Hi {name}! Update on your application for {jobTitle} at {companyName}: {status}. Check JobsRo app for details.'
  },
  'new-job-match': {
    message: 'Hi {name}! New job matches found on JobsRo: {jobTitle} at {companyName}. Apply now: {jobUrl}'
  },
  'verification-code': {
    message: 'Your JobsRo verification code is: {code}. Valid for 10 minutes. Don\'t share this code.'
  },
  'password-reset': {
    message: 'JobsRo: Reset your password using this code: {code}. Valid for 10 minutes.'
  },
  'job-alert': {
    message: 'JobsRo Alert: {jobCount} new jobs matching your preferences. Check the app: {appUrl}'
  },
  'subscription-expiry': {
    message: 'Hi {name}! Your JobsRo {planName} subscription expires in {days} days. Renew: {renewUrl}'
  },
  'payment-success': {
    message: 'Payment successful! Your JobsRo {planName} subscription is now active. Thank you!'
  },
  'interview-scheduled': {
    message: 'Interview scheduled! {jobTitle} at {companyName} on {dateTime}. Details: {detailsUrl}'
  }
};

// Template rendering function
const renderSMSTemplate = (templateName, data) => {
  const template = smsTemplates[templateName];
  if (!template) {
    throw new Error(`SMS template ${templateName} not found`);
  }

  let message = template.message;
  
  // Simple template replacement
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{${key}}`, 'g');
    message = message.replace(regex, data[key] || '');
  });

  return message;
};

// Main send SMS function
const sendSMS = async ({ to, template, data, message }) => {
  try {
    if (!twilioClient) {
      if (process.env.NODE_ENV === 'development') {
        logger.info('SMS would be sent (dev mode):', {
          to,
          template,
          message: template ? renderSMSTemplate(template, data) : message
        });
        return { success: true, messageId: 'dev-mode' };
      } else {
        throw new Error('Twilio not configured');
      }
    }

    let finalMessage;
    if (template && data) {
      finalMessage = renderSMSTemplate(template, data);
    } else {
      finalMessage = message;
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to)) {
      throw new Error('Invalid phone number format');
    }

    // Ensure phone number starts with +
    const formattedTo = to.startsWith('+') ? to : `+91${to}`;

    const result = await twilioClient.messages.create({
      body: finalMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedTo
    });

    logger.info('SMS sent successfully:', {
      to: formattedTo,
      template,
      messageId: result.sid
    });

    return { success: true, messageId: result.sid };
  } catch (error) {
    logger.error('SMS send failed:', {
      error: error.message,
      to,
      template
    });
    throw error;
  }
};

// Bulk SMS function
const sendBulkSMS = async (messages) => {
  try {
    if (!twilioClient && process.env.NODE_ENV !== 'development') {
      throw new Error('Twilio not configured');
    }

    const results = [];
    
    for (const msg of messages) {
      try {
        const result = await sendSMS(msg);
        results.push({ ...msg, success: true, messageId: result.messageId });
      } catch (error) {
        results.push({ ...msg, success: false, error: error.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info(`Bulk SMS completed: ${successful} successful, ${failed} failed`);

    return {
      success: true,
      total: messages.length,
      successful,
      failed,
      results
    };
  } catch (error) {
    logger.error('Bulk SMS failed:', error);
    throw error;
  }
};

// Send verification code
const sendVerificationCode = async (phoneNumber, code) => {
  return sendSMS({
    to: phoneNumber,
    template: 'verification-code',
    data: { code }
  });
};

// Send password reset code
const sendPasswordResetCode = async (phoneNumber, code) => {
  return sendSMS({
    to: phoneNumber,
    template: 'password-reset',
    data: { code }
  });
};

// Send interview reminder
const sendInterviewReminder = async (phoneNumber, interviewData) => {
  return sendSMS({
    to: phoneNumber,
    template: 'interview-reminder',
    data: {
      name: interviewData.candidateName,
      jobTitle: interviewData.jobTitle,
      companyName: interviewData.companyName,
      dateTime: interviewData.scheduledAt,
      meetingUrl: interviewData.meetingUrl
    }
  });
};

// Send application status update
const sendApplicationStatusUpdate = async (phoneNumber, applicationData) => {
  return sendSMS({
    to: phoneNumber,
    template: 'application-status',
    data: {
      name: applicationData.candidateName,
      jobTitle: applicationData.jobTitle,
      companyName: applicationData.companyName,
      status: applicationData.status
    }
  });
};

// Send job alert
const sendJobAlert = async (phoneNumber, alertData) => {
  return sendSMS({
    to: phoneNumber,
    template: 'job-alert',
    data: {
      jobCount: alertData.jobCount,
      appUrl: process.env.FRONTEND_URL || 'https://jobsro.com'
    }
  });
};

// Send subscription expiry warning
const sendSubscriptionExpiryWarning = async (phoneNumber, subscriptionData) => {
  return sendSMS({
    to: phoneNumber,
    template: 'subscription-expiry',
    data: {
      name: subscriptionData.name,
      planName: subscriptionData.planName,
      days: subscriptionData.daysRemaining,
      renewUrl: `${process.env.FRONTEND_URL}/subscription/renew`
    }
  });
};

// Send payment confirmation
const sendPaymentConfirmation = async (phoneNumber, paymentData) => {
  return sendSMS({
    to: phoneNumber,
    template: 'payment-success',
    data: {
      planName: paymentData.planName
    }
  });
};

// Validate phone number
const validatePhoneNumber = (phoneNumber) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
};

// Format Indian phone number
const formatIndianPhoneNumber = (phoneNumber) => {
  // Remove all non-digits
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // If it starts with 91, assume it's already formatted
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  
  // If it's 10 digits, assume it's an Indian number
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  
  // Return as-is if it already has country code
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }
  
  throw new Error('Invalid phone number format');
};

module.exports = {
  sendSMS,
  sendBulkSMS,
  sendVerificationCode,
  sendPasswordResetCode,
  sendInterviewReminder,
  sendApplicationStatusUpdate,
  sendJobAlert,
  sendSubscriptionExpiryWarning,
  sendPaymentConfirmation,
  validatePhoneNumber,
  formatIndianPhoneNumber,
  renderSMSTemplate,
  smsTemplates
};