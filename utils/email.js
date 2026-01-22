const nodemailer = require("nodemailer");

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "OTP Verification",
      html: `<b>Your OTP is: ${otp}</b>`
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Email error:", error);
    return false;
  }
};

module.exports = { sendVerificationEmail };
