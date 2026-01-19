const User = require("../../models/userModel");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt")
const env = require("dotenv").config()
const loadHomepage = async (req, res) => {
    try {
        if (req.session.user) {
            const userData = await User.findOne({
                _id: req.session.user.id
            });

            return res.render("home", {
                user: userData
            });
        } else {
            return res.render("home", {
                user: null
            });
        }

    } catch (error) {
        console.log("home page not found", error);
        res.status(500).send("server error");
    }
};


const signuppage = async (req, res) => {
    try {
        return res.render("signUp");
    } catch (error) {
        console.log("error in the signUp page", error);
        res.status(500).send("server error");
    }
};
const verifyOtpPage = async (req, res) => {
    try {
        return res.render("verify-otp");
    } catch (error) {
        console.log("error in the signUp page", error);
        res.status(500).send("server error");
    }
};

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({

            service: "gmail",
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })
        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "veryfy your account",
            text: `your otp is ${otp}`,
            html: `<b> your OTP: ${otp} </b>`,

        })

        return info.accepted.length > 0

    } catch (error) {

        console.error("Error sending email", error);
        return false;

    }
}




const createUser = async (req, res) => {
    try {
        const { name, phone, email, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });

        }

        const findUser = await User.findOne({ email });
        if (findUser) {

            return res.status(400).json({
                success: false,
                message: "User already exists"
            });

        }

        const otp = generateOtp();
        console.log("Generated OTP:", otp);


        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: "Email sending failed"
            });

        }


        req.session.userOtp = otp;
        req.session.otpExpiry = Date.now() + 5 * 60 * 1000;
        req.session.userData = { name, phone, email, password };

        return res.status(200).json({
            success: true,
            message: "User created"
        });

    } catch (error) {

        console.error("sign error", error)
        return res.status(500).json({
            success: false,
            message: "Server error"
        });


    }
}

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.userOtp || !req.session.userData) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (Date.now() > req.session.otpExpiry) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (otp !== req.session.userOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const { name, phone, email, password } = req.session.userData;

    // ✅ Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { phone }] });

    if (!user) {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);

      user = new User({
        name,
        phone,
        email,
        password: hashedPassword,
        isVerified: true
      });

      await user.save();
    } else {
      // User exists → just verify
      user.isVerified = true;
      await user.save();
    }

    // ✅ Create login session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email
    };

    
    delete req.session.userOtp;
    delete req.session.userData;
    delete req.session.otpExpiry;

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.log("OTP verify error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


const resendOtp = async (req, res) => {
    try {
        if (!req.session.userData) {
            return res.status(400).json({ message: "Session expired. Signup again." });
        }

        const email = req.session.userData.email;

        const otp = generateOtp();
        req.session.userOtp = otp;
        req.session.otpExpiry = Date.now() + 5 * 60 * 1000;

        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.status(500).json({ message: "Failed to resend OTP" });
        }

        res.status(200).json({ message: "OTP resent successfully" });

    } catch (error) {
        console.log("Resend OTP error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const loadlogin = async (req, res) => {
    try {
        return res.render("login")
    } catch (error) {
        console.log("error in the loginpage", error);
        res.status(500).send("server side error");
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        if (!user.password) {
            return res.status(400).json({
                message: "Please login using Google"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Wrong password" });
        }

        if (user.isBlocked) {
            return res.status(403).json({ message: "Your account is blocked" });
        }

        // ✅ create session manually
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email
        };

        return res.status(200).json({
            message: "Login success"
        });

    } catch (error) {
        console.log("login error:", error);
        res.status(500).json({ message: "Server error" });
    }
};



const logout= async(req,res)=>{
    try{
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message);
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
    }catch(error){
        console.log("Logout error",error)
        res.redirect("/pageNotFound")
    }
}









module.exports = {
    loadHomepage,
    signuppage,
    verifyOtpPage,
    createUser,
    verifyOtp,
    resendOtp,
    loadlogin,
    loginUser,
    logout
};
