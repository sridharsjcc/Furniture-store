const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const SECRET = "secret123";

// ===== LOAD DATA =====
let users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
let products = JSON.parse(fs.readFileSync("products.json", "utf-8"));

// ===== SAVE FUNCTIONS =====
function saveUsers(){
  fs.writeFileSync("users.json", JSON.stringify(users));
}

function saveProducts(){
  fs.writeFileSync("products.json", JSON.stringify(products));
}

// ===== AUTH =====

app.post("/signup", async (req,res)=>{
  const {username,password} = req.body;

  if(users.find(u=>u.username===username)){
    return res.send("User exists");
  }

  const hash = await bcrypt.hash(password,10);

  users.push({
    username,
    password:hash,
    cart:[],
    isAdmin: username==="admin"
  });

  saveUsers();
  res.send("Signup success");
});

app.post("/login", async (req,res)=>{
  const {username,password} = req.body;

  const user = users.find(u=>u.username===username);
  if(!user) return res.send("Invalid");

  const match = await bcrypt.compare(password,user.password);
  if(!match) return res.send("Invalid");

  const token = jwt.sign(user,SECRET);
  res.send({token});
});

function auth(req,res,next){
  try{
    const data = jwt.verify(req.headers.authorization,SECRET);
    req.user = data;
    next();
  }catch{
    res.send("Unauthorized");
  }
}

// ===== PRODUCTS =====

app.get("/products",(req,res)=>{
  res.send(products);
});

app.post("/add-product",auth,(req,res)=>{
  if(!req.user.isAdmin) return res.send("Admin only");

  const {name,price,image} = req.body;

  products.push({
    id:Date.now(),
    name,
    price,
    image
  });

  saveProducts();
  res.send("Added");
});

// ===== CART =====

app.post("/add-to-cart",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);

  user.cart.push(req.body.product);

  saveUsers();
  res.send("Added");
});

app.post("/get-cart",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  res.send(user.cart);
});

// ===== SERVER =====

app.get("/",(req,res)=>res.send("Backend Running"));

app.listen(process.env.PORT || 3000);
