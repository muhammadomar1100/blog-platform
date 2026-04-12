// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

// const sendVerificationEmail = async (toEmail, token) => {
//     const verifyUrl = `http://localhost:3000/verify-email?token=${token}`;

//     await transporter.sendMail({
//         from: `"Blog Platform" <${process.env.EMAIL_USER}>`,
//         to: toEmail,
//         subject: 'Verify your email address',
//         html: `
//             <h2>Welcome to Blog Platform</h2>
//             <p>Click the link below to verify your email:</p>
//             <a href="${verifyUrl}">Verify Email</a>
//             <p>This link expires in 24 hours.</p>
//         `
//     });
// };

// module.exports = sendVerificationEmail;