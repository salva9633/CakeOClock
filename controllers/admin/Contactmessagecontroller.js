import ContactMessage from "../../models/Contactmessagemodel.js";
import nodemailer from "nodemailer";
import { renderAdmin } from "../../utils/renderAdmin.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD
  }
});

// ── GET /admin/contact-messages ────────────────────────
export const loadContactMessages = async (req, res) => {
  try {
    const status  = req.query.status || "all";
    const search  = req.query.search || "";
    const sort    = req.query.sort   || "newest";
    const page    = parseInt(req.query.page) || 1;
    const perPage = 10;
    const skip    = (page - 1) * perPage;

    const filter = {};
    if (status !== "all") filter.status = status;

    if (search.trim()) {
      filter.$or = [
        { name:    { $regex: search, $options: "i" } },
        { email:   { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { ticketNumber: { $regex: search, $options: "i" } },
      ];
    }

    const sortOrder = sort === "oldest" ? 1 : -1;

    const [messages, totalCount, openCount, inProgressCount, resolvedCount, closedCount] =
      await Promise.all([
        ContactMessage.find(filter).sort({ lastActivityAt: sortOrder }).skip(skip).limit(perPage),
        ContactMessage.countDocuments(filter),
        ContactMessage.countDocuments({ status: "open" }),
        ContactMessage.countDocuments({ status: "in_progress" }),
        ContactMessage.countDocuments({ status: "resolved" }),
        ContactMessage.countDocuments({ status: "closed" })
      ]);

    // lazy auto-close pass on the current page
    for (const m of messages) {
      if (m.applyAutoClose()) await m.save();
    }

    const totalPages = Math.ceil(totalCount / perPage) || 1;

    renderAdmin(req, res, "contactMessages", {
      title:        "Contact Messages",
      messages,
      activeFilter: status,
      search,
      sort,
      currentPage:  page,
      totalPages,
      perPage,
      totalCount,
      openCount,
      inProgressCount,
      resolvedCount,
      closedCount,
    });
  } catch (err) {
    console.error("loadContactMessages error:", err);
    res.redirect("/admin/dashboard");
  }
};

// ── GET /admin/contact-messages/:id ────────────────────
export const viewContactMessage = async (req, res) => {
  try {
    const msg = await ContactMessage.findById(req.params.id);
    if (!msg) return res.redirect("/admin/contact-messages");

  if (msg.applyAutoClose()) await msg.save();
msg.unreadUserCount = 0; // ← ADD THIS
await msg.save();

renderAdmin(req, res, "contactMessageDetail", { title: "Message Detail", msg });  } catch (err) {
    console.error("viewContactMessage error:", err);
    res.redirect("/admin/contact-messages");
  }
};

// ── POST /admin/contact-messages/:id/reply ─────────────
export const replyContactMessage = async (req, res) => {
  try {
    const { replyText } = req.body;
    const msg = await ContactMessage.findById(req.params.id);
    if (!msg) return res.json({ success: false, message: "Ticket not found" });

    if (!replyText || !replyText.trim()) {
      return res.json({ success: false, message: "Reply cannot be empty" });
    }

    if (msg.applyAutoClose()) {
      await msg.save();
      return res.json({ success: false, message: "This ticket is already closed." });
    }

    await transporter.sendMail({
      from:    `"Cake O'Clock Support" <${process.env.NODEMAILER_EMAIL}>`,
      to:      msg.email,
      subject: `Re: ${msg.subject} [#${msg.ticketNumber}]`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden;">
          <div style="background:#3d1a24;padding:20px 24px;">
            <h2 style="color:#e8a0b0;margin:0;font-size:1.1rem;">Reply from Cake O'Clock Support</h2>
            <p style="color:#e8a0b0cc;margin:4px 0 0;font-size:.75rem;">Ticket #${msg.ticketNumber}</p>
          </div>
          <div style="padding:24px;">
            <p>Hi <strong>${msg.name}</strong>,</p>
            <p style="color:#444;line-height:1.8;">${replyText.replace(/\n/g, "<br>")}</p>
            <p style="margin-top:24px;color:#888;font-size:.82rem;">
              Warm regards,<br>
              <strong style="color:#3d1a24;">Cake O'Clock Support Team</strong>
            </p>
          </div>
        </div>
      `
    });

   msg.messages.push({ sender: 'admin', text: replyText.trim() });
msg.unreadUserCount = (msg.unreadUserCount || 0) + 1; // ← ADD THIS
msg.status = 'in_progress';
msg.lastActivityAt = new Date();
await msg.save();

    res.json({ success: true, message: "Reply sent successfully!" });
  } catch (err) {
    console.error("replyContactMessage error:", err);
    res.json({ success: false, message: "Failed to send reply. Check mail config." });
  }
};

// ── PATCH /admin/contact-messages/:id/resolve ──────────
export const resolveTicket = async (req, res) => {
  try {
    const msg = await ContactMessage.findById(req.params.id);
    if (!msg) return res.json({ success: false, message: "Ticket not found" });

    if (msg.status === 'closed') {
      return res.json({ success: false, message: "Ticket is already closed." });
    }

    msg.status = 'resolved';
    msg.resolvedAt = new Date();
    msg.lastActivityAt = new Date();
    await msg.save();

    res.json({ success: true, message: "Ticket marked as resolved." });
  } catch (err) {
    console.error("resolveTicket error:", err);
    res.json({ success: false, message: "Something went wrong." });
  }
};

// ── DELETE /admin/contact-messages/:id ─────────────────
export const deleteContactMessage = async (req, res) => {
  try {
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
};