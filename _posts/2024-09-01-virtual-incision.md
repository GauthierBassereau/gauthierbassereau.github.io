---
layout: post
title: Surgical Robot Imitation Learning (internship at Virtual Incision)
summary: Developed an Action Chunking Transformer for a dual-arm surgical robot, trained for tasks like needle pick and hand-off. The policy was deployed for real-time inference on an NVIDIA Holoscan pipeline.
---

As my first internship, I had the honour of being part of Jay Carlson's R&D team at Virtual Incision, a surgical robotic company based in Nebraska.

<!--more-->

## Internship Context & Highlights

- Organization: [Virtual Incision](https://www.virtualincision.com/) — surgical robotics R&D.
- Device: Dual-arm surgical robot performing needle pick-and-hand-off.
- Deployment: Real-time, on-device inference on NVIDIA Holoscan.
- Model: ACT-style policy predicting short joint trajectories from RGB frames.
- Data: Synchronized video frames and robot joint logs via this repo’s dataset tools.
- Demo: Closed-loop control achieving reliable pick-and-hand-off (see video below).

## Video Demo of Automated Pick and Handoff Task

[![Watch the video](https://img.youtube.com/vi/wZuMUCP2N-o/maxresdefault.jpg)](https://youtu.be/wZuMUCP2N-o)

(https://youtu.be/wZuMUCP2N-o)

- Classic imitation learning engine with train/resume/visualize/export modes.
- ACT-style model predicting short action sequences from images.
- Dataset tools to extract frames from video and align robot logs.

## Setup Photos

Photos of the robot environment and the teleoperation device used during development.

<table>
  <tr>
    <td align="center">
      <img src="assest/images/2024-09-01-virtual-incision/robot_setup.jpeg" alt="Surgical robot setup" width="360">
    </td>
    <td align="center">
      <img src="assest/images/2024-09-01-virtual-incision/teleop.jpeg" alt="Teleoperation device" width="360">
    </td>
  </tr>
</table>

## Data

- Each dataset root contains one or more `...demos/` folders with `demo_*` subfolders.
- Each `demo_*` has an `index.csv` referencing saved frames (`frame_*.npy`) and associated robot logs.
- Frames are stored as RGB numpy arrays; logs include joint angles used as training targets.
- Basic transforms/normalization and optional augmentations are configured in `act_il.yaml`.

## Training Logs (example)

<table>
  <tr>
    <td align="center">
      <img src="assest/images/2024-09-01-virtual-incision/train_loss.png" width="360"><br>
      <sub>Train loss</sub>
    </td>
    <td align="center">
      <img src="assest/images/2024-09-01-virtual-incision/val_loss.png" width="360"><br>
      <sub>Val loss</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="assest/images/2024-09-01-virtual-incision/train_joint_1.png" width="360"><br>
      <sub>Train joint_1</sub>
    </td>
    <td align="center">
      <img src="assest/images/2024-09-01-virtual-incision/val_joint_1.png" width="360"><br>
      <sub>Val joint_1</sub>
    </td>
  </tr>
</table>

---

- All training artifacts are stored under `Archive/<ENGINE>_<MODEL>_<TAG>_<TIMESTAMP>/` (config, logs, plots, checkpoints).
- Engine entrypoint: `main.py` with modes `train|resume|visualize|export`.

## Quickstart

1) Environment (Python 3.10+):

```
pip install torch torchvision
pip install numpy pandas pyyaml matplotlib albumentations opencv-python av colorama
```

2) Configure data paths in `source/configs/act_il.yaml` (`train_data_path`, `val_data_path`).

3) Train / Visualize / Export:

```
python main.py train --engine ClassicIL --config act_il
python main.py visualize --archive_model ClassicIL_ACTModel_Vanilla_20240907_194141
python main.py export --archive_model ClassicIL_ACTModel_Vanilla_20240907_194141
```
