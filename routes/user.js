var express = require("express");
var router = express.Router();
var productHelprer = require("../helpers/product-helper");
const { helpers, log } = require("handlebars");
const userHelpers = require("../helpers/user-helpers");
const { response, render } = require("../app");
const { route } = require("./admin");
const collections = require("../config/collections");
var ObjectId = require("mongodb").ObjectId;

const varifylogin = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
};

/* GET home page. */
router.get("/", async function (req, res, next) {
  let user = req.session.user;
  //console.log(user);
  let cartCount = 0;
  if (req.session.user) {
    cartCount = await userHelpers.getCartCount(req.session.user._id);
  }
    banner= await productHelprer.getAllBanner()
    //console.log(banner);
  productHelprer.getAllProducts().then((products) => {
    //console.log("all products"); console.log(produtcs);
    res.render("user/view-products", { products: products, user, cartCount,banner});
  });
});
router.get("/login", (req, res) => {
  if (req.session.user) {
    res.redirect("/");
  } else {
    res.render("user/login", {
      loginErr: req.session.userLoginErr,
    });
    req.session.userLoginErr = false;
  }
});
router.get("/signup", (_req, res) => {
  res.render("user/signup");
});
router.post("/signup", (req, res) => {
  console.log("singup");
  userHelpers.doSignup(req.body).then((response) => {
    //console.log(response);
    req.session.user = response;
    req.session.user.loggedIn = true;
    res.redirect("/");
  });
});

router.post("/login", (req, res) => {
  userHelpers.dologin(req.body).then((response) => {
    if (response.status) {
      req.session.user = response.user;
      req.session.user.loggedIn = true;
      res.redirect("/");
    } else {
      req.session.userLoginErr = "invalid username or password";
      res.redirect("/login");
    }
  });
});
router.get("/logout", (req, res) => {
  req.session.user = null;
  res.redirect("/");
});
router.get("/cart", varifylogin, async (req, res) => {
  let product = await userHelpers.getCartProduct(req.session.user._id);
  let totalValue = 0;
  if (product.length > 0) {
    totalValue = await userHelpers.getTotalAmount(req.session.user._id);
  }
  let cartCount = null;
  if (req.session.user) {
    cartCount = await userHelpers.getCartCount(req.session.user._id);
  }
  res.render("user/cart", {
    product,
    user: req.session.user,
    cartCount,
    totalValue,
  });
});
router.get("/add-to-cart/:id", (req, res) => {
  userHelpers.addToCart(req.params.id, req.session.user._id).then(() => {
    res.json({ status: true });
  });
});
router.post("/change-product-quantity", (req, res, next) => {
  //console.log(req.body);
  if (req.body.quantity == 1 && req.body.count == -1) {
    userHelpers.removeCart(req.body);
    res.json({ removeProduct: true });

    console.log("cart removed");
  } else {
    userHelpers.changeProductQuantity(req.body).then(async (response) => {
      response.total = await userHelpers.getTotalAmount(req.body.user);
      //console.log(response);
      res.json(response);
    });
  }
});
router.post("/cart-remove", (req, res) => {
  userHelpers.removeCart(req.body).then((response) => {
    res.json(response);
  });
});

router.get("/place-order", varifylogin, async (req, res) => {
  let total = await userHelpers.getTotalAmount(req.session.user._id);

  res.render("user/place-order", { total, user: req.session.user });
});
router.post("/place-order", async (req, res) => {
  let product = await userHelpers.getCartProductList(req.body.userid);
  let totalPrice = await userHelpers.getTotalAmount(req.body.userid);
  userHelpers.placeOrder(req.body, product, totalPrice).then((orderid) => {
    if (req.body["Payment-Method"] == "COD") {
      res.json({ successCod: true });
    } else {
      //console.log('using online');
      userHelpers.generateRazorpay(orderid, totalPrice).then((response) => {
        console.log(response);
        res.json(response);
      });
    }
  });
  //console.log(req.body);
});
router.get("/order-success", (req, res) => {
  res.render("user/order-success", { user: req.session.user });
});
router.get("/view-orders", async (req, res) => {
  let order = await userHelpers.getUserOrder(req.session.user._id);
  let cartCount = null;
  if (req.session.user) {
    cartCount = await userHelpers.getCartCount(req.session.user._id);
  }
  res.render("user/view-orders", { user: req.session.user, order, cartCount });
});
router.get("/view-order-product/:id", async (req, res) => {
  let cartCount = 0;
  if (req.session.user) {
    cartCount = await userHelpers.getCartCount(req.session.user._id);
  }
  let product = await userHelpers.getOrderProduct(req.params.id);
  res.render("user/view-order-product", {
    user: req.session.user,
    product,
    cartCount,
  });
});
router.post("/verify-payment", (req, res) => {
  console.log(req.body);
  userHelpers
    .verifyPayment(req.body)
    .then(() => {
      userHelpers.changePaymentStatus(req.body["order[receipt]"]).then(() => {
        console.log("payment succssfull");
        res.json({ status: true });
      });
    })
    .catch((err) => {
      console.log("err " + err);
      res.json({ status: false });
    });
});

module.exports = router;
