'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class animation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.user, { foreignKey: 'user_id' });
    }
  }
  animation.init({
    key: DataTypes.STRING,
    processed_data: DataTypes.JSON, 
    user_id: DataTypes.INTEGER,
    url: {
      type: DataTypes.VIRTUAL,
      get() {
        return `https://hpe-resources.s3-ap-southeast-1.amazonaws.com/${this.key}`;
      }
    }
  }, {
    sequelize,
    modelName: 'animation',
  });
  return animation;
};