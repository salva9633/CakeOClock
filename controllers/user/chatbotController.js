const chatbotController = {
  sendMessage: async (req, res) => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/chat/message",
        {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            "X-Internal-Service-Key": process.env.CHATBOT_SERVICE_KEY,
            },
            body: JSON.stringify({
            message: req.body.message,
            userId: req.user._id.toString(),
            }),
        }
        );

      if (!response.ok) {
        throw new Error(`Chatbot service returned ${response.status}`);
      }

      const data = await response.json();

      return res.json(data);
    } catch (error) {
      console.error("Chatbot service error:", error.message);

      return res.status(503).json({
        success: false,
        message: "Chatbot service is currently unavailable.",
      });
    }
  },
};

export default chatbotController;