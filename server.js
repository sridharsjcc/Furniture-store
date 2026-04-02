const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const SECRET = "secret123";

// ===== SAFE LOAD =====
function loadJSON(file){
  try{
    const data = fs.readFileSync(file,"utf-8");
    return data ? JSON.parse(data) : [];
  }catch{
    return [];
  }
}

// ===== DATA =====
let users = loadJSON("users.json");
let products = loadJSON("products.json");
let orders = loadJSON("orders.json");

// ===== SAVE =====
function saveUsers(){
  fs.writeFileSync("users.json", JSON.stringify(users,null,2));
}
function saveProducts(){
  fs.writeFileSync("products.json", JSON.stringify(products,null,2));
}
function saveOrders(){
  fs.writeFileSync("orders.json", JSON.stringify(orders,null,2));
}

// ===== AUTH =====

// SIGNUP
app.post("/signup", async (req,res)=>{
  const {username,password} = req.body;

  if(!username || !password){
    return res.status(400).send("Missing fields ❌");
  }

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

// LOGIN
app.post("/login", async (req,res)=>{
  const {username,password} = req.body;

  const user = users.find(u=>u.username===username);
  if(!user) return res.status(401).send("Invalid ❌");

  const match = await bcrypt.compare(password,user.password);
  if(!match) return res.status(401).send("Invalid ❌");

  const token = jwt.sign(
    {username:user.username, isAdmin:user.isAdmin},
    SECRET
  );

  res.send({ token, username:user.username, isAdmin:user.isAdmin });
});

// AUTH
function auth(req,res,next){
  try{
    const token = req.headers.authorization;
    if(!token) return res.status(401).send("No token ❌");

    const data = jwt.verify(token,SECRET);
    req.user = data;
    next();
  }catch{
    res.status(401).send("Unauthorized ❌");
  }
}

// ===== PRODUCTS =====

// GET ALL
app.get("/products",(req,res)=>{
  res.send(products);
});

// GET SINGLE
app.get("/product/:id",(req,res)=>{
  const product = products.find(p=>p.id==req.params.id);
  res.send(product || {});
});

// ADD PRODUCT
app.post("/add-product",auth,(req,res)=>{
  if(!req.user.isAdmin) return res.send("Admin only ❌");

  const {name,price,images,description} = req.body;

  products.push({
    id:Date.now(),
    name,
    price,
    images: images || [],
    description: description || ""
  });

  saveProducts();
  res.send("Product added ✅");
});

// DELETE PRODUCT
app.post("/delete-product",auth,(req,res)=>{
  if(!req.user.isAdmin) return res.send("Admin only ❌");

  products = products.filter(p=>p.id !== req.body.id);

  saveProducts();
  res.send("Deleted 🗑️");
});

// ===== CART (🔥 FIXED) =====

app.post("/add-to-cart",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  const product = req.body.product;

  if(!user || !product) return res.send("Error ❌");

  let item = user.cart.find(i=>i.id===product.id);

  if(item){
    item.qty++;
  } else {
    user.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images ? product.images[0] : product.image,
      qty: 1
    });
  }

  saveUsers();
  res.send("Added 🛒");
});

// GET CART
app.post("/get-cart",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  res.send(user.cart || []);
});

// INCREASE
app.post("/inc",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  let item = user.cart.find(i=>i.id===req.body.id);
  if(item) item.qty++;
  saveUsers();
  res.send("Updated ➕");
});

// DECREASE
app.post("/dec",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  let item = user.cart.find(i=>i.id===req.body.id);
  if(item && item.qty>1) item.qty--;
  saveUsers();
  res.send("Updated ➖");
});

// REMOVE
app.post("/remove",auth,(req,res)=>{
  const user = users.find(u=>u.username===req.user.username);
  user.cart = user.cart.filter(i=>i.id!==req.body.id);
  saveUsers();
  res.send("Removed ❌");
});

// ===== ORDERS =====

// PLACE ORDER
app.post("/place-order", auth, (req,res)=>{

  const user = users.find(u=>u.username===req.user.username);

  if(!user.cart.length){
    return res.send("Cart empty ❌");
  }

  const order = {
    id: Date.now(),
    username: user.username,
    items: user.cart,
    total: user.cart.reduce((sum,i)=>sum+i.price*i.qty,0),
    date: new Date().toLocaleString(),
    status: "Placed"
  };

  orders.push(order);
  user.cart = [];

  saveUsers();
  saveOrders();

  res.send("Order placed ✅");
});

// USER ORDERS
app.get("/my-orders", auth, (req,res)=>{
  res.send(orders.filter(o=>o.username===req.user.username));
});

// ADMIN ORDERS
app.get("/all-orders", auth, (req,res)=>{
  if(!req.user.isAdmin) return res.send("Admin only ❌");
  res.send(orders);
});

// ===== SERVER =====
app.get("/",(req,res)=>{
  res.sendFile(__dirname + "/public/index.html");
});

app.listen(process.env.PORT || 3000,()=>{
  console.log("🚀 Server running");
});