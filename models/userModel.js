const { name } = require("ejs")
const mongoose = require("mongoose")

const userSchema= new mongoose.Schema({
    name:{
        type:String,
        required:true
    },

    email:{
        type:String,
        unique:true,
        required:true,
        
    },

  phone:{
    type:String,
    required:false,
    unique:true,
    sparse:true,
    default:null
  },
    googleId:{
        type:String,
        default:null
    },
    password:{
        type:String,
        required: false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    t:{
        type:Boolean,
        default:false
    },
    createdOn:{
        type:Date,
        default:Date.now
    }
});
module.exports=mongoose.model("User",userSchema);