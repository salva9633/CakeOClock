import nodemailer from "nodemailer";

const sendVerificationEmail = async (email, otp, expiryMinutes = 5) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });

    const expiryText = expiryMinutes < 1
      ? `${Math.round(expiryMinutes * 60)} seconds`
      : `${expiryMinutes} minute${expiryMinutes > 1 ? "s" : ""}`;

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "OTP Verification",
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #eee;border-radius:10px;">
          <p style="font-size:1rem;">Your OTP is:</p>
          <p style="font-size:1.6rem;font-weight:700;letter-spacing:4px;color:#5c2823;">${otp}</p>
          <p style="font-size:0.85rem;color:#888;">This OTP will expire in <strong>${expiryText}</strong>. Do not share it with anyone.</p>
        </div>
      `
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Email error:", error);
    return false;
  }
};

export { sendVerificationEmail };
