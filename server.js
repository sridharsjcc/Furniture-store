require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ================== CONFIG ==================
const SECRET = process.env.JWT_SECRET;

// CLOUDINARY
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

// MULTER
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ================== DB ==================
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ MongoDB connected"))
.catch(err=>console.log("❌ Mongo error",err));

// ================== MODELS ==================
const User = mongoose.model("User", new mongoose.Schema({
  username:String,
  password:String,
  isAdmin:Boolean,
  cart:Array
}));

const Product = mongoose.model("Product", new mongoose.Schema({
  name:String,
  price:Number,
  image:String,
  images:[String],
  description:String,
  category:String
}));

const Order = mongoose.model("Order", new mongoose.Schema({
  username:String,
  items:Array,
  total:Number,
  date:String,
  status:String
}));

// ================== AUTH ==================
function auth(req,res,next){
  try{
    const token=req.headers.authorization.split(" ")[1];
    req.user=jwt.verify(token,SECRET);
    next();
  }catch{
    res.status(401).send("Unauthorized ❌");
  }
}

// ================== IMAGE UPLOAD ==================
app.post("/upload", auth, upload.single("image"), async (req,res)=>{
  try{
    if(!req.user.isAdmin) return res.send("Admin only ❌");

    const stream = cloudinary.uploader.upload_stream(
      { folder:"furniture" },
      (err,result)=>{
        if(err) return res.send("Upload failed ❌");
        res.send({ url: result.secure_url });
      }
    );

    stream.end(req.file.buffer);

  }catch{
    res.send("Error ❌");
  }
});

// ================== AUTH ROUTES ==================
app.post("/signup", async (req,res)=>{
  const {username,password}=req.body;

  const exists=await User.findOne({username});
  if(exists) return res.send("User exists ❌");

  const hash=await bcrypt.hash(password,10);

  await User.create({
    username,
    password:hash,
    isAdmin: username==="admin",
    cart:[]
  });

  res.send("Signup success ✅");
});

app.post("/login", async (req,res)=>{
  const {username,password}=req.body;

  const user=await User.findOne({username});
  if(!user) return res.send("Invalid ❌");

  const match=await bcrypt.compare(password,user.password);
  if(!match) return res.send("Invalid ❌");

  const token=jwt.sign(
    {username:user.username,isAdmin:user.isAdmin},
    SECRET
  );

  res.send({token});
});

// ================== PRODUCTS ==================
app.get("/products", async (req,res)=>{
  res.send(await Product.find());
});

app.get("/product/:id", async (req,res)=>{
  res.send(await Product.findById(req.params.id));
});

app.post("/add-product", auth, async (req,res)=>{
  if(!req.user.isAdmin) return res.send("Admin only ❌");

  const {name,price,image,category,description}=req.body;

  await Product.create({
    name,
    price,
    image,
    images:[image],
    category,
    description
  });

  res.send("Product added ✅");
});

// ================== CART ==================
app.post("/add-to-cart", auth, async (req,res)=>{
  const user=await User.findOne({username:req.user.username});
  const p=req.body.product;

  let item=user.cart.find(i=>i.id===p._id);

  if(item) item.qty++;
  else user.cart.push({
    id:p._id,
    name:p.name,
    price:p.price,
    image:p.images?.[0]||p.image,
    qty:1
  });

  await user.save();
  res.send("Added 🛒");
});

app.post("/get-cart", auth, async (req,res)=>{
  const user=await User.findOne({username:req.user.username});
  res.send(user.cart);
});

// ================== ORDER ==================
app.post("/place-order", auth, async (req,res)=>{
  const user=await User.findOne({username:req.user.username});

  if(!user.cart.length) return res.send("Cart empty ❌");

  await Order.create({
    username:user.username,
    items:user.cart,
    total:user.cart.reduce((s,i)=>s+i.price*i.qty,0),
    date:new Date().toLocaleString(),
    status:"Placed"
  });

  user.cart=[];
  await user.save();

  res.send("Order placed ✅");
});

app.get("/my-orders", auth, async (req,res)=>{
  res.send(await Order.find({username:req.user.username}));
});

// ================== SERVER ==================
app.listen(process.env.PORT||3000,()=>{
  console.log("🚀 Server running");
});