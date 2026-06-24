---
layout: post
title: Surgical EB-JEPA at Hack the World(s)
date: 2026-06-24
summary: A 24-hour Hack the World(s) project adapting EB-JEPA into an action-conditioned latent world model for Hamlyn surgical wrist-camera video.
home_rank: 2
eyebrow: Hackathon
thumbnail: /assets/images/surgical-eb-jepa/archi-schema-eb-jepa.png
thumbnail_alt: EB-JEPA diagram for image, video, action-conditioned video, and planning setups
impact: Adapted EB-JEPA to surgical robot video with proprioceptive conditioning, autoregressive latent rollout, and decoder-based LPIPS evaluation.
tags:
  - JEPA
  - World models
  - Robotics
  - Surgical video
  - Energy-based models
metrics:
  - 24-hour hackathon
  - 17-frame clips
  - 0.007 rollout gap
links:
  - label: Code
    url: https://github.com/GauthierBassereau/eb_jepa_hacktheworlds
  - label: Hackathon
    url: https://hacktheworlds.fr
  - label: EB-JEPA
    url: https://arxiv.org/abs/2602.03604
---
<!--more-->

At [Hack the World(s)](https://hacktheworlds.fr), a 24-hour world-model hackathon held on June 19-20, 2026, our team forked [EB-JEPA](https://github.com/Trick5t3r/eb_jepa) and turned its action-conditioned video example into a small surgical world-model prototype. The goal was deliberately narrow: take robot wrist-camera video, encode it into a latent state, condition future prediction on proprioception, and evaluate whether the learned latent dynamics survive autoregressive rollout.

The source repository is here:
[GauthierBassereau/eb_jepa_hacktheworlds](https://github.com/GauthierBassereau/eb_jepa_hacktheworlds).

<figure class="media-block media-block--wide">
  <img src="/assets/images/surgical-eb-jepa/archi-schema-eb-jepa.png" alt="EB-JEPA architecture diagram showing image, video, action-conditioned video, and planning settings">
  <figcaption>EB-JEPA progression from image representation learning to video prediction, action-conditioned video prediction, and planning. Our hackathon project focused on the action-conditioned video case.</figcaption>
</figure>

#### Why JEPA for surgical video?

The tempting baseline for robot video is generative: train a model to reconstruct or predict future pixels. That is expensive and often misaligned with control. A surgical wrist camera contains specular highlights, smoke, tool reflections, tissue texture, compression artifacts, and endoscopic lighting changes. Many of those pixels are visually salient but not equally important for predicting the effect of a tool motion.

JEPA changes the target. Instead of training a model to generate `x_(t+1)` in RGB space, an encoder maps frames into a representation:

<div class="technical-equation">
  <code>z_t = f_theta(x_t)</code>
</div>

and a predictor learns the next representation:

<div class="technical-equation">
  <code>z_hat_(t+1) = g_phi(z_t, a_t)</code>
</div>

The training cost compares `z_hat_(t+1)` with the encoded target `z_(t+1)`, not with the raw frame. In the action-conditioned setting, this is exactly the world-model interface I wanted to test: if the robot state and action are enough to predict the next latent, the model has learned something closer to controllable dynamics than image compression.

The "energy-based" part is the cost view. The model does not need to normalize a likelihood over all possible future images. It assigns low energy to compatible pairs and high energy to incompatible ones:

<div class="technical-equation">
  <code>E(x_t, a_t, x_(t+1)) = C(g_phi(f_theta(x_t), e(a_t)), f_theta(x_(t+1)))</code>
</div>

This is useful for planning because the same cost can, in principle, rank candidate futures or actions in latent space. But it creates a degenerate solution: the encoder can map every image to the same constant vector, making prediction trivial. EB-JEPA prevents that collapse with regularizers that keep representation dimensions active, decorrelated, temporally structured, and predictive of actions.

The objective we used is therefore closer to:

<div class="technical-equation">
  <code>L = L_pred + lambda_cov L_cov + lambda_std L_std + lambda_sim L_sim + lambda_idm L_idm</code>
</div>

where `L_pred` is the latent prediction loss, `L_cov` and `L_std` are variance/covariance anti-collapse terms, `L_sim` constrains temporal representation consistency, and `L_idm` trains an inverse-dynamics head to recover the action between two latents.

#### Dataset interface

We used the [PhysicalAI-Robotics-Open-H-Embodiment](https://huggingface.co/datasets/nvidia/PhysicalAI-Robotics-Open-H-Embodiment) dataset, specifically the `Surgical/hamlyn/suturing_2` subset. The repository adds a lightweight Open-H reader in `eb_jepa/datasets/open_h` rather than depending on the full LeRobot stack. It reads episode metadata, Parquet proprioception tables, and MP4 camera streams directly.

Each training window contains:

- `17` wrist-camera RGB frames;
- source video sampled from `30 Hz` down to `5 Hz`;
- frames resized to `128 x 128`;
- a 32-D action-conditioning vector for each transition;
- complete held-out episodes for validation and evaluation.

The action vector is not a learned command abstraction. It is the concatenation:

<div class="technical-equation">
  <code>a_t = [proprio_t, proprio_(t+1)] in R^32</code>
</div>

This is a hackathon-friendly choice: the dataset already exposes robot state, and the paired current/next proprioception gives the predictor a compact description of the physical transition it should explain. It is not yet the same as commanding a robot with an externally chosen action, but it is a useful first action-conditioned dynamics problem.

Complete episodes are held out, and proprioception normalization statistics are fit only on the training episodes. That detail matters: if normalization sees held-out trajectories, the evaluation is still numerically subtle leakage even when the frames themselves are excluded.

#### Baseline model

The baseline stays close to the original action-conditioned EB-JEPA example:

- IMPALA-style image encoder;
- latent dimension `512`;
- global latent format `[B, D, T, 1, 1]`;
- GRU predictor;
- `8`-step autoregressive training;
- VC/IDM/temporal-similarity regularization;
- AdamW with cosine warmup;
- bfloat16 autocast;
- batch size `384`;
- `24` training epochs.

The important architectural constraint is the global latent. We did not try to build a dense patch-space surgical model during the hackathon. Each frame becomes one 512-D state. That makes the experiment cheap enough to iterate overnight, but it also means the RGB decoder later has to hallucinate spatial details from a heavily compressed state.

#### Transformer predictor

The most useful modification was replacing the GRU predictor with a small causal Transformer. The implementation adds `ActionConditionedTransformerPredictor` and an `ActionSequenceEncoder` in `eb_jepa/architectures.py`.

The best configuration used:

- depth `4`;
- hidden dimension `512`;
- `8` attention heads;
- MLP dimension `2048`;
- action embedding dimension `512`;
- AdaLN-Zero conditioning from the embedded proprioception;
- history size `4`;
- one real seed frame before rollout history grows with predictions.

That last point is important. The original library assumed sequence predictors start from a full context window. We changed `eb_jepa/jepa.py` so autoregressive rollout can start from one real latent and then append predicted latents one by one. This matches the evaluation question more honestly: after the first frame, the model has to live with its own state estimates.

The best Transformer run also disabled the temporal similarity term (`W_Sim=0`). I would not interpret it as a pure architecture ablation. It is better understood as an architecture-plus-objective choice: the Transformer reduced rollout drift when trained without a one-step temporal similarity pressure that looked good locally but increased the clean-context/autoregressive gap.

#### DINOv3 encoder attempt

We also tried replacing the IMPALA encoder with `facebook/dinov3-convnext-tiny-pretrain-lvd1689m`. The adapter takes pretrained ConvNeXt features and projects them back into the standard EB-JEPA global latent interface, so the rest of the system can stay unchanged.

The motivation was obvious: a pretrained visual encoder should provide more semantic features than a small encoder trained from scratch on one surgical subset. In practice, it was not a free win. DINOv3 improved the clean/autoregressive gap relative to the baseline, but did not dominate the horizon LPIPS metrics. For a 24-hour project, the Transformer predictor was the cleaner result because it attacked the observed failure mode directly: compounding latent error.

#### Pixel evaluation without pixel training

JEPA training is latent-only. Pixels re-enter only after training, when the JEPA is frozen and a small RGB decoder is trained from latent states to frames. The decoder is deliberately separate from the representation objective:

<div class="technical-equation">
  <code>z_t -> decoder(z_t) -> x_hat_t</code>
</div>

This lets us inspect rollouts and compute LPIPS in image space without turning the main model into a pixel generator. It also keeps the metric honest about what it measures. LPIPS depends on decoder quality, so absolute numbers should not be read as photorealistic forecasting scores. The relative comparison between clean-context and autoregressive prediction is more informative.

Evaluation uses two modes:

| Mode | Context used for each future prediction | What it measures |
|---|---|---|
| Clean context | real encoded frames | one-step latent prediction quality under ideal context |
| Autoregressive | generated latent history | error accumulation during rollout |

The gap between the two is the cost of using the model as a world model rather than as a teacher-forced next-frame predictor.

#### Ablations

Lower LPIPS is better. `Gap Clean/AR` is the extra LPIPS paid by using generated context instead of clean encoded context. `Mean perf. change` is the spreadsheet's relative average versus the baseline across AR LPIPS, gap, and horizon columns.

| Run | AR LPIPS | Gap Clean/AR | LPIPS @ 0.2s | LPIPS @ 1s | LPIPS @ 2s | Mean perf. change |
|---|---:|---:|---:|---:|---:|---:|
| Collapse, no regularization | 0.575 | 0.026 | 0.549 | 0.550 | 0.587 | - |
| Baseline EB-JEPA | 0.470 | 0.020 | 0.446 | 0.448 | 0.480 | - |
| `W_Cov=0` | 0.507 | 0.010 | 0.495 | 0.497 | 0.512 | +2.7% |
| `W_Std=0` | 0.530 | 0.009 | 0.519 | 0.520 | 0.536 | -0.4% |
| `W_Sim=0` | 0.465 | 0.026 | 0.435 | 0.438 | 0.478 | -4.8% |
| `W_Idm=0` | 0.476 | 0.021 | 0.450 | 0.454 | 0.488 | -2.0% |
| DINOv3 Encoder | 0.478 | 0.014 | 0.450 | 0.466 | 0.475 | +4.7% |
| Transformer Predictor | 0.476 | 0.007 | 0.435 | 0.438 | 0.450 | +14.9% |

The collapse run is the sanity check. Without the regularization terms, AR LPIPS moves from `0.470` to `0.575`, which is large enough to show that the cost alone is not preventing a useless representation.

The `W_Sim=0` result is more subtle. It gives the best mean AR LPIPS, but also increases the clean/autoregressive gap from `0.020` to `0.026`. That is exactly the kind of metric split I care about for world models: a model can look better on short one-step predictions while becoming less stable when its own predictions become context.

The Transformer result is the main takeaway. It does not beat every row on average AR LPIPS, but it cuts the compounding gap to `0.007` and improves 2-second LPIPS from `0.480` to `0.450`. For a surgical video world model, that is the more interesting property. The limiting factor is not only whether the next latent is close; it is whether the representation remains usable after several generated transitions.

#### What I would change next

The prototype is still far from a deployable surgical world model. The action signal is derived from adjacent proprioception rather than from commanded controls, the latent is global rather than spatial, and the RGB decoder is too small to separate representation quality from reconstruction bottlenecks. The dataset is also only one surgical subset, so robustness to camera pose, tissue appearance, tool geometry, and task phase remains untested.

The next version I would build is more explicitly control-oriented:

- represent actions as commandable deltas rather than `[proprio_t, proprio_(t+1)]`;
- keep spatial tokens instead of compressing each frame to one global vector;
- evaluate latent distances against task-relevant state changes, not only decoded LPIPS;
- test planning by optimizing action sequences against a goal embedding;
- compare clean-context, partially corrupted-context, and fully autoregressive rollout, because real planning operates between those extremes.

The useful result from the hackathon is narrower but real: EB-JEPA can be adapted quickly to a surgical robot video dataset, the anti-collapse terms are not optional, and the dominant failure mode is rollout stability rather than one-step prediction alone.

[Source code](https://github.com/GauthierBassereau/eb_jepa_hacktheworlds) ·
[Hack the World(s)](https://hacktheworlds.fr) ·
[EB-JEPA paper](https://arxiv.org/abs/2602.03604) ·
[Open-H dataset](https://huggingface.co/datasets/nvidia/PhysicalAI-Robotics-Open-H-Embodiment)
