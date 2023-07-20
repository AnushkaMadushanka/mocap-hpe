import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import cv2
import argparse
import numpy as np
import posecamera
from lib.preprocess import h36m_coco_format, revise_kpts

det = posecamera.pose_tracker.PoseTracker()

def show2Dpose(video_path, kps, output):
    cap = cv2.VideoCapture(video_path)
    index = 0
    while(True):
        ret, frame = cap.read()
        if (ret):
            for (x, y) in kps[index]:
                cv2.circle(frame, (int(x), int(y)), 4, (255, 0, 0), -1)
            output.write(frame)
        else:
            break
        index += 1
    

def getPose(video_path):
    cap = cv2.VideoCapture(video_path)
    kpsAll = []
    scoresAll = []
    while(True):
        ret, frame = cap.read()
        if(ret):
            pose = det(frame)    
            keypointItems = pose.keypoints.items()
            kpsAll.append([[x, y] for name, (y, x, score) in keypointItems])
            scoresAll.append([score for name, (y, x, score) in keypointItems])
            # for name, (y, x, score) in keypointItems:
            #     cv2.circle(frame, (int(x), int(y)), 4, (255, 0, 0), -1)
            # output.write(frame)
        else:
            break
    return kpsAll, scoresAll
    

def get_pose2D(video_path):
    cap = cv2.VideoCapture(video_path)
    width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    fps= int(cap.get(cv2.CAP_PROP_FPS))
    length = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # output = cv2.VideoWriter('output.mp4', cv2.VideoWriter_fourcc(*'mp4v'), fps, (int(width), int(height)))
    print('\nGenerating 2D pose...')
    keypoints, scores = getPose(video_path)
    keypoints = np.array([keypoints])
    scores = np.array([scores])
    print("Keypoints shape: ", np.array(keypoints).shape)
    # output.release()

    keypoints, scores, valid_frames = h36m_coco_format(keypoints, scores)
    # output = cv2.VideoWriter('output_h36m_coco_format.mp4', cv2.VideoWriter_fourcc(*'mp4v'), fps, (int(width), int(height)))
    # show2Dpose(video_path, keypoints[0], output)
    # output.release()

    re_kpts = revise_kpts(keypoints, scores, valid_frames)
    print('Generating 2D pose successful!')
    cap.release()
    return keypoints, width, height, fps, length

