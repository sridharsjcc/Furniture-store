const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cors());

const SECRET = "mysecretkey";

console.log("🔥 FINAL PRO SERVER RUNNING");

// ================= DATA =================

let users = [];

let products = [
  { id: 1, name: "Luxury Sofa", price: 45000, stock: 5, image: "" },
  { id: 2, name: "Premium Chair", price: 8000, stock: 10, image: "" }
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

// GET PRODUCTS
app.get("/products", (req, res) => {
  res.send(products);
});

// ADD PRODUCT (ADMIN)
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

// ADD TO CART
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

// GET CART
app.post("/get-cart", auth, (req, res) => {

  const user = users.find(u => u.username === req.user.username);

  res.send(user.cart);
});

// INCREASE QTY
app.post("/inc", auth, (req, res) => {

  const { id } = req.body;

  const user = users.find(u => u.username === req.user.username);
  const product = products.find(p => p.id === id);

  const item = user.cart.find(i => i.id === id);

  if(product.stock <= 0){
    return res.send("Out of stock ❌");
  }

  item.qty++;
  product.stock--;

  res.send("Updated");
});

// DECREASE QTY
app.post("/dec", auth, (req, res) => {

  const { id } = req.body;

  const user = users.find(u => u.username === req.user.username);
  const product = products.find(p => p.id === id);

  const item = user.cart.find(i => i.id === id);

  if(item.qty > 1){
    item.qty--;
    product.stock++;
  }

  res.send("Updated");
});

// REMOVE ITEM
app.post("/remove", auth, (req, res) => {

  const { id } = req.body;

  const user = users.find(u => u.username === req.user.username);
  const item = user.cart.find(i => i.id === id);

  const product = products.find(p => p.id === id);

  if(item){
    product.stock += item.qty;
  }

  user.cart = user.cart.filter(i => i.id !== id);

  res.send("Removed ❌");
});

// ================= ORDERS =================

// PLACE ORDER
app.post("/place-order", auth, (req, res) => {

  const user = users.find(u => u.username === req.user.username);

  const order = {
    id: Date.now(),
    username: user.username,
    items: user.cart,
    status: "Pending",
    date: new Date().toLocaleString()
  };

  orders.push(order);

  notifications.push(`🛒 New order from ${user.username}`);

  user.cart = [];

  res.send("Order placed ✅");
});

// GET ALL ORDERS (ADMIN)
app.get("/all-orders", auth, (req, res) => {

  if(!req.user.isAdmin){
    return res.send("Admin only ❌");
  }

  res.send(orders);
});

// UPDATE ORDER STATUS
app.post("/update-order", auth, (req, res) => {

  if(!req.user.isAdmin){
    return res.send("Admin only ❌");
  }

  const { id, status } = req.body;

  const order = orders.find(o => o.id === id);

  if(order){
    order.status = status;
    notifications.push(`📦 Order ${id} → ${status}`);
  }

  res.send("Updated ✅");
});

// ================= DASHBOARD =================

app.get("/dashboard", auth, (req, res) => {

  if(!req.user.isAdmin){
    return res.send("Admin only ❌");
  }

  let revenue = 0;

  orders.forEach(o=>{
    o.items.forEach(i=>{
      revenue += i.price * i.qty;
    });
  });

  res.send({
    users: users.length,
    orders: orders.length,
    revenue
  });

});

// ================= NOTIFICATIONS =================

app.get("/notifications", auth, (req, res) => {

  if(!req.user.isAdmin){
    return res.send("Admin only ❌");
  }

  res.send(notifications);
});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});