const addressModel = require('../models/addressModel');




const getAddresses = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'User not logged in' });

        const addresses = await addressModel.find({ userId });
        res.render('user/address', { addresses, user: req.session.user });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const selectAddress = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const { addressId } = req.body; 
        
        

        if (!userId) return res.status(401).json({ success: false, message: 'User not logged in' });
        if (!addressId) return res.status(400).json({ success: false, message: 'Address ID is required' });

        const selectedAddress = await addressModel.findOne({ _id: addressId });
        
        
        if (!selectedAddress) return res.status(404).json({ success: false, message: 'Address not found' });

        
        req.session.selectedAddress = selectedAddress;

        res.json({ success: true, message: 'Address selected', selectedAddress });
    } catch (error) {
        console.error('Error selecting address:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};



const addAddress = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'User not logged in' });

        const { fullName, phone, street, city, state, zipCode, isDefault } = req.body;
        


        
        if (isDefault) {
            await addressModel.updateMany({ userId }, { isDefault: false });
        }

        const newAddress = new addressModel({
            userId,
            fullName,
            phone,
            street,
            city,
            state,
            zipCode,
            isDefault
        });



        await newAddress.save();
        res.json({ success: true, message: 'Address added successfully', address: newAddress });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};


const updateAddress = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'User not logged in' });

        const { fullName, phone, street, city, state, zipCode, isDefault } = req.body;
        const addressId = req.params.id;

        if (!addressId) {
            return res.status(400).json({ success: false, message: 'Invalid address ID' });
        }

        
        if (isDefault) {
            await addressModel.updateMany({ userId, isDefault: true }, { isDefault: false });
        }

        const updatedAddress = await addressModel.findOneAndUpdate(
            { _id: addressId, userId },
            { fullName, phone, street, city, state, zipCode, isDefault },
            { new: true, runValidators: true }
        );

        if (!updatedAddress) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        res.json({ success: true, message: 'Address updated successfully', address: updatedAddress });
    } catch (error) {
        console.error('Error updating address:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};



const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'User not logged in' });

        const addressId = req.params.id;
        const deletedAddress = await addressModel.findOneAndDelete({ _id: addressId, userId });

        if (!deletedAddress) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        res.json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAddress = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'User not logged in' });

        const addressId = req.params.id;

        if (!addressId) {
            return res.status(400).json({ success: false, message: 'Invalid address ID' });
        }

        const address = await addressModel.findOne({ _id: addressId, userId });

        
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        res.json({ success: true, address });
    } catch (error) {
        console.error('Error fetching address:', error);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

module.exports = {
    getAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    selectAddress,
    getAddress
};


