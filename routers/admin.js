const router =require('express').Router();
const Product =require("../models/product")
const adminController = require('../controller/admin')
const orderController = require('../controller/adminOrderController')
const couponController = require('../controller/coupon')
const adminauth = require('../middleware/admin')
const salesController = require('../controller/sales')

//LOGIN
router.get('/login', adminauth.isLogin, adminController.Loadlogin); 
router.post('/login', adminController.login);

//DASHBORD
router.get('/dashboard',adminauth.cheksession, adminController.Loddashbord);

// PRODUCT MANAGEMENT 
router.get('/products',adminauth.cheksession, adminController.LoadProducts);
router.get('/search-products', adminauth.cheksession, adminController.searchProducts);
router.post('/addproducts', adminauth.cheksession, adminController.addProduct);
router.get('/addproducts', adminauth.cheksession, adminController.renderAddProduct);
router.get('/editproducts/:id', adminauth.cheksession, adminController.editproducts);
router.post('/editproducttt', adminauth.cheksession, adminController.editproducttt);
router.put('/products/toggle-status/:product_id', adminauth.cheksession, adminController.toggleProductStatus);



// CATEGORY MANAGEMENT 
router.get('/categories', adminauth.cheksession, adminController.LoadCategory);
router.get('/addcategories', adminauth.cheksession, adminController.AddCategory);
router.post('/addcategories', adminauth.cheksession, adminController.postAddCategory);
router.get('/categories/edit/:id', adminauth.cheksession, adminController.loadEditCategory);
router.post('/categories/edit/:id', adminauth.cheksession, adminController.editCategory);
router.put('/categories/toggle-status/:category_id', adminauth.cheksession, adminController.togglecategories);


      
//PRODUCT IMAGE VIEW
router.get('/getProductById/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send({ error: 'Product not found' });
        }
        res.json(product);
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Server error while fetching product' });
    }
});



router.get('/users', adminauth.cheksession, adminController.Loadusers);
router.put('/users/toggle-status/:user_id', adminauth.cheksession, adminController.toggleUserStatus);


router.get("/orders", adminauth.cheksession,orderController.adminOrders);
router.post("/orders",  adminauth.cheksession,orderController.updateOrderStatus);


//coupon Mangement
router.get('/coupons', adminauth.cheksession, couponController.getAllCoupons);
router.get('/coupons/add', adminauth.cheksession, couponController.renderAddCoupon);
router.post('/coupons/add', adminauth.cheksession, couponController.addCoupon);
router.get('/coupons/edit/:id', adminauth.cheksession, couponController.renderEditCoupon);
router.post('/coupons/edit/:id', adminauth.cheksession, couponController.editCoupon);
router.put('/coupon/:coupon_id/toggle-status', adminauth.cheksession, couponController.toggleCouponStatus);

router.get('/sales', adminauth.cheksession,salesController.salesController);
router.get('/search-orders', adminauth.cheksession, salesController.searchOrders);
//LOGOUT
router.post('/logout',adminauth.cheksession,adminController.logout)

router.get('/orders-view', adminauth.cheksession, orderController.orderView)

router.get("/orders/approve-return/:orderId/:productId", adminauth.cheksession,orderController.approveReturn);
router.get("/orders/cancel-return/:orderId/:productId",  adminauth.cheksession,orderController.cancelReturn);

module.exports=router

