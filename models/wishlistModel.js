import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
{
   userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
   },

   products: [
      {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: false,   // ← changed
         },

         variantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Variant",
            required: false,   // ← changed
         },
      },
   ],
},
{
   timestamps: true,
}
);

export default mongoose.model("Wishlist", wishlistSchema);
 