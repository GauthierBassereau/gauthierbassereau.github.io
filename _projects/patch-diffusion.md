---
layout: post
title: Patch-Level Diffusion for Robot Video
date: 2026-06-24
summary: Ongoing research testing whether patch-wise diffusion noise gives a DINOv2 latent robot-video world model a stronger training signal for objects, contacts, and spatial relationships.
home_rank: 0.1
eyebrow: Ongoing research
thumbnail: /assets/images/patch-diffusion/thumbnail.gif
thumbnail_alt: BridgeData V2 rollout comparison between ground truth, thesis baseline, and patch-level diffusion model
impact: Exploring patch-level corruption as a masked-autoencoder-like training signal for semantic robot video prediction.
tags:
  - Diffusion Forcing
  - DINOv2
  - BridgeData V2
  - World models
  - LeRobot
metrics:
  - 400M parameters
  - 40-frame rollouts
  - ongoing research
  - BridgeData V2
links:
  - label: Patch Forcing
    url: https://arxiv.org/abs/2604.19141
  - label: Diffusion Forcing
    url: https://arxiv.org/abs/2407.01392
  - label: BridgeData V2
    url: https://arxiv.org/abs/2308.12952
---
<!--more-->

This is a current research continuation of the diffusion world model I built for my Master's thesis. The system is still based on frozen DINOv2 patch features, a large spatial-temporal transformer, action conditioning, and diffusion in semantic latent space.

The idea comes from [Patch Forcing](https://arxiv.org/abs/2604.19141): instead of giving every patch in a frame the same noise level, corrupt patches independently. That makes a lot of sense for robot video. Background patches are often easy to predict, while grippers, small objects, occlusions, and contact regions are much harder.

This also matches the failures I care about in my own rollouts: objects disappearing, contacts becoming unstable, or the gripper-object relationship drifting over time. Patch-level corruption should increase the learning signal on these local spatial relationships instead of letting the model mostly solve the easy, static parts of the image.

I currently think of this as close in spirit to masked autoencoding, but adapted to a diffusion world model. The model sees a partially unreliable DINOv2 latent grid and has to reconstruct scene-consistent object identity, geometry, and motion from neighboring patches, temporal context, and robot actions.

<figure class="media-block media-block--wide">
  <img src="/assets/images/patch-diffusion/baseline_vs_patch.png" alt="BridgeData V2 rollout comparison between ground truth, thesis baseline, and patch-level diffusion model">
  <figcaption>Early BridgeData V2 rollout. All rows use the first frame and the evaluation episode actions as context: ground truth, my thesis architecture as the frame-level baseline, and the current patch-level version.</figcaption>
</figure>

This is very much still in progress. The next goal is to see how far this idea can be pushed for both generation efficiency and training efficiency, and to understand when patch-level diffusion is really useful rather than just a better regularizer.

[Patch Forcing](https://arxiv.org/abs/2604.19141) ·
[Diffusion Forcing](https://arxiv.org/abs/2407.01392) ·
[BridgeData V2](https://arxiv.org/abs/2308.12952)
