const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const SECRET = "secret123";

// ✅ SAFE LOAD FUNCTION
function loadJSON(file){
  try{
    const data = fs.readFileSync(file,"utf-8");
    return data ? JSON.parse(data) : [];
  }catch{
    return [];
  }
}

let users = loadJSON("users.json");
let products = loadJSON("products.json");

// SAVE
function saveUsers(){
  fs.writeFileSync("users.json", JSON.stringify(users,null,2));
}

function saveProducts(){
  fs.writeFileSync("products.json", JSON.stringify(products,null,2));
}

// ===== AUTH =====

app.post("/signup", async (req,res)=>{
  const {username,password} = req.body;

  if(users.find(u=>u.username===username)){
    return res.send("User exists ❌");
  }

  const hash = await bcrypt.hash(password,10);

  users.push({
    username,
    password:hash,
    cart:[],
    isAdmin: username==="admin"
  });

  saveUsers();
  res.send("Signup success ✅");
});

app.post("/login", async (req,res)=>{
  const {username,password} = req.body;

  const user = users.find(u=>u.username===username);
  if(!user) return res.send("Invalid ❌");

  const match = await bcrypt.compare(password,user.password);
  if(!match) return res.send("Invalid ❌");

  const token = jwt.sign(
    {username:user.username, isAdmin:user.isAdmin},
    SECRET
  );

  res.send({token});
});

// AUTH
function auth(req,res,next){
  try{
    const data = jwt.verify(req.headers.authorization,SECRET);
    req.user = data;
    next();
  }catch{
    res.send("Unauthorized ❌");
  }
}

// PRODUCTS
app.get("/products",(req,res)=>{
  res.send(products);
});

app.post("/add-product",auth,(req,res)=>{
  if(!req.user.isAdmin) return res.send("Admin only ❌");

  const {name,price,image} = req.body;

  products.push({
    id:Date.now(),
    name,
    price,
    image
  });

  saveProducts();
  res.send("Product added ✅");
});

// CART
app.post("/add-to-cart",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  const product = req.body.product;

  let item = user.cart.find(i=>i.id===product.id);

  if(item){
    item.qty++;
  } else {
    user.cart.push({...product, qty:1});
  }

  saveUsers();
  res.send("Added 🛒");
});

app.post("/get-cart",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  res.send(user.cart);
});

app.post("/inc",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  const item = user.cart.find(i=>i.id===req.body.id);
  if(item) item.qty++;
  saveUsers();
  res.send("Updated");
});

app.post("/dec",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  const item = user.cart.find(i=>i.id===req.body.id);
  if(item && item.qty>1) item.qty--;
  saveUsers();
  res.send("Updated");
});

app.post("/remove",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  user.cart = user.cart.filter(i=>i.id!==req.body.id);
  saveUsers();
  res.send("Removed");
});

// HEALTH
app.get("/",(req,res)=>res.send("Backend Running 🚀"));

app.listen(process.env.PORT || 3000,()=>{
  console.log("🚀 Server running");
});
