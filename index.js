const express = require("express");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const User = require("./models/user.js");
const bcrypt = require("bcrypt");


app.use(require("express-session")({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, 
        maxAge: 1000 * 60 * 60
    }
}));

const mongoose = require("mongoose");
mongoose.connect("mongodb+srv://mohamedNode0:Sudo9864235@cluster0.ooyzru5.mongodb.net/?appName=Cluster0")
.then(() => {
    console.log("connected sucssufly");

}).catch((error) => {
    console.log("error", error);
});

function isLoggedIn(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    return res.redirect("/login.html");
}

function redirectIfLoggedIn(req, res, next) {
    if (req.session.userId) {
        return res.redirect("/chat");
    }
    next();
}

app.get("/",(req,res)=>{
    res.sendFile(__dirname + "/views/homePage.html");
});

app.get("/register.html",(req,res)=>{
    res.sendFile(__dirname + "/views/register.html");
});

app.get("/login.html", redirectIfLoggedIn, (req, res) => {
    res.sendFile(__dirname + "/views/login.html");
});

app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const isExist = await User.findOne({email});
            if (isExist){return res.sendFile(__dirname + "/views/regesterError.html");}
        const hashed = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            email,
            password: hashed
        });

        await newUser.save();

        res.sendFile(__dirname + "/views/succesR.html");
    } catch (err) {
        res.send("Error: " + err.message);
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        
        const user = await User.findOne({ email });
        if (!user) {
            return res.sendFile(__dirname + "/views/loginError.html");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.sendFile(__dirname + "/views/passwdErrror.html");
        }

        
        req.session.userId = user._id;

        res.redirect("/chat");

    } catch (err) {
        res.send("Error: " + err.message);
    }
});


app.get("/chat", isLoggedIn, (req, res) => {
    res.sendFile(__dirname + "/views/chat.html");
});



app.listen(443,()=>{
    console.log("server running on port 443")
})