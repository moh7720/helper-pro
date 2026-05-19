# Project Rules & Validation Task

## Project Summary

This project is a simple Node.js + Express + MongoDB web application for user registration and login.

The system contains:
- Login page
- Register page
- User model using MongoDB
- Session authentication
- Password hashing using bcrypt

The task assigned in this project is:

> Add Validation for User Inputs (Frontend + Backend Validation)

---

# Validation Task Description

The goal is to improve the security and reliability of the application by validating user inputs before saving or processing them.

Validation will be added in:

## Frontend Validation
Inside:
- register.html
- login.html

Using:
- required
- minlength
- maxlength
- type="email"
- pattern

Purpose:
- Prevent empty fields
- Prevent invalid email formats
- Prevent weak passwords
- Improve user experience

---

## Backend Validation
Inside:
- index.js
- models/user.js
- middleware/validation.js

Purpose:
- Prevent invalid data from reaching database
- Protect server from invalid requests
- Ensure all required fields are valid

---

# Project Architecture Rules

## 1. Keep Code Simple

This is a university project.

Rules:
- No advanced architecture
- No unnecessary libraries
- No complex design patterns
- No TypeScript
- No microservices
- No over-engineering

The code must be:
- Simple
- Readable
- Easy to edit
- Easy to merge with other students' work

---

# 2. Folder Structure

Project structure should stay simple:

project/
│
├── models/
│   └── user.js
│
├── views/
│   ├── login.html
│   ├── register.html
│   └── homePage.html
│
├── middleware/
│   └── validation.js
│
├── index.js
├── package.json
└── README.md

---

# 3. Backend Rules

## Express Rules
- Use simple Express routes
- Keep route logic short
- Avoid nested callbacks
- Use async/await only

## Validation Rules
Validation should check:
- Empty inputs
- Email format
- Password length
- Username length

Do NOT:
- Use complex validation frameworks
- Add enterprise-level logic

---

# 4. Database Rules

MongoDB + Mongoose only.

Schema should remain simple.

Example validations:
- required
- unique
- minlength

Avoid:
- Complex relations
- Advanced schema hooks
- Complicated plugins

---

# 5. Frontend Rules

Frontend must stay:
- Simple HTML
- Basic CSS
- No React
- No Vue
- No Angular

Use:
- Simple forms
- Clear inputs
- Simple error messages

---

# 6. Security Rules

Basic security only:
- Password hashing using bcrypt
- Session authentication
- Backend validation

Avoid:
- JWT complexity
- OAuth systems
- Advanced authentication systems

---

# 7. Team Collaboration Rules

This project is shared between students.

Therefore:
- Keep functions small
- Use clear variable names
- Avoid changing unrelated files
- Do not break existing routes
- Write reusable code
- Keep middleware independent

---

# 8. Codex Integration Rules

When generating code:
- Generate simple code only
- Do not refactor the entire project
- Preserve existing project structure
- Avoid unnecessary dependencies
- Keep files modular
- Do not create large frameworks

Preferred style:
- Beginner-friendly
- Easy to understand
- Easy to debug

---

# 9. Files Modified

## Modified Files
- index.js
- models/user.js
- views/login.html
- views/register.html

## Added Files
- middleware/validation.js

---

# 10. Validation Features Added

## Register Validation
- Username required
- Username minimum length
- Email required
- Email format validation
- Password minimum length

## Login Validation
- Email required
- Password required

---

# Final Notes

This project is a university assignment.

Main priority:
- Simplicity
- Readability
- Easy collaboration
- Easy merging with teammates' code

Avoid unnecessary complexity.
