require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");

const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SECRET = "secret123";

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "furniture",
    allowed_formats: ["jpg", "png", "jpeg"]
  }
});

const upload = multer({ storage });

// ================= MONGODB =================
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ MongoDB connected"))
.catch(err=>console.log("❌ Mongo error", err));

// ================= SCHEMAS =================
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  isAdmin: Boolean,
  cart: []
});

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  images: [String],
  description: String,
  category: String
});

const User = mongoose.model("User", UserSchema);
const Product = mongoose.model("Product", ProductSchema);

// ================= AUTH =================
function auth(req,res,next){
  try{
    const token = req.headers.authorization?.split(" ")[1];
    const data = jwt.verify(token, SECRET);
    req.user = data;
    next();
  }catch{
    res.status(401).send("Unauthorized ❌");
  }
}

// ================= AUTH ROUTES =================
app.post("/signup", async (req,res)=>{
  const {username, password} = req.body;

  if(!username || !password){
    return res.send("Missing fields ❌");
  }

  const exists = await User.findOne({username});
  if(exists) return res.send("User exists ❌");

  const hash = await bcrypt.hash(password, 10);

  await User.create({
    username,
    password: hash,
    isAdmin: username === "admin",
    cart: []
  });

  res.send("Signup success ✅");
});

app.post("/login", async (req,res)=>{
  const {username, password} = req.body;

  const user = await User.findOne({username});
  if(!user) return res.send({error:"Invalid ❌"});

  const match = await bcrypt.compare(password, user.password);
  if(!match) return res.send({error:"Invalid ❌"});

  const token = jwt.sign(
    {username:user.username, isAdmin:user.isAdmin},
    SECRET
  );

  res.send({
    token,
    username:user.username,
    isAdmin:user.isAdmin
  });
});

// ================= IMAGE UPLOAD =================
app.post("/upload-image", auth, upload.single("image"), (req,res)=>{
  res.send({ url: req.file.path });
});

// ================= ADD PRODUCT (FIXED) =================
app.post("/add-product", auth, async (req,res)=>{

  if(!req.user.isAdmin){
    return res.send("Admin only ❌");
  }

  const {name, price, image, category, description} = req.body;

  if(!name || !price){
    return res.send("Missing fields ❌");
  }

  const finalImage = image && image.trim() !== ""
    ? image
    : "https://dummyimage.com/400x300/cccccc/000000&text=No+Image";

  await Product.create({
    name,
    price,
    image: finalImage,
    images: [finalImage],
    category: category || "general",
    description: description || ""
  });

  res.send("Product added ✅");
});

// ================= PRODUCTS =================
app.get("/products", async (req,res)=>{
  res.send(await Product.find());
});

app.get("/product/:id", async (req,res)=>{
  res.send(await Product.findById(req.params.id));
});

// ================= ADD TO CART (NEW FIX) =================
app.post("/add-to-cart", auth, async (req,res)=>{
  const user = await User.findOne({username: req.user.username});

  user.cart.push(req.body.product);
  await user.save();

  res.send("Added to cart ✅");
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000,()=>{
  console.log("🚀 Server running");
});