---
layout: post
title: Surgical EB-JEPA at Hack the World(s)
date: 2026-06-24
summary: A 24-hour Hack the World(s) project adapting EB-JEPA into an action-conditioned latent world model for Hamlyn surgical wrist-camera video.
home_rank: 2
eyebrow: Hackathon
thumbnail: /assets/images/surgical-eb-jepa/dataset.png
thumbnail_alt: Montage of Open-H healthcare robotics video frames including surgical and ultrasound scenes
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

At [Hack the World(s)](https://hacktheworlds.fr), a 24-hour world-model hackathon held on June 19-20, 2026, our team forked [EB-JEPA](https://github.com/Trick5t3r/eb_jepa) and adapted its action-conditioned example to surgical robot video. The objective was not to produce a general surgical model. We wanted a compact test of whether a JEPA-style latent predictor could roll forward real wrist-camera observations when conditioned on robot proprioception.

The source code is here:
[GauthierBassereau/eb_jepa_hacktheworlds](https://github.com/GauthierBassereau/eb_jepa_hacktheworlds).

#### Why JEPA here?

For this setting, the interesting property of JEPA is not that it avoids pixel reconstruction in the abstract. It is that a surgical frame contains many visually dominant nuisances: specularities, tissue texture, endoscopic lighting, compression artifacts, partial tool visibility. Predicting in representation space gives the model a chance to focus capacity on dynamics rather than RGB detail, while still leaving a latent cost that could later be used for planning.

The action-conditioned objective is simple:

<div class="technical-equation">
  <code>z_t = f_theta(x_t)</code><br>
  <code>z_hat_(t+1) = g_phi(z_t, a_t)</code><br>
  <code>L_pred = ||z_hat_(t+1) - sg(z_(t+1))||^2</code>
</div>

The energy-based view remains one reason JEPA is attractive for world models: the learned cost ranks whether a predicted latent future is compatible with the observation and action. We did not use it for planning in this project; the hackathon scope was representation prediction and rollout evaluation.

<figure class="media-block media-block--wide">
  <img src="/assets/images/surgical-eb-jepa/archi-schema-eb-jepa.png" alt="EB-JEPA architecture diagram showing image, video, action-conditioned video, and planning settings">
  <figcaption>EB-JEPA progression from image representation learning to action-conditioned video prediction and planning. We only implemented the action-conditioned video part.</figcaption>
</figure>

#### Loss and collapse prevention

The prediction loss alone is underconstrained. If the encoder maps every frame to a constant vector, the predictor becomes perfect and the representation is useless. We therefore stayed close to the VICReg-style regularization already implemented in EB-JEPA:

<div class="technical-equation">
  <code>L = L_pred + lambda_cov L_cov + lambda_std L_std + lambda_sim L_sim + lambda_idm L_idm</code>
</div>

`L_std` keeps representation dimensions above a minimum variance, `L_cov` penalizes redundant coordinates, `L_sim` constrains temporal smoothness, and `L_idm` trains an inverse-dynamics head to recover the action between two latents. The inverse-dynamics term is particularly relevant here because action conditioning is the whole reason this is a world-model experiment rather than video SSL.

SIGReg would have been a reasonable alternative collapse-prevention route, especially because it avoids some of the batch-statistics machinery of VICReg-style objectives. In 24 hours we did not have time to implement and validate it cleanly, so the experiments below only ablate the existing EB-JEPA regularizer terms.

#### Dataset choice

We used the [PhysicalAI-Robotics-Open-H-Embodiment](https://huggingface.co/datasets/nvidia/PhysicalAI-Robotics-Open-H-Embodiment) dataset, specifically `Surgical/hamlyn/suturing_2`. This subset contains 186 teleoperated dVRK dual-loop suturing trajectories, about 1.19 hours, on ex-vivo porcine tissue with bimanual PSM arms.

<figure class="media-block media-block--wide">
  <img src="/assets/images/surgical-eb-jepa/dataset.png" alt="Montage of Open-H healthcare robotics frames">
  <figcaption>Open-H contains varied healthcare robotics video. We used the Hamlyn dVRK suturing subset because it is real, action-logged, and single-embodiment.</figcaption>
</figure>

The subset was a practical choice. We needed one robot embodiment and one action space; there was no time to build an architecture that normalizes across different robot morphologies or control conventions. Several candidate datasets also had camera motion that was not logged as an action, which makes the visual transition hard to attribute in an action-conditioned model. The Hamlyn subset is not simulated, has realistic surgical noise, and provides synchronized video plus 16-D bimanual Cartesian proprioception.

Our loader reads the LeRobot-style episode metadata, Parquet proprioception tables, and MP4 streams directly. Each sample contains:

- `17` wrist-camera RGB frames;
- source video sampled from `30 Hz` to `5 Hz`;
- frames resized to `128 x 128`;
- a 32-D transition descriptor;
- complete held-out episodes for validation and evaluation.

The action vector is:

<div class="technical-equation">
  <code>a_t = [proprio_t, proprio_(t+1)] in R^32</code>
</div>

This is not a deployable command interface. We used it because the second arm is not always visible from the selected wrist camera. A relative image-space or single-arm action would make right-arm motion partly unobservable. Giving both current and next bimanual proprioception lets the predictor infer the hidden arm configuration relative to the visible left-arm view.

#### Evaluation first

The JEPA itself is trained only in latent space. For evaluation, we freeze the JEPA and train a small RGB decoder from latent states to frames. This does not make the main model generative; it gives us a way to visualize rollouts and compute LPIPS on decoded predictions.

Evaluation compares two modes:

| Mode | Context used for each future prediction | What it measures |
|---|---|---|
| Clean context | real encoded frames | teacher-forced next-latent quality |
| Autoregressive | generated latent history | compounding error during rollout |

The clean/autoregressive gap is the metric we cared about most. A one-step predictor can look reasonable while failing as soon as its own latents become context.

<figure class="media-block media-block--wide">
  <img src="/assets/images/surgical-eb-jepa/eval_ep15.gif" alt="Decoded evaluation rollout showing ground truth, autoregressive prediction, and clean-context prediction">
  <figcaption>Decoded held-out rollout: ground truth, fully autoregressive prediction, and clean-context prediction.</figcaption>
</figure>

#### Baseline architecture

We first reproduced the action-conditioned EB-JEPA baseline as directly as possible:

- IMPALA-style image encoder;
- latent dimension `512`;
- global latent format `[B, D, T, 1, 1]`;
- GRU predictor;
- `8`-step autoregressive training;
- AdamW, cosine warmup, bfloat16 autocast;
- batch size `384`, `24` epochs.

This global latent is a severe bottleneck, but it made the project runnable during the hackathon. A dense patch-space model would be more appropriate for surgical scenes, but it would also have changed the scope completely.

We then ran independent ablations. Each row below changes one factor relative to the baseline; the rows are not cumulative.

The two architecture variants were:

- **Transformer predictor:** 4-layer causal Transformer, width `512`, 8 heads, AdaLN-Zero action conditioning, history size `4`, and rollout starting from one real seed frame.
- **DINOv3 encoder:** `facebook/dinov3-convnext-tiny-pretrain-lvd1689m`, projected back to the EB-JEPA global latent interface.

#### Results

Lower LPIPS is better. `Gap Clean/AR` is the additional LPIPS from using generated latent context instead of clean encoded context.

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

The no-regularization run is the main sanity check: without the VICReg-style terms, AR LPIPS degrades from `0.470` to `0.575`. That is enough to show that collapse prevention is not optional.

Removing `W_Cov` or `W_Std` reduced the clean/autoregressive gap but worsened absolute rollout quality. My interpretation is that the decoded trajectories become more self-consistent but less informative; the model is not necessarily learning a better state.

Removing temporal similarity gave the best AR LPIPS in this small table, but increased the clean/autoregressive gap. That looks like a useful warning rather than a clean win: short-horizon metrics and rollout stability are not measuring exactly the same failure mode.

The Transformer predictor is the most interesting result. It does not dominate mean AR LPIPS, but it cuts the clean/autoregressive gap to `0.007` and gives the best 2-second LPIPS. In this setup, temporal prediction architecture looked like a stronger limitation than encoder pretraining.

This was a 24-hour project, so I would not overclaim the result. It was useful to implement EB-JEPA on a real surgical robotics subset, verify that the regularizers matter, and expose rollout stability as the metric worth optimizing next. Planning, denser latents, better decoder evaluation, and cleaner action interfaces remain open.

[Source code](https://github.com/GauthierBassereau/eb_jepa_hacktheworlds) ·
[Hack the World(s)](https://hacktheworlds.fr) ·
[EB-JEPA paper](https://arxiv.org/abs/2602.03604) ·
[Open-H dataset](https://huggingface.co/datasets/nvidia/PhysicalAI-Robotics-Open-H-Embodiment)
