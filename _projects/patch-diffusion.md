---
layout: post
title: Patch-Level Diffusion Forcing for Robot Video
date: 2026-06-24
summary: Ongoing research testing patch-wise corruption in a DINOv2 latent robot-video world model, with current evidence pointing more to a training-signal benefit than to a clean diffusion-sampling win.
home_rank: 0.1
eyebrow: Ongoing research
thumbnail: /assets/images/patch-diffusion/thumbnail.gif
thumbnail_alt: BridgeData V2 rollout comparing ground truth, frame-level baseline, and patch-level diffusion model
impact: "Patch-wise corruption improves BridgeData rollouts, but one-step sampling exposes a limitation: the current environment may be too deterministic for the full diffusion interpretation."
tags:
  - Diffusion Forcing
  - DINOv2
  - BridgeData V2
  - World models
  - LeRobot
metrics:
  - 400M parameters
  - 40-frame rollouts
  - one-step sampler currently best
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

The current state of the project is encouraging but uncomfortable. Patch-wise corruption improves held-out rollouts in my experiments, but both the frame-level baseline and the patch-level model work best with a single denoising step. That makes the result less like a clear win for diffusion sampling, and more like evidence that heterogeneous corruption is improving the training signal.

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

The base signal still describes the global state of the frame, but patches span different corruption levels. Easier regions can therefore act as context for harder regions. The hypothesis was that this could help the model spend capacity on local uncertainty instead of treating every patch in a frame as equally noisy.

#### Conditioning was not obvious

The source paper uses spatially varying timestep conditioning. My transformer was not built around AdaLN-Zero, so I first tried the direct solution: concatenate a learned 256-D signal embedding to every DINO token before projecting into the transformer.

That run was unstable. Evaluation improved early, then degraded after roughly `7k` steps and later became clearly worse. The training loss alone did not expose the failure strongly enough. My current hypothesis is that the learned per-patch signal code interfered with the structure of the pretrained DINO feature grid, but I do not want to overstate that from one run.

The version that currently works best removes explicit per-patch conditioning. Patches are still corrupted with individual signal levels, but the model only receives the original frame-level signal token containing `b_t`. It has to infer which regions are reliable from the noisy DINO features, neighboring patches, temporal context, and actions.

This is useful empirically, but it is also the part I am most cautious about. A model trained with local `s_(t,p)` values but not given those values cannot implement the exact patch-wise diffusion vector field. It is closer to a blind contextual denoiser: it must infer local reliability from the token statistics and from scene consistency.

I also implemented the paper's difficulty head and adaptive sampler: predict one patch difficulty value from the detached velocity error, then spend smaller denoising steps on harder patches. So far I do not see an inference improvement from this sampler. More importantly, all current variants are best with one denoising step at evaluation time. Extra steps can even degrade the rollout.

#### BridgeData V2 evaluation

I moved the experiments to [BridgeData V2](https://arxiv.org/abs/2308.12952) in LeRobot format to get a cleaner robot-video evaluation loop. Bridge episodes are short, usually around seven seconds, so I use one dataset index per episode instead of sampling many overlapping windows from the same trajectory.

BridgeData is also a possible reason the diffusion story is weak here. The camera is usually fixed, the scene is constrained, and the robot action often gives most of the information needed for the next latent state. If the conditional distribution is close to deterministic, then iterative denoising has little uncertainty to resolve.

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

The useful result is in held-out evaluation. The successful patch-level model reaches lower teacher-forced error and substantially better autoregressive rollout. At horizon 20, rollout MSE is approximately `0.23`, compared with `0.32` for the frame-level baseline and `0.47` for the failed explicit-conditioning run. At horizon 40, the values are approximately `0.24`, `0.34`, and `0.61`.

I do not interpret this as evidence that a many-step patch diffusion sampler is solving the problem. In the current environment, one-step prediction is best for both the frame-level baseline and the patch-level model. That suggests the learned velocity field may be close to straight-line transport from noisy DINO features toward an action-conditioned target latent, rather than a curved reverse process that benefits from multiple refinement steps.

<figure class="media-block media-block--wide">
  <img src="/assets/images/patch-diffusion/rollout_mse_horizon.png" alt="Autoregressive rollout MSE by horizon for frame-level baseline, patch-level model, and failed conditioned patch-level model">
  <figcaption>Autoregressive DINO-feature MSE by rollout horizon. Patch-level corruption improves every horizon in this run, and the gap grows as predictions are fed back into context.</figcaption>
</figure>

Qualitatively, the improvement is not photorealism. The decoded DINO rollouts are still inspection tools, not the training target. The difference I care about is object persistence and relation stability: the patch-level model is less likely to lose the manipulated object or detach it from the robot interaction. That is still meaningful for a latent world model, but it does not by itself validate the diffusion mechanism.

<figure class="media-block media-block--wide">
  <img src="/assets/images/patch-diffusion/baseline_vs_patch.png" alt="Decoded held-out rollout comparing ground truth, frame-level baseline, and patch-level diffusion model">
  <figcaption>Decoded held-out rollout. The patch-level model preserves the circular metal object and its final relation to the pan more consistently than the frame-level baseline.</figcaption>
</figure>

#### Current interpretation

My current interpretation is that patch-level corruption acts as a stronger training signal for semantic video dynamics. The same trajectory can appear with many spatial corruption patterns, so the model repeatedly has to infer object identity, boundaries, and local motion from partial evidence. Because the best model does not receive the local signal levels, it cannot solve the task by reading a patch timestep label; it has to use the scene.

The stronger claim I do not want to make is that this is already a correct patch-wise diffusion model. If the next latent is almost determined by context,

<div class="technical-equation">
  <code>z_(t+1) ~= mu(past frames, actions)</code>
</div>

then the optimal velocity can point in nearly the same direction for most signal levels. In that regime, one Euler step is enough, and additional denoising steps mainly add model bias, over-smoothing, or off-distribution intermediate latents. The method can still improve training while being a poor test of the diffusion paradigm.

The most plausible explanation right now is closer to masked autoencoding or blind denoising in DINO latent space. Patch corruption forces the model to estimate which tokens are reliable, which tokens are inconsistent with the scene, and which local features should be reconstructed from temporal and action context. During autoregressive rollout, this may help because generated mistakes resemble locally corrupted tokens that the model has learned to pull back toward scene-consistent features. This is a useful hypothesis, but not yet a proven mechanism.

The project is still active. The next checks are deliberately aimed at falsifying the easy story: compare against a direct one-step masked-denoising baseline, measure velocity curvature across signal levels, evaluate whether gains concentrate on objects and contact regions rather than background patches, and move to less deterministic data. DROID or Open X-Embodiment would keep the robot-action setting, while navigation or EPIC-KITCHENS-style egocentric video would stress camera motion and multimodal futures. The result I would trust most is not just lower MSE on BridgeData, but a setting where multiple denoising steps are actually needed.

[Patch Forcing](https://arxiv.org/abs/2604.19141) ·
[Diffusion Forcing](https://arxiv.org/abs/2407.01392) ·
[BridgeData V2](https://arxiv.org/abs/2308.12952)
