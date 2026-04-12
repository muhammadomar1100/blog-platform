const API_BASE_URL = "https://postly-hx5c.onrender.com";
const TOKEN_KEY = "blogToken";

const page = document.body?.dataset?.page;
document.addEventListener("DOMContentLoaded", () => {
  if (page === "login") initLogin();
  if (page === "signup") initSignup();
  if (page === "index") initFeed();
  if (page === "profile") initProfile();
  if (page === "notifications") initNotifications();
});

function initLogin() {
  // Show verified message if coming from email verification
  const params = new URLSearchParams(window.location.search);
  if (params.get('verified') === 'true') {
    showMessage(document.getElementById('authMessage'), 
    'Email verified successfully. You can now log in.');
  }

  const form = document.getElementById("loginForm");
  const msg = document.getElementById("authMessage");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage(msg);
    const fd = new FormData(form);
    try {
      const res = await request("/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(fd.get("email") || "").trim(),
          password: String(fd.get("password") || "")
        })
      });
      if (!res.token) throw new Error("Token not returned by backend");
      localStorage.setItem(TOKEN_KEY, res.token);
      showMessage(msg, "Login successful. Redirecting...");
      setTimeout(() => (window.location.href = "index.html"), 500);
    } catch (err) {
      showMessage(msg, err.message || "Login failed", true);
    }
  });
}

function initSignup() {
  const form = document.getElementById("signupForm");
  const msg = document.getElementById("authMessage");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage(msg);
    const fd = new FormData(form);
    try {
      await request("/signup", {
        method: "POST",
        body: JSON.stringify({
          username: String(fd.get("username") || "").trim(),
          email: String(fd.get("email") || "").trim(),
          password: String(fd.get("password") || "")
        })
      });
      showMessage(msg, "Signup successful. Redirecting to login...");
      setTimeout(() => (window.location.href = "login.html"), 700);
    } catch (err) {
      showMessage(msg, err.message || "Signup failed", true);
    }
  });
}

function initFeed() {
  setupHeader();
  setupCreatePost();
  setupSearch();
  document.getElementById("refreshBtn")?.addEventListener("click", loadPosts);
  loadPosts();
}

function setupHeader() {
  const token = getToken();
  const userBadge = document.getElementById("userBadge");
  const logoutBtn = document.getElementById("logoutBtn");
  const loginLink = document.getElementById("loginLink");
  const signupLink = document.getElementById("signupLink");
  const createCard = document.getElementById("createPostCard");
  const profileLink = document.getElementById("profileLink");
  const notificationsLink = document.getElementById("notificationsLink");
  const feedLink = document.getElementById("feedLink");
  const searchForm = document.getElementById("searchForm");

  if (token) {
    const payload = decodeToken(token);
    userBadge.textContent = payload?.username ? `User: ${payload.username}` : "Logged in";
    userBadge.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    loginLink.classList.add("hidden");
    signupLink.classList.add("hidden");
    if (createCard) createCard.classList.remove("hidden");
    if (profileLink) profileLink.classList.remove("hidden");
    if (notificationsLink) notificationsLink.classList.remove("hidden");
    if (feedLink) feedLink.classList.remove("hidden");
    if (searchForm) searchForm.classList.remove("hidden");
  } else {
    userBadge.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    loginLink.classList.remove("hidden");
    signupLink.classList.remove("hidden");
    if (createCard) createCard.classList.add("hidden");
    if (profileLink) profileLink.classList.add("hidden");
    if (notificationsLink) notificationsLink.classList.add("hidden");
    if (feedLink) feedLink.classList.add("hidden");
    if (searchForm) searchForm.classList.add("hidden");
  }

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  });
}

function setupCreatePost() {
  const form = document.getElementById("createPostForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = document.getElementById("postContent").value.trim();
    if (!content) return;
    try {
      await request("/posts", {
        method: "POST",
        auth: true,
        body: JSON.stringify({ content })
      });
      form.reset();
      notify("Post created");
      await loadPosts();
    } catch (err) {
      notify(err.message || "Could not create post", true);
    }
  });
}

function setupSearch() {
  const form = document.getElementById("searchForm");
  const input = document.getElementById("searchInput");
  if (!form || !input) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = String(input.value || "").trim();

    if (!getToken()) {
      notify("Please login to search posts.", true);
      return;
    }

    // Empty query: show normal feed.
    if (!q) {
      await loadPosts();
      return;
    }

    const container = document.getElementById("postsContainer");
    container.innerHTML = '<p class="muted">Searching...</p>';

    try {
      // Backend API call: GET /posts/search?q=...
      const data = await request(`/posts/search?q=${encodeURIComponent(q)}`, { method: "GET", auth: true });
      const posts = Array.isArray(data) ? data : [];
      renderPosts(posts);

      if (!posts.length) container.innerHTML = '<p class="muted">No posts matched your search.</p>';
    } catch (err) {
      notify(err.message || "Search failed", true);
      container.innerHTML = '<p class="muted">Could not load search results.</p>';
    }
  });

  // Clear search input when using refresh.
  document.getElementById("refreshBtn")?.addEventListener("click", () => {
    if (input) input.value = "";
  });
}

async function loadPosts() {
  const container = document.getElementById("postsContainer");
  container.innerHTML = '<p class="muted">Loading posts...</p>';
  try {
    const data = await request("/posts", { method: "GET" }, false);
    const posts = Array.isArray(data) ? data : Array.isArray(data?.posts) ? data.posts : [];
    renderPosts(posts);
  } catch (err) {
    container.innerHTML = "";
    notify(err.message || "Failed to load posts", true);
  }
}

function renderPosts(posts) {
  const container = document.getElementById("postsContainer");
  const template = document.getElementById("postTemplate");
  container.innerHTML = "";
  if (!posts.length) {
    container.innerHTML = '<p class="muted">No posts yet.</p>';
    return;
  }

  const tokenPayload = decodeToken(getToken());
  const myUserId = tokenPayload?.userId || null;
  const loggedIn = Boolean(getToken());

  posts.forEach((post) => {
    const node = template.content.cloneNode(true);
    const owner = node.querySelector(".owner");
    const postAvatar = node.querySelector(".post-avatar");
    const time = node.querySelector(".time");
    const content = node.querySelector(".content");
    const likes = node.querySelector(".likes");
    const likeBtn = node.querySelector(".like-btn");
    const ownerActions = node.querySelector(".owner-actions");
    const editForm = node.querySelector(".edit-form");
    const editInput = node.querySelector(".edit-input");
    const editBtn = node.querySelector(".edit-btn");
    const cancelEditBtn = node.querySelector(".cancel-edit-btn");
    const deleteBtn = node.querySelector(".delete-btn");
    const commentForm = node.querySelector(".comment-form");
    const commentInput = node.querySelector(".comment-input");
    const commentList = node.querySelector(".comment-list");
    const loginNote = node.querySelector(".login-note");

    const postUserId = typeof post.user === "object" ? String(post.user?._id || "") : String(post.user || "");
    const postOwnerName =
      typeof post.user === "object"
        ? post.user.username || post.user.email || postUserId
        : `User ${postUserId.slice(0, 8)}`;

    // Make the post owner name clickable (to open their profile page).
    owner.textContent = "";
    const ownerLink = document.createElement("a");
    ownerLink.href = postUserId ? `profile.html?id=${encodeURIComponent(postUserId)}` : "profile.html";
    ownerLink.textContent = postOwnerName || "Unknown user";
    owner.appendChild(ownerLink);

    if (postAvatar) {
      if (post.user?.avatarUrl) {
        postAvatar.src = post.user.avatarUrl;
      } else {
        postAvatar.removeAttribute("src");
      }
    }
    time.textContent = formatDate(post.createdAt);
    content.textContent = post.content || "";
    likes.textContent = `${Array.isArray(post.likes) ? post.likes.length : 0} like(s)`;

    if (!loggedIn) likeBtn.disabled = true;
    if (loggedIn && hasLiked(post.likes, myUserId)) {
      likeBtn.classList.add("liked");
      likeBtn.textContent = "Unlike";
    }

    if (loggedIn) {
      commentForm.classList.remove("hidden");
      loginNote.classList.add("hidden");
    } else {
      commentForm.classList.add("hidden");
      loginNote.classList.remove("hidden");
    }

    if (myUserId && postUserId && myUserId === postUserId) {
      ownerActions.classList.remove("hidden");
    }

    renderComments(commentList, post.comments || []);

    likeBtn.addEventListener("click", async () => {
      try {
        await request(`/posts/${post._id}/like`, { method: "PUT", auth: true });
        await loadPosts();
      } catch (err) {
        notify(err.message || "Like failed", true);
      }
    });

    editBtn?.addEventListener("click", () => {
      content.classList.add("hidden");
      editForm.classList.remove("hidden");
      editInput.value = post.content || "";
    });

    cancelEditBtn?.addEventListener("click", () => {
      editForm.classList.add("hidden");
      content.classList.remove("hidden");
    });

    editForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const updated = editInput.value.trim();
      if (!updated) return;
      try {
        await request(`/posts/${post._id}`, {
          method: "PUT",
          auth: true,
          body: JSON.stringify({ content: updated })
        });
        await loadPosts();
      } catch (err) {
        notify(err.message || "Update failed", true);
      }
    });

    deleteBtn?.addEventListener("click", async () => {
      if (!window.confirm("Delete this post?")) return;
      try {
        await request(`/posts/${post._id}`, { method: "DELETE", auth: true });
        await loadPosts();
      } catch (err) {
        notify(err.message || "Delete failed", true);
      }
    });

    commentForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = commentInput.value.trim();
      if (!text) return;
      try {
        await request(`/posts/${post._id}/comment`, {
          method: "POST",
          auth: true,
          body: JSON.stringify({ content: text })
        });
        await loadPosts();
      } catch (err) {
        notify(err.message || "Comment failed", true);
      }
    });

    container.appendChild(node);
  });
}


function renderComments(list, comments) {
  list.innerHTML = "";
  if (!comments.length) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "No comments yet.";
    list.appendChild(empty);
    return;
  }

  comments.forEach((c) => {
    const li = document.createElement("li");
    li.className = "comment-item";

    const user = typeof c.user === "object" ? c.user.username || c.user.email || "User" : "User";
    const meta = document.createElement("p");
    meta.className = "comment-meta";
    meta.textContent = `${user} - ${formatDate(c.createdAt)}`;

    const text = document.createElement("p");
    text.className = "comment-text";
    text.textContent = c.content || "";

    li.append(meta, text);
    list.appendChild(li);
  });
}

// -----------------------------
// Profile
// -----------------------------

async function initProfile() {
  // Route entry point for `profile.html`
  setupHeader();

  const globalMsgEl = document.getElementById("globalMessage");
  const profileCard = document.getElementById("profileCard");
  if (!profileCard) return;

  if (!requireAuthOrRedirect(globalMsgEl)) return;

  const params = new URLSearchParams(window.location.search);
  const tokenPayload = decodeToken(getToken());
  const myUserId = tokenPayload?.userId || null;
  const targetUserId = String(params.get("id") || myUserId);

  if (!targetUserId) {
    notify("Could not load profile.", true);
    return;
  }

  await loadAndRenderProfile(targetUserId);
}

async function loadAndRenderProfile(targetUserId) {
  const globalMsgEl = document.getElementById("globalMessage");
  const profileCard = document.getElementById("profileCard");
  profileCard?.classList.remove("hidden");

  try {
    // Backend API call: GET /user/:id (auth required)
    const user = await request(`/user/${targetUserId}`, { method: "GET", auth: true });
    renderProfile(user, targetUserId);
    showMessage(globalMsgEl, "", false);
  } catch (err) {
    notify(err.message || "Failed to load profile", true);
  }
}

function renderProfile(user, targetUserId) {
  // DOM rendering + event handlers for edit/follow actions.
  const tokenPayload = decodeToken(getToken());
  const myUserId = tokenPayload?.userId || null;
  const isOwnProfile = Boolean(myUserId && String(myUserId) === String(targetUserId));

  const profileUsername = document.getElementById("profileUsername");
  const profileEmail = document.getElementById("profileEmail");
  const avatarImg = document.getElementById("avatarImg");
  const bioText = document.getElementById("bioText");
  const websiteText = document.getElementById("websiteText");
  const followersCountEl = document.getElementById("followersCount");
  const followingCountEl = document.getElementById("followingCount");
  const followActions = document.getElementById("followActions");
  const followBtn = document.getElementById("followBtn");
  const editSection = document.getElementById("editSection");
  const editForm = document.getElementById("editProfileForm");

  profileUsername.textContent = user.username || "Unknown";
  profileEmail.textContent = user.email ? String(user.email) : "";
  bioText.textContent = user.bio || "";
  websiteText.textContent = user.website || "";

  followersCountEl.textContent = Array.isArray(user.followers) ? user.followers.length : 0;
  followingCountEl.textContent = Array.isArray(user.following) ? user.following.length : 0;

  // Avatar: backend stores `avatarUrl`; show a placeholder if missing.
  if (avatarImg) {
    if (user.avatarUrl) {
      avatarImg.src = user.avatarUrl;
      avatarImg.alt = `Avatar for ${user.username}`;
    } else {
      avatarImg.removeAttribute("src");
      avatarImg.alt = "No avatar";
    }
  }

  if (isOwnProfile) {
    followActions?.classList.add("hidden");
    editSection?.classList.remove("hidden");

    // Populate edit fields from backend.
    document.getElementById("bioInput").value = user.bio || "";
    document.getElementById("avatarInput").value = user.avatarUrl || "";
    document.getElementById("websiteInput").value = user.website || "";
    const avatarFileInput = document.getElementById("avatarFileInput");
    const uploadAvatarBtn = document.getElementById("uploadAvatarBtn");

    // Upload avatar immediately via multipart/form-data endpoint.
    uploadAvatarBtn.onclick = async () => {
      const file = avatarFileInput?.files?.[0];
      if (!file) {
        notify("Please choose an image file first.", true);
        return;
      }
      try {
        await uploadAvatar(targetUserId, file);
        await loadAndRenderProfile(targetUserId);
        notify("Avatar uploaded successfully.");
      } catch (uploadError) {
        notify(uploadError.message || "Avatar upload failed.", true);
      }
    };

    editForm.onsubmit = async (e) => {
      e.preventDefault();

      // Backend expects: { bio, avatarUrl, website } (PUT /users/:id)
      const bio = document.getElementById("bioInput").value;
      const avatarUrl = document.getElementById("avatarInput").value;
      const website = document.getElementById("websiteInput").value;
      const selectedFile = avatarFileInput?.files?.[0];

      try {
        await request(`/users/${targetUserId}`, {
          method: "PUT",
          auth: true,
          body: JSON.stringify({ bio, avatarUrl, website })
        });

        // If user selected a file, upload it using FormData endpoint.
        if (selectedFile) {
          await uploadAvatar(targetUserId, selectedFile);
        }

        notify("Profile updated.");
        await loadAndRenderProfile(targetUserId);
      } catch (err2) {
        notify(err2.message || "Profile update failed", true);
      }
    };
  } else {
    editSection?.classList.add("hidden");
    followActions?.classList.remove("hidden");

    // Determine following state using populated `followers`.
    const isFollowing =
      Array.isArray(user.followers) &&
      user.followers.some((u) => String(u._id) === String(myUserId));

    followBtn.textContent = isFollowing ? "Unfollow" : "Follow";

    followBtn.onclick = async () => {
      followBtn.disabled = true;
      try {
        // Backend follow endpoints:
        // - PUT /users/:id/follow
        // - PUT /users/:id/unfollow
        if (isFollowing) {
          await request(`/users/${targetUserId}/unfollow`, { method: "PUT", auth: true });
        } else {
          await request(`/users/${targetUserId}/follow`, { method: "PUT", auth: true });
        }
        await loadAndRenderProfile(targetUserId);
      } catch (err) {
        notify(err.message || "Follow action failed", true);
      } finally {
        followBtn.disabled = false;
      }
    };
  }
}

// -----------------------------
// Notifications
// -----------------------------

async function initNotifications() {
  setupHeader();

  const globalMsgEl = document.getElementById("globalMessage");
  const list = document.getElementById("notificationsList");
  if (!list) return;

  if (!requireAuthOrRedirect(globalMsgEl)) return;

  document.getElementById("refreshNotifBtn")?.addEventListener("click", () => loadNotifications());
  await loadNotifications();
}

async function loadNotifications() {
  const list = document.getElementById("notificationsList");
  if (!list) return;

  list.classList.remove("hidden");
  list.innerHTML = '<p class="muted">Loading notifications...</p>';

  try {
    // Backend API call: GET /notifications (auth required)
    const data = await request("/notifications", { method: "GET", auth: true });
    const notifications = Array.isArray(data) ? data : [];
    renderNotifications(notifications);
  } catch (err) {
    list.innerHTML = '<p class="muted">Could not load notifications.</p>';
    notify(err.message || "Notifications failed", true);
  }
}

function renderNotifications(notifications) {
  // DOM rendering: turns notification objects into readable cards.
  const list = document.getElementById("notificationsList");
  list.innerHTML = "";

  if (!notifications.length) {
    list.innerHTML = '<p class="muted">You have no notifications yet.</p>';
    return;
  }

  notifications.forEach((n) => {
    const item = document.createElement("div");
    item.className = "notif-item";

    const title = document.createElement("div");
    title.className = "notif-title";
    title.textContent = n.message || "Notification";

    const meta = document.createElement("div");
    meta.className = "notif-meta";

    const from = n.fromUser?.username ? `From ${n.fromUser.username}` : "";
    const when = n.createdAt ? formatDate(n.createdAt) : "";
    meta.textContent = [from, when].filter(Boolean).join(" • ");

    item.append(title, meta);
    list.appendChild(item);
  });
}

function requireAuthOrRedirect(globalMsgEl) {
  if (getToken()) return true;

  if (globalMsgEl) {
    showMessage(globalMsgEl, "Please login to access this page.", true);
  }

  setTimeout(() => (window.location.href = "login.html"), 700);
  return false;
}

async function uploadAvatar(userId, file) {
  const token = getToken();
  if (!token) {
    throw new Error("Please login to upload an avatar.");
  }

  // Basic frontend validation before upload request.
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("Unsupported file type. Please select an image.");
  }
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("File too large. Please choose an image under 5MB.");
  }

  const formData = new FormData();
  // Common multer field names; backend can read whichever it is configured for.
 formData.append("avatar", file);

  // API call: POST /users/:id/avatar with multipart/form-data + JWT.
  const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(userId)}/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_err) {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || "Avatar upload failed. Please try another image.";
    throw new Error(message);
  }

  return data;
}

async function request(path, options = {}, clearAuthOn401 = true) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (options.auth) {
    const token = getToken();
    if (!token) throw new Error("Please login first");
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body
  });

  let data = null;
  try { data = await res.json(); } catch (_e) { data = null; }

  if (!res.ok) {
    if (res.status === 401 && clearAuthOn401) localStorage.removeItem(TOKEN_KEY);
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function decodeToken(token) {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    // JWT uses base64url; convert to base64 and add padding if needed.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    return JSON.parse(atob(padded));
  } catch (_e) {
    return null;
  }
}

function hasLiked(likes, userId) {
  if (!Array.isArray(likes) || !userId) return false;
  return likes.some((item) => String(item) === String(userId));
}

function formatDate(value) {
  if (!value) return "Unknown time";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function showMessage(el, msg, isError = false) {
  if (!el) return;
  if (!msg) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove("error");
    return;
  }
  el.textContent = msg;
  el.classList.remove("hidden");
  el.classList.toggle("error", isError);
}

function clearMessage(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
  el.classList.remove("error");
}

function notify(msg, isError = false) {
  showMessage(document.getElementById("globalMessage"), msg, isError);
}
