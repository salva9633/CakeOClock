import ChatSession from "../../models/chatSessionModel.js";

const MAX_MESSAGES = 30;

const getSessionExpiry = () => {
  const ttlMinutes = Number(process.env.CHAT_SESSION_TTL_MINUTES);

  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
    throw new Error("CHAT_SESSION_TTL_MINUTES is not configured correctly");
  }

  return new Date(Date.now() + ttlMinutes * 60 * 1000);
};

const trimMessages = (messages) => {
  if (messages.length <= MAX_MESSAGES) {
    return messages;
  }

  return messages.slice(-MAX_MESSAGES);
};

const chatbotController = {
  getSession: async (req, res) => {
    try {
      const userId = req.user._id;

      const chatSession = await ChatSession.findOne({
        userId,
        expiresAt: { $gt: new Date() },
      }).lean();

      if (!chatSession) {
        return res.json({
          success: true,
          messages: [],
        });
      }

      return res.json({
        success: true,
        messages: chatSession.messages || [],
      });
    } catch (error) {
      console.error("Chat session error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to load chat session.",
      });
    }
  },
  sendMessage: async (req, res) => {
    try {
      const message = req.body.message?.trim();

      if (!message) {
        return res.status(400).json({
          success: false,
          message: "Message cannot be empty.",
        });
      }

      if (message.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Message is too long.",
        });
      }

      const userId = req.user._id;

      /*
       * Find the user's current chatbot session.
       *
       * We explicitly check expiresAt because MongoDB's TTL
       * monitor may take some time to physically delete a
       * document after it expires.
       */
      const now = new Date();
const expiresAt = getSessionExpiry();

      let chatSession = await ChatSession.findOne({
        userId,
      });

      if (!chatSession) {
        try {
          chatSession = await ChatSession.create({
            userId,
            messages: [],
            expiresAt,
          });
        } catch (error) {
          if (error.code !== 11000) {
            throw error;
          }

          chatSession = await ChatSession.findOne({
            userId,
          });

          if (!chatSession) {
            throw error;
          }
        }
      }

      if (chatSession.expiresAt <= now) {
        chatSession.messages = [];
        chatSession.expiresAt = expiresAt;
      }

      /*
       * Send the message to the chatbot service.
       */
      const response = await fetch(
        "http://127.0.0.1:8000/chat/message",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Service-Key": process.env.CHATBOT_SERVICE_KEY,
          },
          body: JSON.stringify({
            message,
            userId: userId.toString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Chatbot service returned ${response.status}`
        );
      }

      const data = await response.json();

      if (!data.success || !data.response) {
        throw new Error("Invalid response from chatbot service");
      }

      /*
       * Only save the conversation after the chatbot service
       * successfully returns a response.
       */
      chatSession.messages.push({
        role: "user",
        content: message,
      });

      chatSession.messages.push({
        role: "assistant",
        content: data.response,
      });

      /*
       * Keep only the most recent messages.
       */
      chatSession.messages = trimMessages(chatSession.messages);

      /*
       * Reset the expiry timer whenever the user successfully
       * chats. This makes the TTL an inactivity timeout.
       */
      chatSession.expiresAt = getSessionExpiry();

      await chatSession.save();

      return res.json({
        success: true,
        response: data.response,
      });
    } catch (error) {
      console.error(
        "Chatbot service error:",
        error.message
      );

      return res.status(503).json({
        success: false,
        message: "Chatbot service is currently unavailable.",
      });
    }
  },
};

export default chatbotController;