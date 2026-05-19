function isEmpty(value) {
  return !value || value.trim() === "";
}

function validateRegister(req, res, next) {
  const { username, email, password } = req.body;
  const errors = [];

  if (isEmpty(username)) errors.push("Username is required");
  else if (username.trim().length < 3) errors.push("Username must be at least 3 characters");

  if (isEmpty(email)) errors.push("Email is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Please enter a valid email address");

  if (isEmpty(password)) errors.push("Password is required");
  else if (password.length < 8) errors.push("Password must be at least 8 characters");
  else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) errors.push("Password must contain at least one letter and one number");

  if (errors.length > 0) {
    return res.status(400).send(errors.join("<br>"));
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (isEmpty(email)) errors.push("Email is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Please enter a valid email address");

  if (isEmpty(password)) errors.push("Password is required");

  if (errors.length > 0) {
    return res.status(400).send(errors.join("<br>"));
  }

  next();
}

module.exports = { validateRegister, validateLogin };
