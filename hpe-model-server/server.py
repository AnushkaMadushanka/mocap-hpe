import os
import tensorflow as tf
import time

from tensorflow.keras.layers import Dense, Flatten,Reshape
from tensorflow.keras.models import Sequential
from tensorflow.keras.optimizers.legacy import Adam
from tensorflow.keras.callbacks import ModelCheckpoint
import tensorflow.keras.backend as K

def mpjpe(y_true, y_pred):
  # Compute the mean per-joint position error
  return tf.reduce_mean(tf.sqrt(tf.reduce_sum(tf.square(y_true - y_pred), axis=-1)))

noOfFrames = 1 # should always be odd number
gap = 1
assert noOfFrames % 2 == 1

tf.keras.mixed_precision.set_global_policy('mixed_float16')

def create_model(output_shape):
    input_shape=(noOfFrames, 17, 2)
    print("input_shape", input_shape)
    print("output_shape", output_shape)
    num_elm =output_shape[0]*output_shape[1]

    # Define the encoder
    encoder_input = tf.keras.layers.Input(shape=input_shape)
    x = tf.keras.layers.Flatten()(encoder_input)
    x = tf.keras.layers.Dense(512, activation='relu')(x)
    encoder_output = tf.keras.layers.Dense(32, activation='relu')(x)
    encoder = tf.keras.models.Model(encoder_input, encoder_output)

    # Define the decoder
    decoder_input = tf.keras.layers.Input(shape=(32,))
    x = tf.keras.layers.Dense(512, activation='relu')(decoder_input)
    x = tf.keras.layers.Dense(num_elm, activation='linear')(x)
    decoder_output = tf.keras.layers.Reshape(output_shape)(x)
    decoder = tf.keras.models.Model(decoder_input, decoder_output)

    # Define the full autoencoder model
    autoencoder_input = tf.keras.layers.Input(shape=input_shape)
    encoded = encoder(autoencoder_input)
    decoded = decoder(encoded)
    model = tf.keras.models.Model(autoencoder_input, decoded)

    model.compile(loss=mpjpe,optimizer=Adam())
    return model

relative_model = create_model((16, 3))
root_model = create_model((1, 3))

rel_checkpoint_dir = os.path.dirname('rel-checkpoint/cp-{epoch:04d}.ckpt')
rel_latest = tf.train.latest_checkpoint(rel_checkpoint_dir)
relative_model.load_weights(rel_latest)

root_checkpoint_dir = os.path.dirname('root-checkpoint/cp-{epoch:04d}.ckpt')
root_latest = tf.train.latest_checkpoint(root_checkpoint_dir)
root_model.load_weights(root_latest)

from demo.vis import get_pose2D
from common.camera import *

# https://raw.githubusercontent.com/Vegetebird/StridedTransformer-Pose3D/main/demo/video/sample_video.mp4


from flask import Flask, jsonify, request
import re

app = Flask(__name__)

@app.route('/predict', methods=['POST'])
def predict():
    start = time.time()
    # Get the data from the POST request.
    data = request.get_json(force=True)
    # validate data
    if not data['url']:
        return jsonify({'error': 'url is required'}), 400
    print("url: ", data['url'])
    # check if valid url using regex, return error if not valid
    # if not re.match(r'^https?:\/\/.*\.(?:mp4|avi|mov)$', data['url']):
    #     return jsonify({'error': 'url is not valid'}), 400
    
    test_keypoints, test_width, test_height, test_fps, test_length = get_pose2D(data['url'])

    for cam_idx, kps in enumerate(test_keypoints):
        # Normalize camera frame
        kps[..., :2] = normalize_screen_coordinates(kps[..., :2], w=test_width, h=test_height)
        test_keypoints[cam_idx] = kps

    pos_2d = []
    framesUpToMiddle = noOfFrames // 2
    for i in range(test_keypoints[0].shape[0]):
        if (i-framesUpToMiddle*gap < 0 or i+framesUpToMiddle*gap >= test_keypoints[0].shape[0]):
            continue
        pos_2d.append(test_keypoints[0][i-framesUpToMiddle*gap:i+framesUpToMiddle*gap+1:gap])

    rel_prediction = relative_model.predict(np.array(pos_2d))
    root_prediction = root_model.predict(np.array(pos_2d))
    root_prediction *= np.array([3.5331593, 1.8774002, 5.07106])
    root_prediction += np.array([-1.6017656, -1.2015667,  2.5101337])
    print(rel_prediction.shape)
    print(root_prediction.shape)
    prediction = np.concatenate((root_prediction, rel_prediction), axis=1)
    prediction[:, 1:] += prediction[:, :1]

    print("prediction success")

    cam = {
        'orientation': np.array([0.1407056450843811, -0.1500701755285263, -0.755240797996521, 0.6223280429840088], dtype='float32'),
        'translation': np.array([1841.1070556640625, 4955.28466796875, 1563.4454345703125], dtype='float32'),
    }
    prediction = camera_to_world(prediction.astype(np.float32), R=cam['orientation'], t=cam['translation'])
    end = time.time()
    print("Time took to process: ", end - start)
    print("Resolution ", "{width}x{height}".format(width=test_width, height=test_height))
    print("No of frames: ", test_length)
    print("FPS: ", test_fps)
    return jsonify({'prediction': prediction.tolist(), 'fps': test_fps }), 200

# example request
# curl -X POST -H "Content-Type: application/json" -d '{"url": "https://raw.githubusercontent.com/Vegetebird/StridedTransformer-Pose3D/main/demo/video/sample_video.mp4"}' http://localhost:5000/predict

if __name__ == '__main__':
    app.run(debug = True, host='0.0.0.0', port=5000)


