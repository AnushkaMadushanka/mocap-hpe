const express = require("express");
const aws = require("aws-sdk");
const router = express.Router();
const mime = require("mime-types");
const { v4: uuidv4 } = require("uuid");
const { default: axios } = require("axios");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const authMiddleware = require("../middlewares/auth.middleware");
const models = require("../models");

const s3 = new aws.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_S3_REGION,
});

router.get("/", authMiddleware.validateToken, async (req, res) => {
	try {
		const objs = await models.animation.findAll({
			where: {
				user_id: req.user.id,
			},
		});
		res.send(objs);
	} catch (error) {
		console.log(error);
		res.status(500).send({ error: "Something failed!" });
	}
});

router.get("/get-put-signed-url", authMiddleware.validateToken, async (req, res) => {
	try {
		const fileName = `${uuidv4()}.${req.query.ext}`;
		const contentType = mime.contentType(req.query.ext);
		const key = `videos/${fileName}`;
		const params = {
			Bucket: process.env.AWS_S3_BUCKET,
			Key: key,
			Expires: 60 * 60,
			ContentType: contentType,
			ACL: "public-read",
		};
		const signedUrl = await s3.getSignedUrlPromise("putObject", params);
		res.send({
			signedUrl,
			key,
		});
	} catch (error) {
		console.log(error);
		res.status(500).send({ error: "Something failed!" });
	}
});

router.get("/:id", authMiddleware.validateToken, async (req, res) => {
	try {
		if (!req.params.id) return res.status(400).send({ error: "Invalid id" });
		const obj = await models.animation.findOne({
			where: {
				id: req.params.id,
				user_id: req.user.id,
			},
		});
		res.send(obj);
	} catch (error) {
		console.log(error);
		res.status(500).send({ error: "Something failed!" });
	}
});

router.post("/process-animation", authMiddleware.validateToken, async (req, res) => {
	try {
		const {key} = req.body;
        if (!key) return res.status(400).send({ error: "Invalid key" });

		const url = `https://${process.env.AWS_S3_BUCKET}.s3-${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;
		const { data } = await axios.post(
			process.env.PREDICTION_SERVER_ENDPOINT,
			{
				url,
			},
			{
				timeout: 0,
			}
		);
		const obj = await models.animation.create({
			key,
			user_id: req.user.id,
			processed_data: data,
		});
		const user = await models.user.findByPk(req.user.id);
		const msg = {
			to: user.email,
			from: "anushkamadushanka1998@gmail.com",
			subject: "Your animation is ready!",
			text: `Access your animation here: ${process.env.FRONTEND_URL}/animation/${obj.id}`,
		};
		await sgMail.send(msg);
		res.send(obj);
	} catch (error) {
		res.status(500).send({ error: error.message });
	}
});

router.delete("/:id", authMiddleware.validateToken, async (req, res) => {
	try {
		if (!req.params.id) return res.status(400).send({ error: "Invalid id" });
		const obj = await models.animation.findOne({
			where: {
				id: req.params.id,
				user_id: req.user.id,
			},
		});
		if (!obj) return res.status(400).send({ error: "Invalid id" });
		// const params = {
		// 	Bucket: process.env.AWS_S3_BUCKET,
		// 	Key: obj.key,
		// };
		// await s3.deleteObject(params).promise();
		await obj.destroy();
		res.send(obj);
	} catch (error) {
		console.log(error);
		res.status(500).send({ error: "Something failed!" });
	}
});

module.exports = router;
