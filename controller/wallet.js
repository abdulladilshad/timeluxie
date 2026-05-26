const User = require('../models/usermodel');
const Wallet = require('../models/walletModel')
const Transaction = require('../models/transactionsModel');
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const getWallet = async (req, res) => {
    try {
        const user = await User.findOne({email: req.session.user.email});

        if (!user) {
            return res.status(404).send('User not found');
        }

        const wallet = await Wallet.findOne({user: user._id});
        
        if (!wallet) {
            return res.render('user/wallet', { hasWallet: false, user: req.session.user });
        }

        const transactions = await Transaction.find({user: user._id})
            .sort({createdAt: -1})
            .lean();

        res.render('user/wallet', { 
            hasWallet: true,
            balance: wallet.balance, 
            transactions: transactions,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).send('Internal server error');
    }
};

const createWallet = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.session.user.email });

        if (!user) {
            return res.status(404).send('User not found');
        }

        
        let wallet = await Wallet.findOne({ user: user._id });

        if (wallet) {
            return res.redirect('/wallet');
        }

        
        wallet = new Wallet({
            user: user._id,
            balance: 0
        });
        await wallet.save();

        
        const transaction = new Transaction({
            user: user._id,
            wallet: wallet._id,
            type: 'deposit',
            amount: 0,
            status: 'completed'
        });
        await transaction.save();

        res.redirect('/wallet');
    } catch (error) {
        console.error('Error creating wallet:', error);
        res.status(500).send('Internal server error');
    }
};

const deposit = async (req, res) => {
    try {
        const { amount } = req.body;
        const depositAmount = parseFloat(amount);

        if (isNaN(depositAmount) || depositAmount <= 0) {
            return res.status(400).send('Invalid deposit amount');
        }

       
        const user = await User.findOne({ email: req.session.user.email });

        if (!user) {
            return res.status(404).send('User not found');
        }

        
        let wallet = await Wallet.findOne({ user: user._id });

        if (!wallet) {
            wallet = new Wallet({
                user: user._id,
                balance: 0
            });
        }

       
        wallet.balance += depositAmount;
        await wallet.save();

       
        const transaction = new Transaction({
            user: user._id,
            wallet: wallet._id,
            type: 'deposit',
            amount: depositAmount,
            status: 'completed'
        });

        await transaction.save();

        res.redirect('/wallet');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
};

const createWalletDeposit = async (req, res) => {
    try {
        console.log('Creating wallet deposit with body:', req.body);
        
        const { amount } = req.body;
        const depositAmount = parseFloat(amount);

        if (isNaN(depositAmount) || depositAmount <= 0) {
            console.log('Invalid amount:', amount);
            return res.status(400).json({ success: false, message: 'Invalid deposit amount' });
        }

        if (!req.session || !req.session.user || !req.session.user.email) {
            console.log('No user session found:', req.session);
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const user = await User.findOne({ email: req.session.user.email });
        if (!user) {
            console.log('User not found for email:', req.session.user.email);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log('Creating Razorpay order for amount:', depositAmount);
        
        
        if (!razorpay.orders) {
            console.error('Razorpay not properly initialized. Check credentials.');
            return res.status(500).json({ 
                success: false, 
                message: 'Payment gateway configuration error' 
            });
        }

        
        const timestamp = Date.now().toString().slice(-8); 
        const receipt = `w-${user._id.toString().slice(-8)}-${timestamp}`; 

        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(depositAmount * 100), 
            currency: 'INR',
            receipt: receipt,
            payment_capture: 1
        });

        console.log('Razorpay order created:', razorpayOrder);

        res.status(200).json({
            success: true,
            key_id: process.env.RAZORPAY_KEY_ID,
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            email: user.email,
            contact: user.phone || ''
        });

    } catch (error) {
        console.error('Detailed error in createWalletDeposit:', {
            message: error.message,
            stack: error.stack,
            razorpayError: error.error,
            statusCode: error.statusCode
        });
        
        
        if (error.error && error.error.description) {
            return res.status(500).json({ 
                success: false, 
                message: `Razorpay Error: ${error.error.description}` 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create deposit order. Please check server logs.' 
        });
    }
};

const verifyWalletDeposit = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;
        
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');
            
        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        const user = await User.findOne({ email: req.session.user.email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let wallet = await Wallet.findOne({ user: user._id });
        if (!wallet) {
            wallet = new Wallet({
                user: user._id,
                balance: 0
            });
        }

        const depositAmount = parseFloat(amount) / 100; 
        wallet.balance += depositAmount;
        await wallet.save();

        const transaction = new Transaction({
            user: user._id,
            wallet: wallet._id,
            type: 'deposit',
            amount: depositAmount,
            status: 'completed'
        });
        await transaction.save();

        res.status(200).json({ 
            success: true, 
            message: 'Payment verified and wallet updated successfully'
        });

    } catch (error) {
        console.error('Error verifying wallet deposit:', error);
        res.status(500).json({ success: false, message: 'Failed to verify deposit' });
    }
};


const getWalletBalance = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.session.user.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const wallet = await Wallet.findOne({ user: user._id });
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found', balance: 0 });
        }

        res.json({ balance: wallet.balance });
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getWallet,
    deposit,
    createWallet,
    createWalletDeposit,
    verifyWalletDeposit,
    getWalletBalance
};
