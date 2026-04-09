const express = require('express');
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const User = require('./models/User')
const Post = require('./models/Post');
const auth = require('./middleware/auth');
const bcrypt = require('bcryptjs')
const cors = require('cors')
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// This allows our server to understand JSON (VERY IMPORTANT for later) // Create express app
const app = express();
app.use(express.json());
app.use(cors());
// Connect to Database
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected ✅');
    })
    .catch((err) => {
        console.log('Error:', err);
    });

// Create a simple route (endpoint)
// when someone goes to http://localhost:3000/
app.get('/', (req, res) => {
    res.send('Server in Running')
})



// Storage configuration for Multer (for file uploads)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Save files in "uploads" folder
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // e.g., 1234567890.jpg
    }
});
const upload = multer({ storage: storage });

// Route to handle avatar upload
app.post('/users/:id/avatar', auth, upload.single('avatar'), async (req, res) => {
    try {
        if (req.user.userId !== req.params.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        const user = await User.findByIdAndUpdate(req.params.id, { avatarUrl }, { new: true });
        res.json({ message: 'Avatar uploaded', avatarUrl: user.avatarUrl });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Serve static files from "uploads" folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// SIGNUP ROUTE
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password (VERY IMPORTANT)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({
            username,
            email,
            password: hashedPassword
        });

        // Save to database
        await newUser.save();

        res.status(201).json({ message: 'User created successfully' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// LOGIN ROUTE
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if User exists
        const user= await User.findOne({ email });
        if(!user) {
            return res.status(400).json({ message: 'User not Found' });
        }
        // Compare Passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch) {
            return res.status(400).json({ message: 'Invalid Password' });
        }

        // Create token
        const token = jwt.sign(
            { userId: user._id, username: user.username }, // Data we store also by doing user.username we can easily show username in frontend without extra DB call
            "secretkey123", // we will secure later
            { expiresIn: '1d'} // token expires in 1 hour
        );
        res.json({
            message: "Login Successful",
            token: token
        });
    } catch(error) {
        res.status(500).json({ message: error.message });
    }
});

// CREATE POST (Protected)
app.post('/posts', auth, async (req, res) => {
    try {
        const { content } = req.body;

        const newPost = new Post({
            content,
            user: req.user.userId // comes from token
        });

        await newPost.save();

        res.status(201).json({
            message: 'Post created',
            post: newPost
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// SEARCH POSTS by content or username
app.get('/posts/search', auth, async (req, res) => {
    try {
        const { q } = req.query; // ?q=keyword
        const posts = await Post.find({ content: { $regex: q, $options: 'i' } })
            .populate('user', 'username')
            .populate('comments.user', 'username');
        res.json(posts);
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

// GET ALL POSTS
app.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('user', 'username email')
            .populate('comments.user', 'username email')
            .sort({ createdAt: -1 });

        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// LIKE / UNLIKE a post
app.put('/posts/:id/like', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const userId = req.user.userId;

        // Check if user already liked
        const index = post.likes.indexOf(userId);

        if (index === -1) {
            // Not liked yet → add like
            post.likes.push(userId);
            await post.save();
            
            // Notify post owner when a new like is added (ignore self-like)
            if (post.user.toString() !== userId.toString()) {
                const [postOwner, liker] = await Promise.all([
                    User.findById(post.user).select('username notifications'),
                    User.findById(userId).select('username')
                ]);

                if (postOwner && liker) {
                    postOwner.notifications.push({
                        type: 'like',
                        fromUser: userId,
                        postId: post._id,
                        message: `${liker.username} liked your post`
                    });
                    await postOwner.save();
                }
            }
            return res.json({ message: 'Post liked', likes: post.likes.length });
        } else {
            // Already liked → remove like (toggle)
            post.likes.splice(index, 1);
            await post.save();
            return res.json({ message: 'Like removed', likes: post.likes.length });
        }

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ADD COMMENT
app.post('/posts/:id/comment', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const userId = req.user.userId;
        const { content } = req.body;

        if (!content) return res.status(400).json({ message: 'Comment cannot be empty' });

        // Add comment
        post.comments.push({ user: userId, content });
        await post.save();

        // Notify post owner about the new comment (ignore self-comment)
        if (post.user.toString() !== userId.toString()) {
            const [postOwner, commenter] = await Promise.all([
                User.findById(post.user).select('username notifications'),
                User.findById(userId).select('username')
            ]);

            if (postOwner && commenter) {
                postOwner.notifications.push({
                    type: 'comment',
                    fromUser: userId,
                    postId: post._id,
                    message: `${commenter.username} commented on your post`
                });
                await postOwner.save();
            }
        }

        // Optional: populate the user info for frontend
        await post.populate('comments.user', 'username email');

        res.json({ message: 'Comment added', comments: post.comments });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// EDIT POST
app.put('/posts/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        // Check if current user is the post owner
        if (post.user.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'You are not allowed to edit this post' });
        }

        const { content } = req.body;
        if (!content) return res.status(400).json({ message: 'Content cannot be empty' });

        post.content = content;
        await post.save();

        res.json({ message: 'Post updated', post });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE POST
app.delete('/posts/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        // Check ownership
        if (post.user.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'You are not allowed to delete this post' });
        }

        await post.findByIdAndDelete(req.params.id);
        res.json({ message: 'Post deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET user profile
app.get('/user/:id', auth, async(req, res) => {
    try {
        const user = await User.findById(req.params.id)
        .select('-password')
        .populate('followers', 'username')
        .populate('following', 'username');

        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch(err) {
        res.status(500).json({ message: err.message })
    }
});

// Update Profile
app.put('/users/:id', auth, async (req, res) => {
    try {
        if(req.user.userId !== req.params.id) return res.status(403).json({ message: 'Forbidden' });

        const { bio, avatarUrl, website } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, { bio, avatarUrl, website }, { new: true });
        res.json({ message: 'Profile updated', user });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

// FOLLOW a user
app.put('/users/:id/follow', auth, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user.userId;

        if (targetUserId.toString() === currentUserId.toString()) {
            return res.status(400).json({ message: 'You cannot follow yourself' });
        }

        const [targetUser, currentUser] = await Promise.all([
            User.findById(targetUserId),
            User.findById(currentUserId).select('username following')
        ]);

        if (!targetUser) return res.status(404).json({ message: 'User not found' });
        if (!currentUser) return res.status(404).json({ message: 'User not found' });

        const alreadyFollowing = targetUser.followers.some(
            (id) => id.toString() === currentUserId.toString()
        );

        if (!alreadyFollowing) {
            targetUser.followers.push(currentUserId);
            currentUser.following.push(targetUserId);

            // Create notification for the followed user
            targetUser.notifications.push({
                type: 'follow',
                fromUser: currentUserId,
                postId: null,
                message: `${currentUser.username} started following you`
            });

            await Promise.all([targetUser.save(), currentUser.save()]);
        }

        return res.json({
            message: alreadyFollowing ? 'Already following' : 'Followed',
            followersCount: targetUser.followers.length,
            followingCount: targetUser.following.length
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// UNFOLLOW a user
app.put('/users/:id/unfollow', auth, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user.userId;

        if (targetUserId.toString() === currentUserId.toString()) {
            return res.status(400).json({ message: 'You cannot unfollow yourself' });
        }

        const [targetUser, currentUser] = await Promise.all([
            User.findById(targetUserId),
            User.findById(currentUserId).select('username following')
        ]);

        if (!targetUser) return res.status(404).json({ message: 'User not found' });
        if (!currentUser) return res.status(404).json({ message: 'User not found' });

        const before = targetUser.followers.length;

        targetUser.followers = (targetUser.followers || []).filter(
            (id) => id.toString() !== currentUserId.toString()
        );
        currentUser.following = (currentUser.following || []).filter(
            (id) => id.toString() !== targetUserId.toString()
        );

        const didUnfollow = before !== targetUser.followers.length;
        await Promise.all([targetUser.save(), currentUser.save()]);

        return res.json({
            message: didUnfollow ? 'Unfollowed' : 'Not following',
            followersCount: targetUser.followers.length,
            followingCount: targetUser.following.length
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET notifications for logged-in user
app.get('/notifications', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('notifications.fromUser', 'username');
        res.json(user.notifications.sort((a,b) => b.createdAt - a.createdAt));
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

// OPTIONAL: Mark notifications as read (you could add a `read` boolean)

// Start the server
app.listen(3000, () => {
    console.log('Server Running on Port 3000')
})