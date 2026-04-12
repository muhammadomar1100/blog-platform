const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // links post to its creator
        required: true
    },

    likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User' // store users who liked this post
        }
    ],
    comments: [
        {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User' // Commenter
        },
        content: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
            }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema);