import CustomizedCake from "../../models/customizedCakeModel.js";
import User from "../../models/userModel.js";
import cloudinary from "../../config/cloudinary.js";
import Cart from "../../models/cartModel.js";


// ============================================================
// LOAD CUSTOMIZED CAKE PAGE
// ============================================================

export const loadCustomizedCakePage = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.redirect("/login");
    }

    res.render("user/customizedCake", {
  user,
  title: "Customized Cake",
  error: null,
});

  } catch (error) {
    console.error(
      "loadCustomizedCakePage error:",
      error
    );

    res.status(500).send("Server Error");
  }
};


// ============================================================
// SUBMIT CUSTOMIZED CAKE REQUEST
// ============================================================

export const submitCustomizedCake = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // --------------------------------------------------------
    // CHECK USER
    // --------------------------------------------------------

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }


    // --------------------------------------------------------
    // GET FORM DATA
    // --------------------------------------------------------

    const {
      name,
      email,
      phone,
      address,
      cakeType,
      weight,
      description,
      neededDate,
      neededTime,
      cakeMessage,
      additionalRequirements,
    } = req.body;


    // --------------------------------------------------------
    // REQUIRED FIELD VALIDATION
    // --------------------------------------------------------

    // --------------------------------------------------------
    // REQUIRED FIELD VALIDATION
    // --------------------------------------------------------

    if (
      !name ||
      !email ||
      !phone ||
      !address ||
      !cakeType ||
      !weight ||
      !description ||
      !neededDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }


    // --------------------------------------------------------
    // NAME VALIDATION
    // --------------------------------------------------------

    if (name.trim().length < 2 || name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 50 characters",
      });
    }

    if (!/^[a-zA-Z\s.'-]+$/.test(name.trim())) {
      return res.status(400).json({
        success: false,
        message: "Name contains invalid characters",
      });
    }


    // --------------------------------------------------------
    // EMAIL VALIDATION
    // --------------------------------------------------------

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }


    // --------------------------------------------------------
    // PHONE VALIDATION
    // --------------------------------------------------------

    const phoneRegex = /^[6-9]\d{9}$/;

    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit phone number",
      });
    }


    // --------------------------------------------------------
    // ADDRESS VALIDATION
    // --------------------------------------------------------

    if (address.trim().length < 10 || address.trim().length > 300) {
      return res.status(400).json({
        success: false,
        message: "Address must be between 10 and 300 characters",
      });
    }


    // --------------------------------------------------------
    // CAKE TYPE VALIDATION
    // --------------------------------------------------------

    const allowedCakeTypes = [
      "Chocolate",
      "Vanilla",
      "Red Velvet",
      "Butterscotch",
      "Black Forest",
      "Other",
    ];

    if (!allowedCakeTypes.includes(cakeType.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid cake type selected",
      });
    }


    // --------------------------------------------------------
    // WEIGHT VALIDATION
    // --------------------------------------------------------

    const allowedWeights = [
      "500g",
      "1kg",
      "1.5kg",
      "2kg",
      "3kg",
      "4kg",
      "5kg",
    ];

    if (!allowedWeights.includes(weight.trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid weight selected",
      });
    }


    // --------------------------------------------------------
    // DESCRIPTION VALIDATION
    // --------------------------------------------------------

    if (description.trim().length < 10 || description.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Description must be between 10 and 1000 characters",
      });
    }


    // --------------------------------------------------------
    // NEEDED DATE VALIDATION
    // --------------------------------------------------------

    const parsedDate = new Date(neededDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid date",
      });
    }

    if (parsedDate < today) {
      return res.status(400).json({
        success: false,
        message: "Needed date cannot be in the past",
      });
    }


    // --------------------------------------------------------
    // NEEDED TIME VALIDATION (optional field)
    // --------------------------------------------------------

    if (neededTime) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(neededTime.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid time",
        });
      }
    }


    // --------------------------------------------------------
    // CAKE MESSAGE VALIDATION (optional field)
    // --------------------------------------------------------

    if (cakeMessage && cakeMessage.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Cake message must be under 100 characters",
      });
    }


    // --------------------------------------------------------
    // ADDITIONAL REQUIREMENTS VALIDATION (optional field)
    // --------------------------------------------------------

    if (
      additionalRequirements &&
      additionalRequirements.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "Additional requirements must be under 500 characters",
      });
    }


    // --------------------------------------------------------
    // IMAGE
    // --------------------------------------------------------

    // --------------------------------------------------------
    // IMAGE
    // --------------------------------------------------------

    let referenceImage = "";

if (req.file) {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSizeBytes = 5 * 1024 * 1024; // 5MB

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: "Only JPG, PNG, and WEBP images are allowed",
    });
  }

  if (req.file.size > maxSizeBytes) {
    return res.status(400).json({
      success: false,
      message: "Image size must be under 5MB",
    });
  }

  try {
    // multer is configured with memoryStorage, so the file
    // arrives as a buffer (req.file.buffer), not a disk path.
    // Stream that buffer straight to Cloudinary.
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "customized-cakes" },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    referenceImage = uploadResult.secure_url;
  } catch (uploadError) {
    console.error("Cloudinary upload error:", uploadError);
    return res.status(400).json({
      success: false,
      message: "Reference image upload failed",
    });
  }
}

    // --------------------------------------------------------
    // CREATE CUSTOMIZED CAKE
    // --------------------------------------------------------

    const customizedCake =
      await CustomizedCake.create({

        userId,

        name: name.trim(),

        email: email.trim().toLowerCase(),

        phone: phone.trim(),

        address: address.trim(),

        cakeType: cakeType.trim(),

        weight: weight.trim(),

        description:
          description
            ? description.trim()
            : "",

        referenceImage,

        neededDate:
          neededDate || null,

        neededTime:
          neededTime
            ? neededTime.trim()
            : "",

        cakeMessage:
          cakeMessage
            ? cakeMessage.trim()
            : "",

        additionalRequirements:
          additionalRequirements
            ? additionalRequirements.trim()
            : "",

        quotedPrice: 0,

        adminNote: "",

        paymentStatus: "pending",

        status: "pending",
      });


    // --------------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------------

    // --------------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------------

    return res.redirect(
      `/customizedCake/success/${customizedCake._id}`
    );

  } catch (error) {

    console.error(
      "submitCustomizedCake error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


// ============================================================
// CUSTOMIZED CAKE SUCCESS PAGE
// ============================================================

export const customizedCakeSuccess = async (
  req,
  res
) => {
  try {

    const userId = req.session.user.id;

    const customizedCakeId =
      req.params.id;


    const customizedCake =
      await CustomizedCake.findOne({
        _id: customizedCakeId,
        userId,
      });


    if (!customizedCake) {
      return res.status(404).send(
        "Customized cake request not found"
      );
    }


    res.render(
  "user/customizedCakeSuccess",
      {
        customizedCake,
      }
    );

  } catch (error) {

    console.error(
      "customizedCakeSuccess error:",
      error
    );

    res.status(500).send(
      "Server Error"
    );
  }
};


// ============================================================
// MY CUSTOMIZED CAKES
// ============================================================

export const myCustomizedCakes = async (
  req,
  res
) => {
  try {

    const userId =
      req.session.user.id;

    // --------------------------------------------------------
    // PAGINATION
    // --------------------------------------------------------

    const page = parseInt(req.query.page) || 1;
    const limit = 2;
    const skip = (page - 1) * limit;

    const totalCakes = await CustomizedCake.countDocuments({ userId });
    const totalPages = Math.ceil(totalCakes / limit);

    const customizedCakes =
      await CustomizedCake.find({
        userId,
      })
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit);


    res.render(
    "user/myCustomizedCakes",

      {
        customizedCakes,
        currentPage: page,
        totalPages,
      }
    );

  } catch (error) {

    console.error(
      "myCustomizedCakes error:",
      error
    );

    res.status(500).send(
      "Server Error"
    );
  }
};

// ============================================================
// LOAD CUSTOMIZED CAKE CHECKOUT
// ============================================================

export const loadCustomizedCakeCheckout =
  async (req, res) => {

    try {

      // ------------------------------------------------------
      // USER ID
      // ------------------------------------------------------

      const userId =
        req.session.user.id;


      // ------------------------------------------------------
      // CUSTOMIZED CAKE ID
      // ------------------------------------------------------

      const customizedCakeId =
        req.params.id;


      // ------------------------------------------------------
      // GET USER + CUSTOM CAKE
      // ------------------------------------------------------

      const [user, customizedCake] =
        await Promise.all([

          User.findById(userId),

          CustomizedCake.findOne({
            _id: customizedCakeId,
            userId: userId,
          }).lean(),

        ]);


      // ------------------------------------------------------
      // USER CHECK
      // ------------------------------------------------------

      if (!user) {
        return res.redirect("/login");
      }


      // ------------------------------------------------------
      // CUSTOM CAKE CHECK
      // ------------------------------------------------------

      if (!customizedCake) {

        return res.status(404).send(
          "Customized cake request not found"
        );
      }


      // ------------------------------------------------------
      // QUOTE CHECK
      // ------------------------------------------------------

      if (
        customizedCake.status !== "quoted" ||
        !customizedCake.quotedPrice ||
        Number(customizedCake.quotedPrice) <= 0
      ) {

        return res.status(400).send(
          "This customized cake is not ready for checkout"
        );
      }


      // ------------------------------------------------------
      // DEFAULT ADDRESS
      // ------------------------------------------------------

      const defaultAddress =
        user.addresses.find(
          (address) =>
            address.isDefault
        ) ||
        user.addresses[0] ||
        null;


      // ------------------------------------------------------
      // PRICE
      // ------------------------------------------------------

      const itemTotal =
        Number(
          customizedCake.quotedPrice
        );


      // ------------------------------------------------------
      // SHIPPING
      // ------------------------------------------------------

      const shippingCharge =
        itemTotal >= 499
          ? 0
          : 49;


      // ------------------------------------------------------
      // TAX
      // ------------------------------------------------------

      const tax = 0;


      // ------------------------------------------------------
      // FINAL TOTAL
      // ------------------------------------------------------

      const finalTotal =
        itemTotal +
        shippingCharge +
        tax;


      // ------------------------------------------------------
      // RENDER CHECKOUT PAGE
      // ------------------------------------------------------

      res.render(
        "checkout",
        {

          user,

          // ----------------------------------------------
          // CUSTOM CAKE AS CHECKOUT ITEM
          // ----------------------------------------------

          items: [

            {
              _id:
                customizedCake._id,

              productId: {

                productName:
                  "Customized Cake",

                productImages:
                  customizedCake.referenceImage
                    ? [
                        customizedCake.referenceImage,
                      ]
                    : [],
              },

              variantId: {

                weight:
                  customizedCake.weight ||
                  null,
              },

              quantity: 1,

              price: itemTotal,
            },

          ],


          // ----------------------------------------------
          // ADDRESSES
          // ----------------------------------------------

          addresses:
            user.addresses,

          selectedAddress:
            defaultAddress,


          // ----------------------------------------------
          // PRICE INFORMATION
          // ----------------------------------------------

          itemTotal,

          discount: 0,

          tax,

          shippingCharge,

          finalTotal,


          // ----------------------------------------------
          // TAX CONFIG
          // ----------------------------------------------

          TAX_RATE: 0,


          // ----------------------------------------------
          // COUPONS
          // ----------------------------------------------

          coupons: [],

          couponError: null,

          orderError: null,


          // ----------------------------------------------
          // CUSTOM CAKE FLAGS
          // ----------------------------------------------

          isCustomizedCake: true,

          customizedCakeId:
            customizedCake._id.toString(),

        }
      );

    } catch (error) {

      console.error(
        "loadCustomizedCakeCheckout error:",
        error
      );

      res.status(500).send(
        "Server Error"
      );
    }
  };

  // ============================================================
// ADD CUSTOMIZED CAKE TO CART
// ============================================================

export const addCustomizedCakeToCart = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const customizedCakeId = req.params.id;

    const customizedCake = await CustomizedCake.findOne({
      _id: customizedCakeId,
      userId,
    });

    if (!customizedCake) {
      return res.status(404).send(
        "Customized cake request not found"
      );
    }

    if (
      customizedCake.status !== "quoted" ||
      !customizedCake.quotedPrice ||
      Number(customizedCake.quotedPrice) <= 0
    ) {
      return res.status(400).send(
        "This customized cake is not ready for checkout"
      );
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const alreadyInCart = cart.items.some(
      (item) =>
        item.customizedCakeId &&
        item.customizedCakeId.toString() === customizedCakeId.toString()
    );

    if (!alreadyInCart) {
      cart.items.push({
        customizedCakeId,
        quantity: 1,
        price: Number(customizedCake.quotedPrice),
      });
      await cart.save();
    }

    return res.redirect("/cart");

  } catch (error) {
    console.error("addCustomizedCakeToCart error:", error);
    res.status(500).send("Server Error");
  }
};