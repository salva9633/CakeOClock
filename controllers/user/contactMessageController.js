import ContactMessage from "../../models/Contactmessagemodel.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD
  }
});

// ── GET /my-messages ───────────────────────────────────
// ── GET /my-messages ───────────────────────────────────
export const myMessages = async (req, res) => {
  try {
    const email   = req.session.user.email;
    const page    = parseInt(req.query.page) || 1;
    const perPage = 5;
    const skip    = (page - 1) * perPage;

    const filter = { email };

    const [tickets, totalCount] = await Promise.all([
      ContactMessage.find(filter).sort({ lastActivityAt: -1 }).skip(skip).limit(perPage),
      ContactMessage.countDocuments(filter)
    ]);

    // lazy auto-close pass
    for (const t of tickets) {
      if (t.applyAutoClose()) await t.save();
    }

    const totalPages = Math.ceil(totalCount / perPage) || 1;

    res.render("myMessages", {
      messages: tickets,
      user: req.session.user,
      currentPage: page,
      totalPages,
      perPage,
      totalCount
    });
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
};

// ── GET /my-messages/:id ───────────────────────────────
export const viewMyMessage = async (req, res) => {
  try {
    const email = req.session.user.email;
    const msg = await ContactMessage.findOne({ _id: req.params.id, email });
    if (!msg) return res.redirect("/my-messages");

    if (msg.applyAutoClose()) await msg.save();

    res.render("myMessageDetail", { msg, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.redirect("/my-messages");
  }
};

// ── POST /my-messages/:id/reply ────────────────────────
export const replyToTicket = async (req, res) => {
  try {
    const email = req.session.user.email;
    const { replyText } = req.body;

    if (!replyText || !replyText.trim()) {
      return res.json({ success: false, message: "Message cannot be empty" });
    }

    const msg = await ContactMessage.findOne({ _id: req.params.id, email });
    if (!msg) return res.json({ success: false, message: "Ticket not found" });

    if (msg.applyAutoClose()) await msg.save();

    if (msg.status === 'closed') {
      return res.json({
        success: false,
        message: "This ticket is closed. Please start a new one."
      });
    }

    msg.messages.push({ sender: 'user', text: replyText.trim() });
    msg.status = 'in_progress'; // customer reply (re)activates the ticket
    msg.lastActivityAt = new Date();
    await msg.save();

    // notify admin
    transporter.sendMail({
      from:    `"Cake O'Clock" <${process.env.NODEMAILER_EMAIL}>`,
      to:      process.env.NODEMAILER_EMAIL,
      subject: `↩ Customer replied — Ticket #${msg.ticketNumber}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto;">
          <p><strong>${msg.name}</strong> (${msg.email}) replied to ticket #${msg.ticketNumber}</p>
          <p style="color:#444;">${replyText.replace(/\n/g, "<br>")}</p>
          <a href="${process.env.BASE_URL}/admin/contact-messages/${msg._id}">View ticket →</a>
        </div>
      `
    }).catch(e => console.error("Admin notify email failed:", e));

    res.json({ success: true, message: "Message sent!" });
  } catch (err) {
    console.error("replyToTicket error:", err);
    res.json({ success: false, message: "Something went wrong." });
  }
};