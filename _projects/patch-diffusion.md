---
layout: post
title: Patch-Level Diffusion Forcing for Robot Video
date: 2026-06-24
summary: Ongoing research extending my DINOv2 latent world model with patch-wise noise for BridgeData V2 robot video prediction and more stable autoregressive rollouts.
home_rank: 1.5
eyebrow: Ongoing research
thumbnail: /assets/images/patch-diffusion/thumbnail.png
thumbnail_alt: BridgeData V2 rollout comparing ground truth, frame-level baseline, and patch-level diffusion model
impact: Investigating whether heterogeneous patch corruption improves the training signal and rollout stability of semantic robot video world models.
tags:
  - Diffusion Forcing
  - DINOv2
  - BridgeData V2
  - Robot video
  - World models
metrics:
  - 400M parameters
  - 40-frame rollouts
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

This is my current research continuation of the diffusion world model I built for my Master's thesis. The base system is the same in spirit: frozen DINOv2 patch features, a large spatial-temporal transformer, action conditioning, and Diffusion Forcing in semantic latent space. The new question is more specific:

> If different image regions have different prediction difficulty, should a robot video diffusion model corrupt and denoise them with different signal levels?

The motivation comes from [Patch Forcing](https://arxiv.org/abs/2604.19141), which extends [Diffusion Forcing](https://arxiv.org/abs/2407.01392) from sequence elements to patches. The original paper studies image generation, often with text conditioning. My setting is different: robot video is heavily conditioned by past frames and actions, and the relevant failure mode is not only sample quality but whether generated latents remain useful when fed back into a world model.

#### Starting point

Each RGB frame is encoded by a frozen DINOv2-base encoder into a `16 x 16` grid of patch tokens:

<div class="technical-equation">
  <code>z_t in R^(256 x 768)</code>
</div>

The world model is the same 24-block spatial-temporal transformer family as in my thesis: width `1024`, 16 attention heads, roughly 400M parameters, spatial attention inside frames, and causal temporal attention through the sequence. Actions enter through a separate action token.

In the frame-level baseline, Diffusion Forcing samples one signal level per frame:

<div class="technical-equation">
  <code>x_t(s_t) = s_t z_t + (1 - s_t) eps_t</code>
</div>

All 256 patches in that frame share `s_t`. This is already heterogeneous through time, but not through space.

#### Patch-wise corruption

Robot manipulation frames are spatially uneven. Background regions can be almost deterministic, while grippers, small objects, contacts, and occlusion boundaries are much harder. Patch-level corruption exposes the model to this structure directly.

For each frame, I sample a base signal `b_t` from the original schedule. Then each patch receives its own signal `s_(t,p)`, sampled from a truncated Gaussian below the base value:

<div class="technical-equation">
  <code>s_(t,p) <= b_t</code><br>
  <code>s_(t,p) ~ trunc_N(b_t, min(b_t / 2, 0.6)^2)</code>
</div>

The base signal still describes the global state of the frame, but patches span different corruption levels. Easier regions can therefore act as context for harder regions. This is the part I currently believe matters most for robot video: patch noise changes the training signal, not just the sampler.

#### Conditioning was not obvious

The source paper uses spatially varying timestep conditioning. My transformer was not built around AdaLN-Zero, so I first tried the direct solution: concatenate a learned 256-D signal embedding to every DINO token before projecting into the transformer.

That run was unstable. Evaluation improved early, then degraded after roughly `7k` steps and later became clearly worse. The training loss alone did not expose the failure strongly enough. My current hypothesis is that the learned per-patch signal code interfered with the structure of the pretrained DINO feature grid, but I do not want to overstate that from one run.

The successful version removes explicit per-patch conditioning. Patches are still corrupted with individual signal levels, but the model only receives the original frame-level signal token containing `b_t`. It has to infer which regions are reliable from the noisy DINO features, neighboring patches, temporal context, and actions.

I also implemented the paper's difficulty head and adaptive sampler: predict one patch difficulty value from the detached velocity error, then spend smaller denoising steps on harder patches. So far I do not see an inference improvement from this sampler. That may be because robot video is much more conditioned than text-to-image generation: past frames and actions already constrain the future strongly. For now, the evidence is clearer that patch-level noise improves training; whether it can also reduce inference cost is still open.

#### BridgeData V2 evaluation

I moved the experiments to [BridgeData V2](https://arxiv.org/abs/2308.12952) in LeRobot format to get a cleaner robot-video evaluation loop. Bridge episodes are short, usually around seven seconds, so I use one dataset index per episode instead of sampling many overlapping windows from the same trajectory.

The current setup is:

| Component | Configuration |
|---|---|
| Training data | BridgeData V2, one sample per episode |
| Sequence length | 40 frames at 5 Hz |
| Evaluation split | 32 held-out episodes |
| Representation | frozen DINOv2-base, `256 x 768` features per frame |
| Model | 24-block transformer, width `1024`, 16 heads, about 400M parameters |
| Main metrics | held-out DINO-feature MSE for teacher-forced prediction and autoregressive rollout |
| Compute | six NVIDIA H200 GPUs, roughly two days per long run |

Teacher-forced prediction measures local next-state generation from clean context. Autoregressive rollout starts from ten clean frames and then feeds generated latents back into the model. The second metric is the one that matters more for a world model.

#### Results so far

I compare three runs:

- **Frame-level baseline:** one signal level per frame.
- **Patch-level with explicit conditioning:** patch-wise noise plus concatenated signal embeddings; unstable.
- **Patch-level without explicit patch conditioning:** patch-wise noise, but only the frame-level base signal token is provided.

<div class="media-grid">
  <figure class="media-block">
    <img src="/assets/images/patch-diffusion/train_loss.png" alt="Training velocity loss for frame-level baseline, patch-level model, and failed conditioned patch-level model">
    <figcaption>Raw training loss. It is useful for optimization debugging, but not directly comparable because frame-level and patch-level corruption define different training distributions.</figcaption>
  </figure>
  <figure class="media-block">
    <img src="/assets/images/patch-diffusion/rollout_mse_20.png" alt="Held-out autoregressive rollout MSE at horizon 20 over training">
    <figcaption>Held-out rollout MSE at horizon 20. The successful patch-level run keeps improving while the frame-level baseline plateaus higher.</figcaption>
  </figure>
</div>

The important result is in held-out evaluation. The successful patch-level model reaches lower teacher-forced error and substantially better autoregressive rollout. At horizon 20, rollout MSE is approximately `0.23`, compared with `0.32` for the frame-level baseline and `0.47` for the failed explicit-conditioning run. At horizon 40, the values are approximately `0.24`, `0.34`, and `0.61`.

<figure class="media-block media-block--wide">
  <img src="/assets/images/patch-diffusion/rollout_mse_horizon.png" alt="Autoregressive rollout MSE by horizon for frame-level baseline, patch-level model, and failed conditioned patch-level model">
  <figcaption>Autoregressive DINO-feature MSE by rollout horizon. Patch-level corruption improves every horizon in this run, and the gap grows as predictions are fed back into context.</figcaption>
</figure>

Qualitatively, the improvement is not photorealism. The decoded DINO rollouts are still inspection tools, not the training target. The difference I care about is object persistence and relation stability: the patch-level model is less likely to lose the manipulated object or detach it from the robot interaction.

<figure class="media-block media-block--wide">
  <img src="/assets/images/patch-diffusion/baseline_vs_patch.png" alt="Decoded held-out rollout comparing ground truth, frame-level baseline, and patch-level diffusion model">
  <figcaption>Decoded held-out rollout. The patch-level model preserves the circular metal object and its final relation to the pan more consistently than the frame-level baseline.</figcaption>
</figure>

#### Current interpretation

My current interpretation is that patch-level corruption acts as a stronger training signal for semantic video dynamics. The same trajectory can appear with many spatial corruption patterns, so the model repeatedly has to infer object identity, boundaries, and local motion from partial evidence. Because the final model does not receive the local signal levels, it cannot solve the task by reading a patch timestep label; it has to use the scene.

This does not prove that explicit patch conditioning is bad, or that the adaptive sampler is useless. It only shows that my concatenation-based conditioning was unstable and that the sampler from image generation does not transfer directly. Video world models are more constrained by temporal context and actions than text-conditioned image models, so the inference-efficiency story may need a different sampler or a different notion of patch difficulty.

The project is still active. The next questions are how far the training gain scales, whether patch-level noise changes the learned representation or only regularizes optimization, and whether there is a video-specific way to turn patch difficulty into faster inference.

[Patch Forcing](https://arxiv.org/abs/2604.19141) ·
[Diffusion Forcing](https://arxiv.org/abs/2407.01392) ·
[BridgeData V2](https://arxiv.org/abs/2308.12952)
