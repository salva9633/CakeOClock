import ContactMessage from "../../models/contactMessageModel.js";

export const myMessages = async (req, res) => {
  try {
    const email = req.session.user.email;
    const messages = await ContactMessage.find({ email })
      .sort({ createdAt: -1 }).lean();
    res.render("myMessages", { messages, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
};

export const viewMyMessage = async (req, res) => {
  try {
    const email = req.session.user.email;
    const msg = await ContactMessage.findOne({
      _id: req.params.id, email
    }).lean();
    if (!msg) return res.redirect("/my-messages");
    res.render("myMessageDetail", { msg, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.redirect("/my-messages");
  }
};