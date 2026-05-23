const usermodel = require('../models/usermodel')
const adminSchema = require('../models/adminmodel')
const bcrypt = require('bcryptjs');
const categoryModel = require('../models/categories')
const productModel = require('../models/product')
const Order = require('../models/orderModel')
const fs = require('fs');
const path = require('path');
const Category = require('../models/categories')

const Loadlogin = async (req, res) => {
    try {
        const oldAdm = await adminSchema.findOne({ email: 'admin@gmail.com' });
        if (!oldAdm) {
            const hashedPassword = await bcrypt.hash('1234', 10);
            const admin = new adminSchema({
                email: 'admin@gmail.com',
                password: hashedPassword
            });

            await admin.save();
        }

        res.render('admin/login', { message: null });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).send('Something went wrong while creating the admin.');
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await adminSchema.findOne({ email });

        if (!admin) {
            return res.render("admin/login", { message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.render("admin/login", { message: "Invalid credentials" });
        }


        req.session.admin = true;

        res.redirect("/admin/dashboard");
    } catch (error) {
        res.send(error);
    }
};



const Loddashbord = async (req, res) => {
    try {
        const admin = req.session.admin;
        if (!admin) return res.redirect('/admin/login');

        const searchQuery = req.query.search || "";
        let users = [];

        if (searchQuery) {
            users = await usermodel.find({
                email: { $regex: searchQuery, $options: 'i' },
            }).exec();
        } else {
            users = await usermodel.find({}).exec();
        }

        
        const currentDate = new Date();
        currentDate.setUTCHours(0, 0, 0, 0);

        
        const weeklyData = await Order.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(currentDate.getTime() - (7 * 24 * 60 * 60 * 1000))
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalSales: { $sum: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        
        const monthlyData = await Order.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(currentDate.getTime() - (365 * 24 * 60 * 60 * 1000))
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    totalSales: { $sum: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        
        const yearlyData = await Order.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: "%Y", date: "$createdAt" } },
                    totalSales: { $sum: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        
        const totalSales = await Order.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: "$totalAmount" }
                }
            }
        ]);

        const totalOrders = await Order.countDocuments();

        const avgOrderValue = totalSales.length > 0 ? (totalSales[0].total / totalOrders).toFixed(2) : 0;

        const productsSold = await Order.aggregate([
            {
                $unwind: "$products"
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$products.quantity" }
                }
            }
        ]);

        const usersWithIndex = users.map((user, index) => ({
            ...user.toObject(),
            originalIndex: index + 1
        }));

        
        const topProducts = await Order.aggregate([
            { $unwind: "$products" },
            {
                $group: {
                    _id: "$products.productId",
                    totalQuantity: { $sum: "$products.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            {
                $project: {
                    productName: { $arrayElemAt: ["$productDetails.productName", 0] },
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            }
        ]);

        const topBrands = await Order.aggregate([
            { $unwind: "$products" },
            {
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: "$productDetails.brand",
                    totalQuantity: { $sum: "$products.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 }
        ]);

        
        const categories = await Category.aggregate([
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: 'category',
                    as: 'products'
                }
            },
            {
                $project: {
                    name: 1,
                    isListed: 1,
                    productCount: { $size: '$products' }
                }
            }
        ]);

        res.render('admin/dashbord', {
            users: usersWithIndex,
            searchQuery: searchQuery,
            salesData: {
                weekly: weeklyData,
                monthly: monthlyData,
                yearly: yearlyData
            },
            topProducts,
            topBrands,
            dashboardStats: {
                totalSales: totalSales.length > 0 ? totalSales[0].total : 0,
                totalOrders,
                avgOrderValue,
                productsSold: productsSold.length > 0 ? productsSold[0].total : 0
            },
            categories: categories
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
};


const Loadusers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const searchQuery = req.query.search || '';

        let query = {};
        if (searchQuery) {
            query = {
                $or: [
                    { email: { $regex: searchQuery, $options: 'i' } },
                    { role: { $regex: searchQuery, $options: 'i' } }
                ]
            };
        }

        const users = await usermodel.paginate(query, { page, limit });

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({
                users: users.docs,
                pagination: {
                    currentPage: users.page,
                    totalPages: users.totalPages,
                    hasNextPage: users.hasNextPage,
                    hasPrevPage: users.hasPrevPage,
                    nextPage: users.nextPage,
                    prevPage: users.prevPage
                }
            });
        }

        res.render('admin/adminUser', { users });
    } catch (error) {
        console.error(error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Server error' });
        }
        res.status(500).send('Server error');
    }
};



const toggleUserStatus = async (req, res) => {
    try {
        const userId = req.params.user_id;
        const user = await usermodel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        user.isBlock = !user.isBlock;
        await user.save();

        res.status(200).json({
            success: true,
            message: `User has been ${user.isBlock ? 'unblocked' : 'blocked'}`,
        });
    } catch (err) {
        console.error('Error toggling user status:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};




const LoadProducts = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = 7;

        const options = {
            page,
            limit,
            sort: { _id: -1 },
            populate: { path: 'category', select: 'name' }
        };

        const products = await productModel.paginate({}, options);

        res.render('admin/products', {
            products: products.docs,
            currentPage: page,
            totalPages: products.totalPages
        });

    } catch (error) {
        console.error('Error loading products:', error);
        res.render('admin/login', { message: 'Failed to load products' });
    }
};


const renderAddProduct = async (req, res) => {
    try {
        let categories = await categoryModel.find({});
        if (categories.length === 0) {
            const mens = new categoryModel({ name: 'Mens', description: 'Mens Collection', style: 'Mens' });
            const womens = new categoryModel({ name: 'Womens', description: 'Womens Collection', style: 'Womens' });
            await mens.save();
            await womens.save();
            categories = [mens, womens];
        }


        res.render('admin/addproducts', { categories, error: '' });
    } catch (error) {
        console.error('Error while fetching categories:', error);
        res.render('admin/addproducts');
    }
};

const toggleProductStatus = async (req, res) => {
    try {
        const productId = req.params.product_id;
        const product = await productModel.findOne({ _id: productId });

        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        product.isDelete = !product.isDelete;
        await product.save();

        res.status(200).json({
            success: true,
            message: product.isListed ? 'Product is now listed' : 'Product is now unlisted',
        });
    } catch (err) {
        console.error('Error updating product status:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};



const addProduct = async (req, res) => {
    try {
      

        const { image1, image2, image3, image4, productName, offer, stock } = req.body;

        if (!productName) {
            return res.status(400).send("Product name is required.");
        }

        const existingProduct = await productModel.findOne({
            productName: { $regex: new RegExp("^" + productName.trim() + "$", "i") }
        });

        if (existingProduct) {
            const categories = await categoryModel.find({});
            return res.render('admin/addproducts', {
                error: 'Product name already exists',
                categories
            });
        }

        
        const productOffer = offer ? Number(offer) : 0;

        
        const productStock = stock && !isNaN(stock) ? Number(stock) : 0;

        
        const savedImagePaths = [];
        const saveBase64ToFile = async (base64Data, filename) => {
            const matches = base64Data.match(/^data:image\/(png|jpg|jpeg);base64,(.+)$/);
            if (!matches) return false;
            const imageBuffer = Buffer.from(matches[2], 'base64');
            const productname = productName.trim().replace(/\s+/g, '');
            const filePath = path.join('public', 'images', productname, filename);
            const dirPath = path.dirname(filePath);

            try {
                await fs.promises.access(dirPath);
            } catch (error) {
                await fs.promises.mkdir(dirPath, { recursive: true });
            }

            await fs.promises.writeFile(filePath, imageBuffer);
            return `images/${productname}/${filename}`;
        };

        if (image1) savedImagePaths.push(await saveBase64ToFile(image1, 'image1.png'));
        if (image2) savedImagePaths.push(await saveBase64ToFile(image2, 'image2.png'));
        if (image3) savedImagePaths.push(await saveBase64ToFile(image3, 'image3.png'));
        if (image4) savedImagePaths.push(await saveBase64ToFile(image4, 'image4.png'));

        req.body.imagePaths = savedImagePaths;

        
        let variants;
        try {
            variants = JSON.parse(req.body.variants || '[]');

            if (!Array.isArray(variants)) {
                return res.status(400).send("Variants must be an array.");
            }

            for (let variant of variants) {
                if (!variant.color || typeof variant.color !== 'string' || variant.color.trim() === "") {
                    return res.status(400).send("Each variant must have a valid color.");
                }
            }
        } catch (err) {
            console.error("Error parsing variants JSON:", err);
            return res.status(400).send("Invalid JSON format for variants.");
        }

        req.body.variants = variants;

        
        const newProduct = new productModel({
            ...req.body,
            offer: productOffer, 
            stock: productStock, 
        });

        await newProduct.save();

        res.redirect('/admin/products');

    } catch (error) {
        console.error('Error saving product:', error);
        res.status(500).send('Error saving product');
    }
};







const LoadCategory = async (req, res) => {
    try {
        const admin = req.session.admin;
        if (!admin) return res.redirect('/admin/login');

        const categories = await categoryModel.find({});

        const categoryIds = categories.map(cat => cat._id);

        const products = await productModel.find({ category: { $in: categoryIds } });


        res.render('admin/categories', { categories, products });
    } catch (error) {
        console.error('Error loading categories:', error);
        res.render('admin/dashbord', { message: 'Failed to load categories' });
    }
};

const postAddCategory = async (req, res) => {
    try {
        const { name, description, offer, style } = req.body;

        
        if (!name || !description) {
            return res.render('admin/addcategories', { error: 'Category name and description are required' });
        }

        
        const existingCategory = await categoryModel.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
        if (existingCategory) {
            return res.render('admin/addcategories', { error: 'Category name already exists' });
        }

        
        const categoryOffer = offer && !isNaN(offer) ? Number(offer) : 0;

        
        const newCategory = new categoryModel({ 
            name, 
            description, 
            offer: categoryOffer,
            style: style || ''
        });

        await newCategory.save();

        res.redirect('/admin/categories');
    } catch (error) {
        console.error('Error adding category:', error);
        res.render('admin/addcategories', { error: 'An error occurred while adding the category.' });
    }
};



const AddCategory = async (req, res) => {
    try {

        res.render('admin/addcategories', { categories: '', error: '' });
    } catch (error) {
        console.error('Error adding category:', error);
        res.redirect('/admin/categories');
    }
};


const editCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, description, offer, style } = req.body;

        
        const categoryOffer = offer && !isNaN(offer) ? Number(offer) : 0;

        
        const existingCategory = await categoryModel.findOne({
            name: { $regex: new RegExp(`^${name}$`, "i") },
            _id: { $ne: categoryId }
        });

        if (existingCategory) {
            return res.render('admin/editcategories', {
                category: { _id: categoryId, name, description, offer: categoryOffer },
                error: 'Category name already exists.',
            });
        }

        
        await categoryModel.findByIdAndUpdate(categoryId, { name, description, offer: categoryOffer, style: style || '' });

        res.redirect('/admin/categories?success=Category updated successfully.');
    } catch (error) {
        console.error('Error updating category:', error);

        res.render('admin/editcategories', {
            category: { _id: req.params.id, name: req.body.name, description: req.body.description, offer: req.body.offer },
            error: 'An error occurred while updating the category.',
        });
    }
};



const togglecategories = async (req, res) => {
    try {
        const categoryId = req.params.category_id
        const category = await categoryModel.findOne({ _id: categoryId })

        category.isdelete = !category.isdelete

        await productModel.updateMany(
            { category: categoryId },
            { $set: { isDelete: true } }
        );


        await category.save()
        res.status(200).json({ success: true, message: 'category is unlisted' })


    } catch (err) {

    }
}


const loadEditCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;




        const category = await categoryModel.findById(categoryId);




        if (!category) {
            console.warn('Category not found for ID:', categoryId);
            return res.redirect('/admin/categories');
        }


        res.render('admin/editcategories', { category, error: null });
    } catch (error) {

        console.error('Error loading edit category page:', error);


        res.redirect('/admin/categories');
    }
};



const editproducts = async (req, res) => {

    try {
        const { id } = req.params
        const products = await productModel.findOne({ _id: id })
    


        let categories = await categoryModel.find({});
        if (categories.length === 0) {
            const mens = new categoryModel({ name: 'Mens', description: 'Mens Collection', style: 'Mens' });
            const womens = new categoryModel({ name: 'Womens', description: 'Womens Collection', style: 'Womens' });
            await mens.save();
            await womens.save();
            categories = [mens, womens];
        }
        res.render('admin/editproducts', { categories, products, errorMessage: '' })
    }
    catch (er) {
        console.error(er);

    }

}

const editproducttt = async (req, res) => {
    try {
        console.log("Request Body:", req.body); 

        const { productId, image1, image2, image3, image4, productName, category, price, brand, productDescription, material, offer, stock } = req.body;

        if (!productId) {
            return res.status(400).send("Product ID is required.");
        }

        const product = await productModel.findById(productId);
        if (!product) {
            return res.status(404).send("Product not found.");
        }

        
        const productOffer = offer ? Number(offer) : 0;
        const productStock = stock && !isNaN(stock) ? Number(stock) : 0;

        
        if (productName) {
            const existingProduct = await productModel.findOne({
                productName: { $regex: new RegExp("^" + productName.trim() + "$", "i") },
                _id: { $ne: productId }
            });

            if (existingProduct) {
                const categories = await categoryModel.find();
                return res.render('admin/editproducts', {
                    errorMessage: "Product name already exists!",
                    product,
                    categories
                });
            }

            product.productName = productName.trim();
        }

        
        const saveBase64ToFile = async (base64Data, filename) => {
            const matches = base64Data.match(/^data:image\/(png|jpg|jpeg);base64,(.+)$/);
            if (!matches) return false;

            const imageBuffer = Buffer.from(matches[2], 'base64');
            const productname = product.productName.replace(/\s+/g, '');
            const filePath = path.join('public', 'images', productname, filename);
            const dirPath = path.dirname(filePath);

            try {
                await fs.promises.access(dirPath);
            } catch (error) {
                await fs.promises.mkdir(dirPath, { recursive: true });
            }

            await fs.promises.writeFile(filePath, imageBuffer);
            return `images/${productname}/${filename}`;
        };

        const savedImagePaths = [...(product.imagePaths || [])];

        if (image1) savedImagePaths[0] = await saveBase64ToFile(image1, 'image1.png');
        if (image2) savedImagePaths[1] = await saveBase64ToFile(image2, 'image2.png');
        if (image3) savedImagePaths[2] = await saveBase64ToFile(image3, 'image3.png');
        if (image4) savedImagePaths[3] = await saveBase64ToFile(image4, 'image4.png');

        product.imagePaths = savedImagePaths;
        product.category = category;
        product.productDescription = productDescription;
        product.price = price;
        product.brand = brand;
        product.material = material;
        product.offer = productOffer; 
        product.stock = productStock; 

        
        let variants;
        try {
            variants = JSON.parse(req.body.variants || '[]');
            if (!Array.isArray(variants)) {
                return res.status(400).send("Variants must be an array.");
            }
            for (let variant of variants) {
                if (!variant.color || typeof variant.color !== 'string' || variant.color.trim() === "") {
                    return res.status(400).send("Each variant must have a valid color.");
                }
            }
        } catch (err) {
            console.error("Error parsing variants JSON:", err);
            return res.status(400).send("Invalid JSON format for variants.");
        }

        product.variants = variants;

        await product.save();
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).send('Error updating product');
    }
};





const logout = async (req, res) => {
    req.session.admin = null
    res.redirect('/admin/login')
}

const searchProducts = async (req, res) => {
    try {
        const query = req.query.query || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 7;

        const searchRegex = new RegExp(query, 'i');

        const searchQuery = {
            $or: [
                { productName: searchRegex },
                { brand: searchRegex },
                { 'category.name': searchRegex }
            ]
        };

        const options = {
            page,
            limit,
            sort: { _id: -1 },
            populate: { path: 'category', select: 'name' }
        };

        const products = await productModel.paginate(searchQuery, options);

        res.json({
            products: products.docs,
            currentPage: page,
            totalPages: products.totalPages
        });
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
};
module.exports = {
    editproducttt,
    editproducts,
    Loadlogin,
    login,
    Loddashbord,
    logout,
    LoadProducts,
    addProduct,
    renderAddProduct,
    LoadCategory,
    AddCategory,
    postAddCategory,
    editCategory,
    togglecategories,
    loadEditCategory,
    Loadusers,
    toggleProductStatus,
    toggleUserStatus,
    searchProducts
}

