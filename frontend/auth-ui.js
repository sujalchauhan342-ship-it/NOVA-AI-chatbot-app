(() => {
  const API = (window.location.port === "5500" ? "http://127.0.0.1:8000" : window.location.origin);
  const TOKEN = "my_ai_auth_token";
  const USER_ID = "my_ai_user_id";

  const getToken = () => localStorage.getItem(TOKEN);

  window.authFetch = async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    const token = getToken();

    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(url, {...options, headers});

    if (response.status === 401 && token) {
      localStorage.removeItem(TOKEN);
      localStorage.removeItem(USER_ID);
      localStorage.removeItem("my_ai_user");
      location.reload();
    }

    return response;
  };

  const screen = document.createElement("section");
  screen.id = "auth-screen";
  screen.className = "auth-screen";

  screen.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">✦ My AI</div>

      <h1 id="auth-title">Welcome Back</h1>
      <p class="auth-subtitle" id="auth-subtitle">
        Login to continue to your AI assistant.
      </p>

      <div class="auth-tabs">
        <button type="button" id="login-tab" class="auth-tab active">Login</button>
        <button type="button" id="signup-tab" class="auth-tab">Sign Up</button>
      </div>

      <form id="auth-form">
        <label class="auth-field" id="name-row" hidden>
          <span>Full Name</span>
          <input id="auth-name" type="text" minlength="2" maxlength="60">
        </label>

        <label class="auth-field">
          <span>Email Address</span>
          <input id="auth-email" type="email" required>
        </label>

        <label class="auth-field">
          <span>Password</span>
          <input id="auth-password" type="password"
            minlength="8" maxlength="128" required>
        </label>

        <label class="auth-field" id="confirm-row" hidden>
          <span>Confirm Password</span>
          <input id="auth-confirm" type="password">
        </label>

        <button class="auth-submit" id="auth-submit" type="submit">
          Login
        </button>

        <p id="auth-message" class="auth-message"></p>
      </form>

      <p class="auth-switch" id="auth-switch-text">
        Don't have an account?
        <button type="button" id="auth-switch">Create one</button>
      </p>
    </div>
  `;

  document.body.classList.add("auth-locked");
  document.body.prepend(screen);

  const $ = id => document.getElementById(id);

  let mode = "login";

  function clearSession() {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(USER_ID);
    localStorage.removeItem("my_ai_user");
  }

  function setMode(value) {
    mode = value;
    const signup = mode === "signup";

    $("auth-title").textContent =
      signup ? "Create Account" : "Welcome Back";

    $("auth-subtitle").textContent =
      signup ? "Create your My AI account." : "Login to continue.";

    $("name-row").hidden = !signup;
    $("confirm-row").hidden = !signup;

    $("auth-name").required = signup;
    $("auth-confirm").required = signup;

    $("auth-submit").textContent =
      signup ? "Create Account" : "Login";

    $("login-tab").classList.toggle("active", !signup);
    $("signup-tab").classList.toggle("active", signup);

    $("auth-switch-text").firstChild.textContent =
      signup ? "Already have an account? " : "Don't have an account? ";

    $("auth-switch").textContent =
      signup ? "Login" : "Create one";

    $("auth-form").reset();
    $("auth-message").textContent = "";
  }

  function showApp(user) {
    document.body.classList.remove("auth-locked");
    screen.hidden = true;

    const topbar = document.querySelector(".topbar");

    if (topbar) {
      let controls = $("account-controls");

      if (!controls) {
        controls = document.createElement("div");
        controls.id = "account-controls";
        controls.className = "account-controls";
        topbar.appendChild(controls);
      }

      controls.replaceChildren();

      const username = document.createElement("span");
      username.className = "account-name";
      username.textContent = user.name || user.email;

      const logout = document.createElement("button");
      logout.className = "logout-button";
      logout.textContent = "Log out";

      logout.onclick = () => {
        clearSession();
        location.reload();
      };

      controls.append(username, logout);
    }

    window.dispatchEvent(
      new CustomEvent("myai:authenticated", {detail: user})
    );
  }

  $("login-tab").onclick = () => setMode("login");
  $("signup-tab").onclick = () => setMode("signup");

  $("auth-switch").onclick = () =>
    setMode(mode === "login" ? "signup" : "login");

  $("auth-form").onsubmit = async event => {
    event.preventDefault();

    const name = $("auth-name").value.trim();
    const email = $("auth-email").value.trim().toLowerCase();
    const password = $("auth-password").value;

    if (mode === "signup" &&
        password !== $("auth-confirm").value) {
      $("auth-message").textContent = "Passwords do not match.";
      return;
    }

    const payload = mode === "signup"
      ? {name, email, password}
      : {email, password};

    const button = $("auth-submit");
    button.disabled = true;
    button.textContent = "Please wait...";

    try {
      const response = await fetch(`${API}/auth/${mode}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }

      localStorage.setItem(TOKEN, data.token);
      localStorage.setItem(USER_ID, String(data.user.id));
      localStorage.setItem("my_ai_user", JSON.stringify(data.user));

      showApp(data.user);

    } catch (error) {
      $("auth-message").textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent =
        mode === "signup" ? "Create Account" : "Login";
    }
  };

  async function restoreSession() {
    const token = getToken();

    if (!token) return;

    try {
      const response = await fetch(`${API}/auth/me`, {
        headers: {Authorization: `Bearer ${token}`}
      });

      const data = await response.json();

      if (!response.ok || !data.user) {
        throw new Error("Session expired");
      }

      localStorage.setItem(USER_ID, String(data.user.id));
      localStorage.setItem("my_ai_user", JSON.stringify(data.user));

      showApp(data.user);

    } catch {
      clearSession();
    }
  }

  setMode("login");
  restoreSession();
})();
