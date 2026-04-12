const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true, // No duplicates
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
    },
    bio: {
        type: String,
        default: ''
    },
    avatarUrl: {
        type: String,
        default: ''
    },
    website: {
        type: String,
        default: ''
    },
    isVerified: {
        type: Boolean,
        default: false  
    },
    verificationToken: {
        type: String,
        default: null
    },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    notifications: [{
        type: {
        type: String,
        enum: ['like', 'comment', 'follow']
        },
        fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
        message: String,
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true }); // Adds CreatedAt automatically

// export model
module.exports = mongoose.model('User', userSchema);