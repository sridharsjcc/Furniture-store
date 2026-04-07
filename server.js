const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

const SECRET = "secret123";

// ================== MONGODB CONNECT ==================
const MONGO_URI = "mongodb+srv://sridharsjcc_db_user:kokisri%4055111@cluster0.3qayq9s.mongodb.net/furniture?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
.then(()=>console.log("✅ MongoDB connected"))
.catch(err=>console.log("❌ MongoDB error:", err));

// ================== SCHEMAS ==================
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  isAdmin: Boolean,
  cart: [
    {
      id: String,
      name: String,
      price: Number,
      image: String,
      qty: Number
    }
  ]
});

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  images: [String],
  description: String
});

const OrderSchema = new mongoose.Schema({
  username: String,
  items: Array,
  total: Number,
  date: String,
  status: String
});

const User = mongoose.model("User", UserSchema);
const Product = mongoose.model("Product", ProductSchema);
const Order = mongoose.model("Order", OrderSchema);

// ================== AUTH ==================
function auth(req,res,next){
  try{
    const header = req.headers.authorization;
    if(!header) return res.status(401).send("No token ❌");

    const token = header.split(" ")[1];

    const data = jwt.verify(token, SECRET);
    req.user = data;

    next();
  }catch{
    res.status(401).send("Unauthorized ❌");
  }
}

// ================== SIGNUP ==================
app.post("/signup", async (req,res)=>{
  const {username,password} = req.body;

  if(!username || !password){
    return res.send("Missing fields ❌");
  }

  const exists = await User.findOne({username});
  if(exists) return res.send("User exists ❌");

  const hash = await bcrypt.hash(password,10);

  await User.create({
    username,
    password:hash,
    isAdmin: username==="admin",
    cart:[]
  });

  res.send("Signup success ✅");
});

// ================== LOGIN ==================
app.post("/login", async (req,res)=>{
  const {username,password} = req.body;

  const user = await User.findOne({username});
  if(!user) return res.send("Invalid ❌");

  const match = await bcrypt.compare(password,user.password);
  if(!match) return res.send("Invalid ❌");

  const token = jwt.sign(
    {username:user.username, isAdmin:user.isAdmin},
    SECRET
  );

  res.send({ token, username:user.username, isAdmin:user.isAdmin });
});

// ================== PRODUCTS ==================
app.get("/products", async (req,res)=>{
  const data = await Product.find();
  res.send(data);
});

app.get("/product/:id", async (req,res)=>{
  const product = await Product.findById(req.params.id);
  res.send(product || {});
});

// ADD PRODUCT
app.post("/add-product", auth, async (req,res)=>{

  if(!req.user.isAdmin){
    return res.send("Admin only ❌");
  }

  let {name, price, image} = req.body;

  name = name?.trim();
  image = image?.trim();
  price = Number(price);

  if(!name || !image || price <= 0){
    return res.send("Missing fields ❌");
  }

  await Product.create({
    name,
    price,
    image,
    images: [image]
  });

  res.send("Product added ✅");
});

// ================== CART ==================
app.post("/add-to-cart",auth, async (req,res)=>{
  const user = await User.findOne({username:req.user.username});
  const product = req.body.product;

  if(!user || !product) return res.send("Error ❌");

  let item = user.cart.find(i=>i.id === product._id);

  if(item){
    item.qty++;
  } else {
    user.cart.push({
      id: product._id,
      name: product.name,
      price: product.price,
      image: product.images?.[0] || product.image,
      qty: 1
    });
  }

  await user.save();
  res.send("Added 🛒");
});

app.post("/get-cart",auth, async (req,res)=>{
  const user = await User.findOne({username:req.user.username});
  res.send(user?.cart || []);
});

app.post("/inc",auth, async (req,res)=>{
  const user = await User.findOne({username:req.user.username});
  let item = user.cart.find(i=>i.id === req.body.id);
  if(item) item.qty++;
  await user.save();
  res.send("Updated ➕");
});

app.post("/dec",auth, async (req,res)=>{
  const user = await User.findOne({username:req.user.username});
  let item = user.cart.find(i=>i.id === req.body.id);
  if(item && item.qty>1) item.qty--;
  await user.save();
  res.send("Updated ➖");
});

app.post("/remove",auth, async (req,res)=>{
  const user = await User.findOne({username:req.user.username});
  user.cart = user.cart.filter(i=>i.id !== req.body.id);
  await user.save();
  res.send("Removed ❌");
});

// ================== ORDER ==================
app.post("/place-order", auth, async (req,res)=>{
  const user = await User.findOne({username:req.user.username});

  if(!user || !user.cart.length){
    return res.send("Cart empty ❌");
  }

  await Order.create({
    username: user.username,
    items: user.cart,
    total: user.cart.reduce((sum,i)=>sum+i.price*i.qty,0),
    date: new Date().toLocaleString(),
    status: "Placed"
  });

  user.cart = [];
  await user.save();

  res.send("Order placed ✅");
});

app.get("/my-orders", auth, async (req,res)=>{
  const data = await Order.find({username:req.user.username});
  res.send(data);
});

// ================== FRONTEND ==================
app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(process.env.PORT || 3000,()=>{
  console.log("🚀 Server running");
});