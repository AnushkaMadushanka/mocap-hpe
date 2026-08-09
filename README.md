# MoCap using HPE

**Markerless motion capture from an ordinary video.** Upload a clip of a person moving, and the system returns a 3D skeletal animation you can import into Blender, 3ds Max or any DCC tool — no suit, no markers, no camera rig.

[![Demo video](https://img.shields.io/badge/▶-Watch%20the%20demo-red)](https://www.youtube.com/watch?v=rZU_7MSCpr0)
![Python](https://img.shields.io/badge/Python-TensorFlow-blue)
![Node](https://img.shields.io/badge/Node.js-Express-green)
![Postgres](https://img.shields.io/badge/PostgreSQL-Sequelize-336791)

<img src="https://raw.githubusercontent.com/AnushkaMadushanka/anushkamadushanka.github.com/gh-pages/projects/mocap_hpe.webp" alt="MoCap using HPE" width="600">

---

## Why I built it

Optical motion capture systems cost tens of thousands of dollars and need a dedicated studio. The research on 3D human pose estimation had reached the point where a single RGB video could plausibly substitute for that hardware — but nothing packaged it as a product an animator could actually use.

This project closes that gap end to end: a trained pose-lifting model, a service that runs it, and an application backend that handles uploads, jobs, accounts and delivery.

## How it works

```
video upload ──► S3 (presigned PUT)
                   │
     Node API ─────┤ POST /api/animations/process-animation
                   ▼
        Flask model server  ──►  2D keypoint extraction (17 joints)
                   │             normalise to camera frame
                   │             lift to 3D  (two autoencoders)
                   │             camera → world transform
                   ▼
        3D joint positions + fps  ──►  stored in Postgres
                   │
                   └──►  SendGrid email: "your animation is ready"
```

**The lifting model is the core of it.** Rather than one network predicting everything, the pipeline splits the problem the way the pose-estimation literature does — because absolute position in the world and pose relative to the body are very different learning problems:

| Model | Input | Output | Job |
|---|---|---|---|
| Relative | `(frames, 17, 2)` 2D keypoints | `(16, 3)` | Where each joint sits relative to the root |
| Root | `(frames, 17, 2)` 2D keypoints | `(1, 3)` | Where the body is in the scene |

Both are dense encoder/decoder autoencoders (512 → 32 bottleneck → 512) trained against **MPJPE** — mean per-joint position error, the standard metric for this task — rather than a generic MSE, so the loss optimises the thing that actually matters visually. The two predictions are concatenated and the relative joints are offset by the root to produce a coherent skeleton, then mapped from camera space to world space.

Inference runs under `mixed_float16` precision to keep throughput up on modest GPUs.

## Repository layout

| Path | What it is |
|---|---|
| `hpe-model-server/` | Flask inference service (TensorFlow/Keras). `POST /predict` takes a video URL, returns 3D joint positions per frame. |
| `hpe-model-server/rel-checkpoint/`, `root-checkpoint/` | Trained weights for the two models, checked in so the server runs out of the box. |
| `hpe-model-server/common/`, `demo/` | 2D keypoint extraction, camera and quaternion maths. |
| `hpe-server/` | Node/Express application API — auth, uploads, job orchestration, persistence, notifications. |

### The application API

Deliberately kept as a normal production-shaped service rather than a script around the model:

- **JWT auth** with a validation middleware guarding every animation route
- **Direct-to-S3 uploads** via presigned PUT URLs, so video bytes never pass through the API
- **Sequelize + PostgreSQL** with versioned migrations (`users`, `animations`, and the relation between them)
- **Ownership scoping** — every query filters on `user_id`, so one user can't read another's animations
- **SendGrid** email on completion, because inference on a long clip is not a request you hold open

## Running it

### Model server

```bash
cd hpe-model-server
pip install tensorflow flask numpy
python server.py            # listens on :5000
```

```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/sample_video.mp4"}'
```

### Application API

```bash
cd hpe-server
yarn install
npx sequelize-cli db:migrate
yarn start                  # listens on :3001
```

Requires a `.env` with `DATABASE_URL`, `JWT_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_REGION`, `SENDGRID_API_KEY`, `PREDICTION_SERVER_ENDPOINT` and `FRONTEND_URL`.

## Credits

2D keypoint extraction and the camera/quaternion utilities are adapted from [StridedTransformer-Pose3D](https://github.com/Vegetebird/StridedTransformer-Pose3D). The lifting models, the inference service and the application backend are my own work.

## Status

Built in 2023 as a research and engineering project. Archived at the state shown in the demo — the web frontend lives outside this repository.

---

Built by [Anushka Madushanka](https://anushkamadushanka.github.io) · [More projects](https://anushkamadushanka.github.io/#projects)
