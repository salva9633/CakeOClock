import CustomizedCake from "../../models/customizedCakeModel.js";
  import Cart from "../../models/cartModel.js";


// ─────────────────────────────────────
// ALL CUSTOMIZED CAKE REQUESTS
// ─────────────────────────────────────

export const loadCustomizedCakes =
  async (req, res) => {

    try {

      const requests =
        await CustomizedCake.find()
          .populate(
            "userId",
            "name email phone"
          )
          .sort({
            createdAt: -1
          })
          .lean();


      res.render(
        "admin/customizedCake",
        {
          requests,
          title:
            "Customized Cake Management"
        }
      );


    } catch (error) {

      console.error(
        "Load customized cakes error:",
        error
      );

      res.status(500).send(
        "Server Error"
      );
    }
  };


// ─────────────────────────────────────
// SINGLE REQUEST
// ─────────────────────────────────────

export const loadCustomizedCakeDetail =
  async (req, res) => {

    try {

      const request =
        await CustomizedCake.findById(
          req.params.id
        )
        .populate(
          "userId",
          "name email phone"
        )
        .lean();


      if (!request) {

        return res.status(404).send(
          "Customized cake request not found"
        );
      }


      res.render(
        "admin/customizedCakeDetail",
        {
          request,
          title:
            "Customized Cake Details"
        }
      );


    } catch (error) {

      console.error(error);

      res.status(500).send(
        "Server Error"
      );
    }
  };


// ─────────────────────────────────────
// UPDATE STATUS
// ─────────────────────────────────────

export const updateCustomizedCakeStatus =
  async (req, res) => {

    try {

      const { status } = req.body;


      const allowedStatuses = [
        "pending",
        "reviewing",
        "quoted",
        "approved",
        "in-production",
        "ready",
        "delivered",
        "cancelled"
      ];


      if (
        !allowedStatuses.includes(status)
      ) {

        return res.status(400).json({
          success: false,
          message: "Invalid status"
        });
      }


      const cake = await CustomizedCake.findById(req.params.id);

      if (!cake) {
        return res.status(404).json({
          success: false,
          message: "Request not found"
        });
      }

      // Block "quoted" unless a valid price already exists
      if (
        status === "quoted" &&
        (!cake.quotedPrice || cake.quotedPrice <= 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "Please set a quotation price first using 'Send Quotation'"
        });
      }

      cake.status = status;
      await cake.save();


      res.json({
        success: true,
        message: "Status updated"
      });


    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  };


// ─────────────────────────────────────
// UPDATE QUOTE
// ─────────────────────────────────────

export const updateCustomizedCakeQuote =
  async (req, res) => {

    try {

      const {
        quotedPrice,
        adminNote
      } = req.body;


      const price =
        Number(quotedPrice);


      if (
        !price ||
        price <= 0
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid price"
        });
      }


      const request =
        await CustomizedCake.findByIdAndUpdate(
          req.params.id,
          {
            quotedPrice: price,

            adminNote:
              adminNote || "",

            status: "quoted"
          },
          {
            new: true
          }
        );


      if (!request) {

        return res.status(404).json({
          success: false,
          message:
            "Request not found"
        });
      }


      res.json({
        success: true,
        message:
          "Quotation sent successfully"
      });


    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  };


export const addCustomizedCakeToCart = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const customizedCakeId = req.params.id;

    const customizedCake = await CustomizedCake.findOne({
      _id: customizedCakeId,
      userId
    });

    if (!customizedCake) {
      return res.redirect("/my-customizedCakes?error=Customized+cake+not+found");
    }

    if (customizedCake.status !== "quoted" || !customizedCake.quotedPrice || customizedCake.quotedPrice <= 0) {
      return res.redirect("/my-customizedCakes?error=This+cake+is+not+ready+for+checkout+yet");
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const alreadyInCart = cart.items.some(
      item => item.customizedCakeId?.toString() === customizedCakeId.toString()
    );
    if (alreadyInCart) {
      return res.redirect("/cart");
    }

    cart.items.push({
      customizedCakeId,
      quantity: 1,
      price: customizedCake.quotedPrice
    });

    await cart.save();
    return res.redirect("/cart");

  } catch (err) {
    console.error("addCustomizedCakeToCart error:", err);
    return res.redirect("/my-customizedCakes?error=Something+went+wrong");
  }
};