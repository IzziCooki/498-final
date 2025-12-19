// backend/modules/email-utils.js
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

// TODO: Configure this with your email service provider's details
// For Gmail, you may need to use an "App Password" if you have 2-Step Verification enabled.
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address from .env file
        pass: process.env.EMAIL_PASS, // Your Gmail password or App Password from .env file
    },
});

async function sendPasswordResetEmail(to, token) {
        const resetLink = `http://deanhauser.me/reset-password/${token}`;
    const mailOptions = {
        from: `"COS498 Final" <${process.env.EMAIL_USER}>`,
        to: to, 
        subject: 'Password Reset Request',
        html: `
            <p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>
            <p>Please click on the following link, or paste this into your browser to complete the process:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Password reset email sent to:', to);
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('Could not send password reset email');
    }
}

module.exports = {
    sendPasswordResetEmail,
};
