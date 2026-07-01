import ContactMessage from "../../models/contactMessageModel.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD
  }
});

// ── GET /admin/contact-messages ───────────────────────────────────────────────
export const loadContactMessages = async (req, res) => {
  try {
    const status  = req.query.status || "all";
    const search  = req.query.search || "";
    const sort    = req.query.sort   || "newest";
    const page    = parseInt(req.query.page) || 1;
    const perPage = 10;
    const skip    = (page - 1) * perPage;

    // Status filter
    const filter = {};
    if (status !== "all") filter.status = status;

    // Search filter
    if (search.trim()) {
      filter.$or = [
        { name:    { $regex: search, $options: "i" } },
        { email:   { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    const sortOrder = sort === "oldest" ? 1 : -1;

    const [messages, totalCount, unreadCount, repliedCount, readCount] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: sortOrder }).skip(skip).limit(perPage),
      ContactMessage.countDocuments(filter),
      ContactMessage.countDocuments({ status: "unread" }),
      ContactMessage.countDocuments({ status: "replied" }),
      ContactMessage.countDocuments({ status: "read" })
    ]);

    const totalPages = Math.ceil(totalCount / perPage) || 1;

    res.render("contactMessages", {
      title:        "Contact Messages",
      messages,
      activeFilter: status,
      search,
      sort,
      currentPage:  page,
      totalPages,
      perPage,
      totalCount,
      unreadCount,
      repliedCount,
      readCount,
    });
  } catch (err) {
    console.error("loadContactMessages error:", err);
    res.redirect("/admin/dashboard");
  }
};

// ── GET /admin/contact-messages/:id ──────────────────────────────────────────
export const viewContactMessage = async (req, res) => {
  try {
    const msg = await ContactMessage.findById(req.params.id);
    if (!msg) return res.redirect("/admin/contact-messages");

    if (msg.status === "unread") {
      msg.status = "read";
      await msg.save();
    }

    res.render("contactMessageDetail", { title: "Message Detail", msg });
  } catch (err) {
    console.error("viewContactMessage error:", err);
    res.redirect("/admin/contact-messages");
  }
};

// ── POST /admin/contact-messages/:id/reply ────────────────────────────────────
export const replyContactMessage = async (req, res) => {
  try {
    const { replyText } = req.body;
    const msg = await ContactMessage.findById(req.params.id);
    if (!msg) return res.json({ success: false, message: "Message not found" });

    if (!replyText || !replyText.trim()) {
      return res.json({ success: false, message: "Reply cannot be empty" });
    }

    await transporter.sendMail({
      from:    `"Cake O'Clock Support" <${process.env.NODEMAILER_EMAIL}>`,
      to:      msg.email,
      subject: `Re: ${msg.subject}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden;">
          <div style="background:#3d1a24;padding:20px 24px;">
            <h2 style="color:#e8a0b0;margin:0;font-size:1.1rem;">Reply from Cake O'Clock Support</h2>
          </div>
          <div style="padding:24px;">
            <p>Hi <strong>${msg.name}</strong>,</p>
            <p style="color:#444;line-height:1.8;">${replyText.replace(/\n/g, "<br>")}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <div style="background:#fdf6f8;border-left:3px solid #e8a0b0;padding:12px 16px;border-radius:0 6px 6px 0;">
              <p style="margin:0 0 6px;font-size:.78rem;color:#999;text-transform:uppercase;letter-spacing:.05em;">Your original message</p>
              <p style="margin:0;color:#666;font-size:.85rem;line-height:1.7;">${msg.message.replace(/\n/g, "<br>")}</p>
            </div>
            <p style="margin-top:24px;color:#888;font-size:.82rem;">
              Warm regards,<br>
              <strong style="color:#3d1a24;">Cake O'Clock Support Team</strong>
            </p>
          </div>
        </div>
      `
    });

    msg.adminReply = { text: replyText.trim(), repliedAt: new Date() };
    msg.status     = "replied";
    await msg.save();

    res.json({ success: true, message: "Reply sent successfully!" });
  } catch (err) {
    console.error("replyContactMessage error:", err);
    res.json({ success: false, message: "Failed to send reply. Check mail config." });
  }
};

// ── DELETE /admin/contact-messages/:id ───────────────────────────────────────
export const deleteContactMessage = async (req, res) => {
  try {
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
};