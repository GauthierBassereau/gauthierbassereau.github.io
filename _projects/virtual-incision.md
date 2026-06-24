---
layout: post
title: Learning Bimanual Needle Manipulation from Demonstrations
date: 2024-09-10
summary: Built and deployed an ACT-style visuomotor policy for autonomous needle pickup and hand-off on a dual-arm surgical robot.
home_rank: 5
eyebrow: Research Internship
thumbnail: /assets/images/virtual-incision/poc_viz.gif
thumbnail_alt: MIRA dual-arm surgical robot above a surgical training model
impact: Took a visuomotor imitation-learning policy from teleoperated demonstrations to closed-loop execution on physical dual-arm hardware.
tags:
  - Imitation learning
  - ACT
  - Surgical robotics
  - Holoscan
  - TensorRT
metrics:
  - Real hardware
  - 100 demonstrations
  - Video rollout
links:
  - label: Code
    url: https://github.com/GauthierBassereau/Surgical-Robot-Imitation-Learning
  - label: Video
    url: https://youtu.be/wZuMUCP2N-o
  - label: ACT
    url: https://arxiv.org/abs/2304.13705
---
<!--more-->

At [Virtual Incision](https://virtualincision.com), I developed machine-learning components for MIRA, a compact dual-arm surgical robot. The main project was a visuomotor imitation-learning policy for needle pickup and hand-off. The objective was deliberately narrow: test whether a policy trained from teleoperation data could close the loop on real hardware and produce coordinated bimanual motion.

<figure class="media-block media-block--portrait">
  <img src="/assets/images/virtual-incision/robot_setup.jpeg" alt="MIRA dual-arm robot positioned above a surgical training model">
  <figcaption>MIRA setup used for collecting demonstrations and evaluating the learned policy.</figcaption>
</figure>

#### Supporting vision work

Before the control project, I worked on two components of the imaging stack:

- **Image super-resolution.** I trained EDSR and ESRGAN models to upscale the 1080p camera stream to 4K, then integrated inference into an NVIDIA Holoscan pipeline through TensorRT. The resulting quality-latency trade-off was not strong enough for the real-time constraint, so the project was not pursued further.
- **Segmentation infrastructure.** I deployed the open-source Label Studio platform with a GPU-backed Segment Anything Model annotation service. The pipeline supported mask annotation for organs, robot arms, and surgical tools, and was validated by training an initial U-Net segmentation model.

#### Control as sequence prediction

The manipulation task consisted of locating a surgical needle, grasping it, and transferring it between the two instruments. Rather than predicting Cartesian end-effector commands or solving inverse kinematics, the policy directly predicted joint-space targets.

Each action contained seven values per arm, including the gripper:

`a_t = [q_t^left, g_t^left, q_t^right, g_t^right] ∈ R^14`

Given the current RGB observation, the policy predicted a chunk of future targets:

`π_θ(I_t) → Â_t:t+K ∈ R^(K×14)`

Predicting one action at a time gives behavioral cloning a long effective horizon: small errors alter the next observation, and the policy can progressively leave the demonstration distribution. ACT instead predicts a coherent local trajectory of length `K`. This reduces the number of high-level decisions and captures short-range temporal structure such as coordinated approach, grasp, and transfer motions.

#### ACT architecture

I implemented an [Action Chunking Transformer](https://arxiv.org/abs/2304.13705)-style conditional variational autoencoder:

1. During training, a transformer encoder receives the current joint state and demonstrated future action chunk. Its `[CLS]` representation parameterizes a latent variable `z`, intended to capture variation between valid demonstrations.
2. A ResNet-18 converts the RGB frame into spatial visual tokens. These tokens are projected to the transformer dimension and combined with positional information.
3. A transformer encoder fuses the visual representation, robot state, and latent style.
4. A transformer decoder uses one learned query per future timestep and cross-attends to the encoded observation. A linear head maps the resulting sequence to `K × 14` joint and gripper targets.

The objective combines action reconstruction with KL regularization of the latent posterior. At inference time, the CVAE encoder is removed and `z` is fixed to the prior mean, producing deterministic action chunks.

<figure class="media-block media-block--diagram">
  <img src="/assets/images/virtual-incision/act-architecture.png" alt="Architecture of the Action Chunking Transformer conditional variational autoencoder">
  <figcaption>
    Original ACT architecture from
    <a href="https://arxiv.org/abs/2304.13705">Zhao et al.</a>
    The paper uses four camera views; my MIRA adaptation used the endoscopic RGB stream and a 14-dimensional bimanual action.
  </figcaption>
</figure>

The generative formulation matters because demonstrations are not deterministic. Similar visual states can admit different approach trajectories or timing. A deterministic regressor trained across incompatible modes can average them into an action sequence that belongs to none of the demonstrations. The latent variable gives the training objective a mechanism for representing this variation, while fixing `z = 0` provides a stable inference policy.

#### Demonstration pipeline

I collected approximately 100 teleoperated needle-manipulation trajectories. The dataset pipeline synchronized the camera stream with robot logs, extracted task-relevant trajectory segments, preserved demonstration boundaries, padded terminal chunks, and normalized each action dimension using training-set statistics.

Keeping trajectory boundaries intact was essential: an action chunk must never cross from the end of one demonstration into the beginning of another. Validation data was separated by demonstration rather than by individual frames to avoid measuring memorization of adjacent observations.

<figure class="media-block media-block--medium">
  <img src="/assets/images/virtual-incision/teleop.jpeg" alt="Teleoperation interface used to collect bimanual surgical robot demonstrations">
  <figcaption>Teleoperation interface used to collect synchronized visual and joint-space demonstrations.</figcaption>
</figure>

#### Closed-loop deployment

I integrated the trained policy as an operator in the Holoscan video pipeline. Each incoming frame was preprocessed on the GPU, passed through the policy, and converted back from normalized model outputs to robot joint targets. Re-querying the policy as new images arrived turned the action-chunk predictor into a receding-horizon visual controller rather than a single open-loop trajectory.

<figure class="media-block media-block--wide">
  <a href="https://youtu.be/wZuMUCP2N-o">
    <img src="https://img.youtube.com/vi/wZuMUCP2N-o/maxresdefault.jpg" alt="Autonomous needle pickup and hand-off demonstration">
  </a>
  <figcaption>Autonomous needle pickup and hand-off on MIRA. Click the image to watch the rollout.</figcaption>
</figure>

The resulting system completed autonomous needle pickup and hand-off on the physical robot. This was a feasibility result, not a claim of surgical autonomy: the dataset covered a narrow task distribution, recovery behavior was limited, and no formal safety or robustness study was performed. The useful result was demonstrating the complete path from teleoperated data collection to a learned bimanual policy running inside the robot's real-time perception stack.

[Source code](https://github.com/GauthierBassereau/Surgical-Robot-Imitation-Learning) ·
[ACT paper](https://arxiv.org/abs/2304.13705)
