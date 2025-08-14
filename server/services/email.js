const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Email templates
const templates = {
  'email-verification': {
    subject: 'Welcome to JobsRo - Verify Your Email',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to JobsRo!</h1>
        </div>
        
        <div style="padding: 40px 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hi {{name}},</h2>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            Thank you for joining JobsRo, India's premier job portal powered by AI technology!
          </p>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            To get started, please verify your email address by clicking the button below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{verificationUrl}}" 
               style="background: #28a745; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; font-weight: bold;
                      display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="{{verificationUrl}}" style="color: #007bff;">{{verificationUrl}}</a>
          </p>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            This link will expire in 24 hours for security reasons.
          </p>
        </div>
        
        <div style="background: #343a40; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">
            © 2024 JobsRo. All rights reserved.<br>
            Need help? Contact us at support@jobsro.com
          </p>
        </div>
      </div>
    `
  },

  'password-reset': {
    subject: 'JobsRo - Password Reset Request',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
        </div>
        
        <div style="padding: 40px 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hi {{name}},</h2>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            We received a request to reset your JobsRo account password.
          </p>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            Click the button below to reset your password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{resetUrl}}" 
               style="background: #dc3545; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; font-weight: bold;
                      display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="{{resetUrl}}" style="color: #007bff;">{{resetUrl}}</a>
          </p>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            This link will expire in 1 hour for security reasons.
          </p>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If you didn't request this password reset, please ignore this email or contact support if you have concerns.
          </p>
        </div>
        
        <div style="background: #343a40; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">
            © 2024 JobsRo. All rights reserved.<br>
            Need help? Contact us at support@jobsro.com
          </p>
        </div>
      </div>
    `
  },

  'job-alert': {
    subject: 'New Jobs Match Your Preferences - JobsRo',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">New Job Opportunities</h1>
        </div>
        
        <div style="padding: 40px 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hi {{name}},</h2>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            We found {{jobCount}} new job opportunities that match your preferences:
          </p>
          
          {{#each jobs}}
          <div style="border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0; background: white;">
            <h3 style="color: #333; margin-top: 0;">
              <a href="{{jobUrl}}" style="color: #007bff; text-decoration: none;">{{title}}</a>
            </h3>
            <p style="color: #666; margin: 10px 0;">
              <strong>{{companyName}}</strong> • {{location}}
            </p>
            <p style="color: #666; font-size: 14px;">{{summary}}</p>
            <p style="color: #28a745; margin: 10px 0;">{{salary}}</p>
          </div>
          {{/each}}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{viewAllUrl}}" 
               style="background: #28a745; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; font-weight: bold;
                      display: inline-block;">
              View All Jobs
            </a>
          </div>
        </div>
        
        <div style="background: #343a40; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">
            © 2024 JobsRo. All rights reserved.<br>
            <a href="{{unsubscribeUrl}}" style="color: #adb5bd;">Unsubscribe from job alerts</a>
          </p>
        </div>
      </div>
    `
  },

  'application-status': {
    subject: 'Application Status Update - JobsRo',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Application Update</h1>
        </div>
        
        <div style="padding: 40px 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hi {{name}},</h2>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            Your application status has been updated:
          </p>
          
          <div style="border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0; background: white;">
            <h3 style="color: #333; margin-top: 0;">{{jobTitle}}</h3>
            <p style="color: #666; margin: 10px 0;">
              <strong>{{companyName}}</strong>
            </p>
            <p style="color: #666; font-size: 16px; margin: 15px 0;">
              Status: <strong style="color: {{statusColor}};">{{status}}</strong>
            </p>
            {{#if message}}
            <p style="color: #666; font-size: 14px;">{{message}}</p>
            {{/if}}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{applicationUrl}}" 
               style="background: #007bff; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; font-weight: bold;
                      display: inline-block;">
              View Application
            </a>
          </div>
        </div>
        
        <div style="background: #343a40; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">
            © 2024 JobsRo. All rights reserved.<br>
            Need help? Contact us at support@jobsro.com
          </p>
        </div>
      </div>
    `
  },

  'interview-scheduled': {
    subject: 'Interview Scheduled - JobsRo',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Interview Scheduled</h1>
        </div>
        
        <div style="padding: 40px 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hi {{name}},</h2>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            Great news! An interview has been scheduled for your application:
          </p>
          
          <div style="border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0; background: white;">
            <h3 style="color: #333; margin-top: 0;">{{jobTitle}}</h3>
            <p style="color: #666; margin: 10px 0;">
              <strong>{{companyName}}</strong>
            </p>
            <p style="color: #666; font-size: 16px; margin: 15px 0;">
              <strong>Date & Time:</strong> {{interviewDateTime}}
            </p>
            <p style="color: #666; font-size: 16px; margin: 15px 0;">
              <strong>Duration:</strong> {{duration}} minutes
            </p>
            <p style="color: #666; font-size: 16px; margin: 15px 0;">
              <strong>Platform:</strong> {{platform}}
            </p>
            {{#if meetingUrl}}
            <div style="text-align: center; margin: 20px 0;">
              <a href="{{meetingUrl}}" 
                 style="background: #28a745; color: white; padding: 15px 30px; 
                        text-decoration: none; border-radius: 5px; font-weight: bold;
                        display: inline-block;">
                Join Interview
              </a>
            </div>
            {{/if}}
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            Please make sure to join the meeting on time. Good luck!
          </p>
        </div>
        
        <div style="background: #343a40; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">
            © 2024 JobsRo. All rights reserved.<br>
            Need help? Contact us at support@jobsro.com
          </p>
        </div>
      </div>
    `
  }
};

// Template rendering function
const renderTemplate = (templateName, data) => {
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Template ${templateName} not found`);
  }

  let html = template.html;
  
  // Simple template replacement (for production, consider using a proper template engine)
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, data[key] || '');
  });

  // Handle conditional blocks
  html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
    return data[condition] ? content : '';
  });

  // Handle loops (basic implementation)
  html = html.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (match, arrayName, content) => {
    if (data[arrayName] && Array.isArray(data[arrayName])) {
      return data[arrayName].map(item => {
        let itemContent = content;
        Object.keys(item).forEach(key => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          itemContent = itemContent.replace(regex, item[key] || '');
        });
        return itemContent;
      }).join('');
    }
    return '';
  });

  return {
    subject: template.subject,
    html
  };
};

// Main send email function
const sendEmail = async ({ to, subject, template, data, html, text }) => {
  try {
    let emailContent = {};

    if (template && data) {
      emailContent = renderTemplate(template, data);
    } else {
      emailContent = { subject, html, text };
    }

    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@jobsro.com',
        name: process.env.SENDGRID_FROM_NAME || 'JobsRo'
      },
      subject: emailContent.subject || subject,
      html: emailContent.html || html,
      text: emailContent.text || text
    };

    if (process.env.NODE_ENV === 'development' && !process.env.SENDGRID_API_KEY) {
      logger.info('Email would be sent (dev mode):', {
        to: msg.to,
        subject: msg.subject,
        from: msg.from
      });
      return { success: true, messageId: 'dev-mode' };
    }

    const result = await sgMail.send(msg);
    logger.info('Email sent successfully:', {
      to: msg.to,
      subject: msg.subject,
      messageId: result[0].headers['x-message-id']
    });

    return { success: true, messageId: result[0].headers['x-message-id'] };
  } catch (error) {
    logger.error('Email send failed:', {
      error: error.message,
      to,
      subject: subject || template
    });
    throw error;
  }
};

// Bulk email function
const sendBulkEmails = async (emails) => {
  try {
    const messages = emails.map(email => {
      let emailContent = {};
      
      if (email.template && email.data) {
        emailContent = renderTemplate(email.template, email.data);
      }

      return {
        to: email.to,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@jobsro.com',
          name: process.env.SENDGRID_FROM_NAME || 'JobsRo'
        },
        subject: emailContent.subject || email.subject,
        html: emailContent.html || email.html,
        text: emailContent.text || email.text
      };
    });

    if (process.env.NODE_ENV === 'development' && !process.env.SENDGRID_API_KEY) {
      logger.info(`Bulk emails would be sent (dev mode): ${messages.length} emails`);
      return { success: true, count: messages.length };
    }

    const result = await sgMail.send(messages);
    logger.info(`Bulk emails sent successfully: ${messages.length} emails`);

    return { success: true, count: messages.length, result };
  } catch (error) {
    logger.error('Bulk email send failed:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendBulkEmails,
  renderTemplate,
  templates
};