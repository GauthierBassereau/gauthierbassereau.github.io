---
layout: post
title: Surgical Robot Imitation Learning (R&D Internship)
summary: Developed an Action Chunking Transformer for a dual-arm surgical robot, trained for tasks like needle pick and hand-off. The policy was deployed for real-time inference on an NVIDIA Holoscan pipeline.
---
<!--more-->

As my first internship, I had the honour of being part of Jay Carlson's R&D team at Virtual Incision, a surgical robotic company based in Nebraska.

---

### Internship Context & Highlights

- Organization: [Virtual Incision](https://www.virtualincision.com/) — surgical robotics R&D.
- Device: Dual-arm surgical robot performing needle pick-and-hand-off.
- Deployment: Real-time, on-device inference on NVIDIA Holoscan.
- Model: ACT-style policy predicting short joint trajectories from RGB frames.
- Data: Synchronized video frames and robot joint logs via this repo’s dataset tools.
- Demo: Closed-loop control achieving reliable pick-and-hand-off (see video below).

### Video Demo of Automated Pick and Handoff Task (speed up)

<div class="video-embed">
  <iframe
    src="https://www.youtube.com/embed/wZuMUCP2N-o"
    title="Automated Pick and Handoff"
    frameborder="3"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen>
  </iframe>
  </div>

- Classic imitation learning engine with train/resume/visualize/export modes.
- ACT-style model predicting short action sequences from images.
- Dataset tools to extract frames from video and align robot logs.

### Setup Photos

Photos of the robot environment and the teleoperation device used during development.

<table>
  <tr>
    <td align="center">
      <img src="/assets/images/2024-09-01-virtual-incision/robot_setup.jpeg" alt="Surgical robot setup" width="360">
    </td>
    <td align="center">
      <img src="/assets/images/2024-09-01-virtual-incision/teleop.jpeg" alt="Teleoperation device" width="360">
    </td>
  </tr>
</table>

### Data

- Each dataset root contains one or more `...demos/` folders with `demo_*` subfolders.
- Each `demo_*` has an `index.csv` referencing saved frames (`frame_*.npy`) and associated robot logs.
- Frames are stored as RGB numpy arrays; logs include joint angles used as training targets.
- Basic transforms/normalization and optional augmentations are configured in `act_il.yaml`.

### Training Logs (example)

<table>
  <tr>
    <td align="center">
      <img src="/assets/images/2024-09-01-virtual-incision/train_loss.png" width="360"><br>
      <sub>Train loss</sub>
    </td>
    <td align="center">
      <img src="/assets/images/2024-09-01-virtual-incision/val_loss.png" width="360"><br>
      <sub>Val loss</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="/assets/images/2024-09-01-virtual-incision/train_joint_1.png" width="360"><br>
      <sub>Train joint_1</sub>
    </td>
    <td align="center">
      <img src="/assets/images/2024-09-01-virtual-incision/val_joint_1.png" width="360"><br>
      <sub>Val joint_1</sub>
    </td>
  </tr>
</table>
