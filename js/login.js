
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const identifier = document
        .getElementById("loginEmail")
        .value.trim().toLowerCase();

    const password = document
        .getElementById("loginPassword")
        .value;

    // Get registered users
    const users = JSON.parse(localStorage.getItem("users")) || [];

    // Find user using email or phone
    const user = users.find(user =>
        (user.email === identifier || user.phone === identifier) &&
        user.password === password
    );

    if (!user) {
        showMessage("Invalid email/phone number or password.", "error");
        return;
    }

    // Save logged-in user
    const loggedInUser = {
        id: user.id,
        name: user.name,
        email: user.email
    };

    localStorage.setItem(
        "loggedInUser",
        JSON.stringify(loggedInUser)
    );

    showMessage("Login successful! Welcome " + user.name, "success");

    loginForm.reset();

    setTimeout(() => {
        window.location.href = "index.html";
    }, 1500);

});

function showMessage(text, type) {
    message.textContent = text;
    message.className = type;
}
