'use strict';
const {
  Model
} = require('sequelize');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const yup = require('yup');

const schema = yup.object().shape({
  firstname: yup.string().required(),
  lastname: yup.string().required(),
  email: yup.string().email().required(),
  password: yup.string().matches(/^.*(?=.{8,})((?=.*[!@#$%^&*()\-_=+{};:,<.>]){1})(?=.*\d)((?=.*[a-z]){1})((?=.*[A-Z]){1}).*$/)
});

module.exports = (sequelize, DataTypes) => {
  class user extends Model {
		static validateUserData(data) {
			return schema.isValidSync(data);
		}
		static validatePassword(password) {
			return yup.reach(schema, "password").isValidSync(password);
		}
		static hashPassword(password) {
			return bcrypt.hash(password, 10);
		}
		comparePassword(password) {
			return bcrypt.compare(password, this.password);
		}

    generateTokens() {
      let payload = {
        id: this.id,
        firstname: this.firstname,
        email: this.email
      }
      let accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
        algorithm: "HS256",
        expiresIn: process.env.ACCESS_TOKEN_LIFE
      })
      return {
        accessToken,
      }
    }

    toUserJson(){
      const userJson = this.toJSON()
      delete userJson.password
      return userJson
    }

		static associate(models) {
			this.hasMany(models.animation, { foreignKey: 'user_id' });
		}
  }
  user.init({
    firstname: DataTypes.STRING,
    lastname: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'user',
  });
  return user;
};