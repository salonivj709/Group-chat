
const signupForm = document.getElementById("signupForm");
const message = document.getElementById("message");

signupForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;

    // Validate name
    if (name.length < 3) {
        showMessage("Name must contain at least 3 characters.", "error");
        return;
    }

    // Validate email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        showMessage("Please enter a valid email address.", "error");
        return;
    }

    // Validate phone
    const phonePattern = /^[0-9]{10}$/;

    if (!phonePattern.test(phone)) {
        showMessage("Enter a valid 10-digit phone number.", "error");
        return;
    }

    // Validate password
    if (password.length < 8) {
        showMessage("Password must contain at least 8 characters.", "error");
        return;
    }

    // Get existing users
    const users = JSON.parse(localStorage.getItem("users")) || [];

    // Check duplicate email or phone
    const existingUser = users.find(user =>
        user.email === email || user.phone === phone
    );

    if (existingUser) {
        showMessage("Email or phone number already registered.", "error");
        return;
    }

    // Create user
    const newUser = {
        id: Date.now(),
        name: name,
        email: email,
        phone: phone,
        password: password
    };

    users.push(newUser);

    localStorage.setItem("users", JSON.stringify(users));

    showMessage("Registration successful! Redirecting...", "success");

    signupForm.reset();

    setTimeout(() => {
        window.location.href = "login.html";
    }, 1500);

});

function showMessage(text, type) {
    message.textContent = text;
    message.className = type;
}
