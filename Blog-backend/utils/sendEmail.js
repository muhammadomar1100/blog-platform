const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendVerificationEmail = async (toEmail, token) => {
    const verifyUrl = `https://postly-hx5c.onrender.com/verify-email?token=${token}`;

    await resend.emails.send({
        from: 'Postly <onboarding@resend.dev>',
        to: toEmail,
        subject: 'Verify your Postly account',
        html: `
            <h2>Welcome to Postly! 🎉</h2>
            <p>Click below to verify your email:</p>
            <a href="${verifyUrl}" style="background:#1A56DB;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">
                Verify Email
            </a>
            <p>This link expires in 24 hours.</p>
        `
    });
    console.log('✅ Email sent to:', toEmail);
};

module.exports = sendVerificationEmail;