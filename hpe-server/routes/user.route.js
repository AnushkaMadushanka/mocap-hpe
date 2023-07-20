const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const router = express.Router();
const models = require("../models");

router.get('/', authMiddleware.validateToken, async (req, res) => {
    try {
        const user = await models.user.findByPk(req.user.id);
        res.status(200).json({ data: user.toUserJson() })
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

router.put('/update', authMiddleware.validateToken, async (req, res) => {
    try {
        const { firstname, lastname, email } = req.body;
		const data = {};
		if (firstname != undefined) data.firstname = firstname;
		if (lastname != undefined) data.lastname = lastname;
		if (email != undefined) data.email = email;
        await models.user.update(data, { where: { id: req.user.id } });
        res.status(200).json({
            message : "User updated successfully",
        })
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

router.post('/changePassword', authMiddleware.validateToken, async (req, res) => {
    try {
        const {oldPassword, newPassword} = req.body
        const user = await models.user.findByPk(req.user.id);
		const validPassword = await user.comparePassword(oldPassword);
		if (!validPassword) throw new Error("Incorrect Password");
		const valid = await models.user.validatePassword(newPassword);
		if (!valid) throw new Error("Not a valid password");

		user.password = await models.user.hashPassword(newPassword);
		await user.save();
        res.status(200).json({
            message: "Changed the password successfuly",
        })
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

module.exports = router;