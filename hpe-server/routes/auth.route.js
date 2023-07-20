const express = require("express");
const router = express.Router();
const models = require("../models");

router.post("/register", async (req, res) => {
	try {
		const { firstname, lastname, email, password } = req.body;
		const isValid = models.user.validateUserData({
			firstname,
			lastname,
			email,
			password,
		});
		if (!isValid) throw new Error("Invalid Data");
		const user = await models.user.create({
			firstname,
			lastname,
			email,
			password: await models.user.hashPassword(password),
		});
		const userObj = user.toUserJson();
		res.status(201).json({
			message: "User created successfully",
			data: userObj,
		});
	} catch (error) {
		res.status(500).send({ error: error.message });
	}
});
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await models.user.findOne({ where: { email } });
        if (!user) throw new Error("User not found");
        const validPassword = await user.comparePassword(password);
        if (!validPassword) throw new Error("Incorrect Password");
        const userObj = user.toUserJson();
        const tokens = user.generateTokens();
        res.status(200).json({
            message: "User logged in successfully",
            data: userObj,
            tokens,
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

module.exports = router;