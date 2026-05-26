const OrderModel = require("../models/orderModel");
const cartModel = require("../models/cartModel");
const mongoose = require("mongoose");
const addressModel = require('../models/addressModel')
const User = require('../models/usermodel');
const Product = require('../models/product');
const Coupon = require('../models/couponModel');
const categoryModel = require('../models/categories');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionsModel');
require('dotenv').config();

const orderHistory = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 6; 
        const skip = (page - 1) * limit;

       
        const orders = await OrderModel.find({ userId }).populate("products.productId");
        const totalIndividualOrders = orders.reduce((acc, order) => acc + order.products.length, 0);
        const totalPages = Math.ceil(totalIndividualOrders / limit);


        const paginatedOrders = await OrderModel.find({ userId })
            .populate("products.productId")
            .sort({ createdAt: -1 });

        
        let allIndividualOrders = paginatedOrders.flatMap(order =>
            order.products.map(product => ({
                orderId: order._id,
                productId: product.productId?._id || "No ID",
                productName: product.productId?.productName || "No Name",
                productImage: product.productId?.imagePaths?.[0] || "/default.jpg",
                quantity: product.quantity || 0,
                price: product.price || 0,
                status: product.status || "Pending",
                paymentStatus:product.paymentStatus||'Pending',
                color: product.color || "N/A",
                createdAt: order.createdAt,
                paymentMethod: order.paymentMethod,
                totalAmount: order.totalAmount,
                individualOrdersId: product._id,
                canReturn: product.status === "Delivered" ? true : false,
                offer: order.offer
            }))
        );

        
        const paginatedIndividualOrders = allIndividualOrders.slice(skip, skip + limit);

        if (!paginatedIndividualOrders || paginatedIndividualOrders.length === 0) {
            return res.render("user/ordersHistory", {
                orders: [],
                message: "No orders found",
                currentPage: page,
                totalPages: 0,
                hasNextPage: false,
                hasPrevPage: false,
                user: req.session.user
            });
        }        

        res.render("user/ordersHistory", {
            orders: paginatedIndividualOrders,
            address: orders[0].address,
            message: null,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            user: req.session.user
        });

    } catch (error) {
        console.error(error);
        res.status(500).render("user/ordersHistory", {
            message: "Error fetching orders",
            orders: [],
            currentPage: 1,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
            user: req.session.user
        });
    }
};



const returnOrder = async (req, res) => {
    try {
        const { orderId, productId } = req.params;

        
        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        
        const product = order.products.find(p => p.productId.toString() === productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found in order" });
        }

        
        if (product.status !== "Delivered") {
            return res.status(400).json({ message: "This product cannot be returned" });
        }

        
        product.status = "Returned";
        await order.save();

        res.json({ success: true, message: "Return request submitted successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error processing return request" });
    }
};





const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { addressId, paymentMethod, newAddress, couponCode, cartTotal } = req.body;

        const cartData = await cartModel.findOne({ userId }).populate("items.productId");

        if (!cartData || cartData.items.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }
        

        let selectedAddress;
        if (addressId) {
            const address = await addressModel.findById(addressId);
            if (!address) {
                return res.status(400).json({ message: "Invalid address" });
            }
            selectedAddress = {
                fullName: address.fullName,
                phone: address.phone,
                street: address.street,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode
            };
        } else if (newAddress) {
            const savedAddress = new addressModel({ userId, ...newAddress });
            await savedAddress.save();
        } else {
            return res.status(400).json({ message: "Address is required" });
        }

        const products = [];
        let totalAmount = 0;
        let totalDiscount = 0;

        
        for (let item of cartData.items) {
            const product = await Product.findById(item.productId);

            if (!product) {
                return res.status(400).json({ message: `Product not found` });
            }

            const orderedColor = item.color;
            const variantIndex = product.variants.findIndex(v => v.color === orderedColor);

            if (variantIndex !== -1) {
                if (product.variants[variantIndex].quantity < item.quantity) {
                    return res.status(400).json({
                        message: `Not enough stock for ${product.productName} in ${orderedColor}`
                    });
                }
                product.variants[variantIndex].quantity -= item.quantity;
            } else {
                return res.status(400).json({
                    message: `Color ${orderedColor} not found for ${product.productName}`
                });
            }

            await product.save();

            const category = await categoryModel.findById(product.category);
            const categoryOffer = category ? category.offer || 0 : 0;
            const productOffer = product.offer || 0;

            const applicableOffer = Math.max(categoryOffer, productOffer);
            const productTotal = product.price * item.quantity;
            const discountAmount = (productTotal * applicableOffer) / 100;

            totalAmount += productTotal;
            totalDiscount += discountAmount;

            products.push({
                productId: product._id,
                quantity: item.quantity,
                price: product.price,
                color: orderedColor
            });
        }

        
        const totalAfterDiscount = totalAmount - totalDiscount;
        const tax = totalAfterDiscount * 0.1;
        const totalWithTax = totalAfterDiscount + tax;

        
        let couponDiscount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode });
            if (coupon) {
                
                couponDiscount = (totalWithTax * coupon.discount) / 100;
                
                
                if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
                    couponDiscount = coupon.maxDiscount;
                }
                
                
                coupon.usedBy.push(userId);
                coupon.usedCount += 1;
                await coupon.save();
            }
        }

        
        const finalTotal = totalWithTax - couponDiscount;

        const newOrder = new OrderModel({
            userId,
            address: selectedAddress || newAddress,
            paymentMethod,
            totalAmount: totalAmount,
            tax,
            offer: totalDiscount,
            couponDiscount,
            finalAmount: finalTotal,
            products,
            status: "Pending",
            paymentStatus: paymentMethod === 'razorpay' ? 'Completed' : 'Pending',
            couponCode
        });

        await newOrder.save();

        if (paymentMethod !== 'razorpay') {
            await cartModel.deleteOne({ userId });
        }

        res.status(201).json({ orderId: newOrder._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error placing order" });
    }
};



const orderSuccess = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await OrderModel.findById(orderId).populate("products.productId");

        if (!order) {
            return res.status(404).render("orderSuccess", { error: "Order not found" });
        }

        res.render("user/order", {
            orderId: order._id,
            totalAmount: order.totalAmount,
            products: order.products,
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).render("orderSuccess", { error: "Error loading order details" });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { individualOrdersId, orderId } = req.query;

        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid or missing orderId" });
        }

        if (!individualOrdersId || !mongoose.Types.ObjectId.isValid(individualOrdersId)) {
            return res.status(400).json({ success: false, message: "Invalid or missing productId" });
        }

        
        const order = await OrderModel.findOne({ _id: orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        
        const cancelledProduct = order.products.find(p => p._id.toString() === individualOrdersId);
        if (!cancelledProduct) {
            return res.status(404).json({ success: false, message: "Product not found in order" });
        }

        
        
        let refundAmount = order.totalAmount;
        
        

        
        if (order.paymentMethod === 'razorpay' || order.paymentMethod === 'wallet') {
            let wallet = await Wallet.findOne({ user: order.userId });
            if (!wallet) {
                wallet = new Wallet({
                    user: order.userId,
                    balance: 0
                });
            }

            wallet.balance += refundAmount;
            await wallet.save();

            
            const transaction = new Transaction({
                user: order.userId,
                wallet: wallet._id,
                type: 'returnedFund',
                amount: refundAmount,
                status: 'completed'
            });
            await transaction.save();
        }

        
        const updatedOrder = await OrderModel.findOneAndUpdate(
            { _id: orderId, "products._id": individualOrdersId },
            { $set: { "products.$.status": "Cancelled" } },
            { new: true }
        );

        
        const product = await Product.findById(cancelledProduct.productId);
        if (product) {
            const orderedColor = cancelledProduct.color;
            const variantIndex = product.variants.findIndex(v => v.color === orderedColor);

            if (variantIndex !== -1) {
                product.variants[variantIndex].quantity += cancelledProduct.quantity;
                await product.save();
            }
        }

        res.redirect("/orders");

    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ success: false, message: "Error cancelling order" });
    }
};




const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID.trim(), 
    key_secret: process.env.RAZORPAY_KEY_SECRET.trim()
});



const createRazorpayOrder = async (req, res) => {
    try {
        
        if (!req.session.user || !req.session.user.id) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const userId = req.session.user.id;
        console.log("Creating order for user:", userId);

        const { paymentMethod, addressId, newAddress, cartTotal } = req.body;
        console.log(req.body , 'oheofuiouehf');
        

        
        const cart = await cartModel.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Your cart is empty' });
        }

     


        
        let selectedAddress;
        if (addressId) {
            
            const address = await addressModel.findById(addressId);
            if (!address) {
                return res.status(404).json({ message: 'Address not found' });
            }
            selectedAddress = {
                fullName: address.fullName,
                phone: address.phone,
                street: address.street,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode
            };
        } else if (newAddress) {
            
            selectedAddress = newAddress;
        } else {
            return res.status(400).json({ message: 'No address provided' });
        }

        
        const products = cart.items.map(item => ({
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.productId.price,
            color: item.color,
            status: "Pending"
        }));

       
        const order = new OrderModel({
            userId: userId, 
            address: selectedAddress,
            paymentMethod,
            totalAmount: cartTotal,
            products
        });

        await order.save();

        
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(cartTotal * 100), 
            currency: 'INR', 
            receipt: order._id.toString(),
            payment_capture: 1
        });

        res.status(200).json({
            orderId: order._id,
            razorpayOrderId: razorpayOrder.id,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ message: 'Failed to create order', error: error.message });
    }
};


const verifyRazorpayPayment = async (req, res) => {
    try {
        const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature, paymentStatus } = req.body;
        console.log( req.body,'gadssssssssssssssddddddddddddaaaaaaaaaaadddd');
        
        
        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (paymentStatus === 'failed') {
            
            for (const product of order.products) {
                product.paymentStatus = "Payment Failed";
                product.status = 'Failed'

            }
            await order.save();
            
            
            await cartModel.deleteOne({ userId: order.userId });
            
            return res.status(200).json({
                success: true,
                message: 'Order status updated to failed',
                orderId: order._id
            });
        }

        
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');
            
        if (generatedSignature !== razorpay_signature) {
            
            for (const product of order.products) {
                product.paymentStatus = "Payment Failed";
            }
            await order.save();
            return res.status(400).json({ message: 'Invalid payment signature' });
        }

        
        for (const item of order.products) {
            const product = await Product.findById(item.productId);
            if (product) {
                const orderedColor = item.color;
                const variantIndex = product.variants.findIndex(v => v.color === orderedColor);
                
                if (variantIndex !== -1) {
                    
                    if (product.variants[variantIndex].quantity >= item.quantity) {
                        product.variants[variantIndex].quantity -= item.quantity;
                        await product.save();
                    }
                }
            }
        }
        
        
        order.paymentId = razorpay_payment_id;
        for (const product of order.products) {
            product.paymentStatus = "Completed";
        }
        
        
        const a = await order.save();
        console.log(a, "aaa")
        await cartModel.deleteOne({ userId: order.userId });
        
        res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            orderId: order._id
        });
        
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ message: 'Failed to verify payment', error: error.message });
    }
};



const orderSuccesss = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await OrderModel.findById(orderId)
            .populate('shippingAddress')
            .populate('user', 'name email');

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        
        if (order.user._id.toString() !== req.user.id) {
            return res.status(403).render('error', { message: 'Unauthorized access' });
        }

        res.render('order-success', { order });

    } catch (error) {
        console.error('Error displaying order success:', error);
        res.status(500).render('error', { message: 'Failed to load order details' });
    }
};

const failPayment = async(req,res)=>{
    try {
        const orderId = req.params.orderId;
        console.log("Creating order for orderId:", orderId); 
        
        
        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        order.products[0].status='Pending'
        

      
         order.save()


        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(order.totalAmount * 100), 
            currency: 'INR',
            receipt: orderId,
        });

        
        const user = await User.findById(order.userId);

        
        console.log("Sending response:", {
            key_id: process.env.RAZORPAY_KEY_ID,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            order_id: razorpayOrder.id,
        });

        
        if (!process.env.RAZORPAY_KEY_ID) {
            throw new Error('Razorpay Key ID is not configured');
        }

        res.json({
            success: true,
            key_id: process.env.RAZORPAY_KEY_ID,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            order_id: razorpayOrder.id,
            customerName: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || ''
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create order',
            error: error.message 
        });
    }
}


const verifyFailPayment = async (req, res) => {
    try {
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            order_id
        } = req.body;

        
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign)
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            
            const order = await OrderModel.findById(order_id);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            
            for (const product of order.products) {
                product.paymentStatus = 'Completed';
            }

            
            order.paymentId = razorpay_payment_id;
            order.razorpayOrderId = razorpay_order_id;
            
            await order.save();

            return res.json({
                success: true,
                message: "Payment verified successfully"
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid signature"
            });
        }

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to verify payment',
            error: error.message 
        });
    }
};

module.exports = {
    placeOrder,
    orderSuccess,
    orderHistory,
    returnOrder,
    cancelOrder,
    verifyRazorpayPayment,
    createRazorpayOrder,
    orderSuccesss,
    failPayment,
    verifyFailPayment

};
