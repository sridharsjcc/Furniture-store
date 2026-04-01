const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

// ✅ CORS FIX (VERY IMPORTANT)
app.use(cors({
  origin: "*",   // allow all (for now)
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const SECRET = "mysecretkey";

console.log("🔥 FINAL PRO SERVER RUNNING");

// ================= DATA =================

let users = [];

let products = [
  {
    id: 1,
    name: "Luxury Sofa",
    price: 45000,
    stock: 5,
    image: "https://images.unsplash.com/photo-1582582429416-1f0d9c9b4f2e"
  },
  {
    id: 2,
    name: "Premium Chair",
    price: 8000,
    stock: 10,
    image: "https://images.unsplash.com/photo-1598300053653-d3bfcf6c4b6b"
  }
];

let orders = [];
let notifications = [];

// ================= AUTH =================

// SIGNUP
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  if(users.find(u => u.username === username)){
    return res.send("User already exists ❌");
  }

  const hash = await bcrypt.hash(password, 10);

  users.push({
    username,
    password: hash,
    cart: [],
    isAdmin: username === "admin"
  });

  res.send("Registered ✅");
});

// LOGIN
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username);

  if(!user){
    return res.status(401).send("Invalid ❌");
  }

  const match = await bcrypt.compare(password, user.password);

  if(!match){
    return res.status(401).send("Invalid ❌");
  }

  const token = jwt.sign(
    { username: user.username, isAdmin: user.isAdmin },
    SECRET
  );

  res.send({ token, user });
});

// ================= MIDDLEWARE =================

function auth(req, res, next){
  const token = req.headers.authorization;

  if(!token) return res.status(403).send("No token ❌");

  try {
    const data = jwt.verify(token, SECRET);
    req.user = data;
    next();
  } catch {
    res.status(403).send("Invalid token ❌");
  }
}

// ================= PRODUCTS =================

app.get("/products", (req, res) => {
  res.send(products);
});

// ADD PRODUCT
app.post("/add-product", auth, (req, res) => {

  if(!req.user.isAdmin){
    return res.send("Admin only ❌");
  }

  const { name, price, stock, image } = req.body;

  products.push({
    id: products.length + 1,
    name,
    price,
    stock,
    image
  });

  res.send("Product added ✅");
});

// DELETE PRODUCT
app.post("/delete-product", auth, (req, res) => {

  if(!req.user.isAdmin){
    return res.send("Admin only ❌");
  }

  const { id } = req.body;

  products = products.filter(p => p.id !== id);

  res.send("Deleted 🗑️");
});

// ================= CART =================

app.post("/add-to-cart", auth, (req, res) => {

  const { product } = req.body;

  const user = users.find(u => u.username === req.user.username);
  const dbProduct = products.find(p => p.id === product.id);

  if(!dbProduct || dbProduct.stock <= 0){
    return res.send("Out of stock ❌");
  }

  let item = user.cart.find(i => i.id === product.id);

  if(item){
    item.qty++;
  } else {
    user.cart.push({ ...product, qty: 1 });
  }

  dbProduct.stock--;

  res.send("Added to cart 🛒");
});

app.post("/get-cart", auth, (req, res) => {
  const user = users.find(u => u.username === req.user.username);
  res.send(user.cart);
});

// ================= SERVER =================

// ✅ MUST for Render
const PORT = process.env.PORT || 3000;

// ✅ Health check (helps debugging)
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
