---
layout: post
title: Diffusion World Models for Robotics
date: 2026-05-31
summary: A 400M-parameter latent world model trained on mixed robot and human-interaction video for action-conditioned UR5 prediction and offline visual planning.
home_rank: 1
home_featured: true
eyebrow: Master's thesis
thumbnail: /assets/images/world-model-thesis/thumbnail.png
thumbnail_alt: Ground-truth UR5 evaluation frames compared with a decoded CEM planning rollout
impact: Built a latent diffusion world model that uses semantic robot-video representations for offline goal-conditioned planning.
tags:
  - Diffusion
  - DINOv2
  - Planning
  - Large-scale datasets
metrics:
  - 400M parameters
  - 1,000h passive video
  - UR5 planning
links:
  - label: Code
    url: https://github.com/GauthierBassereau/World-Model
  - label: Thesis
    url: https://github.com/GauthierBassereau/World-Model/blob/main/thesis/thesis.pdf
---
<!--more-->

This work is my Master's thesis at the University of Tartu. I built a diffusion-style world model that predicts future robot observations in a frozen semantic representation rather than directly in pixel space. The model combines roughly two hours of action-labeled UR5 recordings with approximately 1,000 hours of external robot and human-interaction video, then uses the resulting latent simulator for offline goal-conditioned planning.

The central question was deliberately narrow:

> Can passive video improve an action-conditioned robot world model, and are its imagined latent trajectories accurate enough to support visual planning?

The resulting system contains a frozen DINOv2 encoder, a 400-million-parameter spatial-temporal transformer trained with Diffusion Forcing, a latent autoregressive sampler with KV caching, and a Cross-Entropy Method planner over UR5 end-effector actions.

<figure class="media-block media-block--wide">
  <img src="/assets/images/world-model-thesis/method_pipeline.png" alt="End-to-end training pipeline for the DINOv2 latent diffusion world model">
  <figcaption>Frames are encoded into DINOv2 patch features, independently corrupted, and denoised by an action-conditioned spatial-temporal transformer.</figcaption>
</figure>

#### Why predict representations instead of pixels?

A pixel-space world model must spend capacity on every visible detail: lighting, texture, sensor noise, background appearance, and the exact color of objects. Those details matter for photorealistic generation, but many are irrelevant to planning. A controller usually cares more about object identity, geometry, relative position, and affordances.

I therefore used patch features from a frozen [DINOv2](https://arxiv.org/abs/2304.07193) encoder as the state space. DINOv2 is trained by self-distillation rather than pixel reconstruction. Augmented views of the same image are encouraged to produce consistent features, making the representation less sensitive to nuisance variation while preserving semantic and spatial structure.

This choice follows the central observation behind [DINO-WM](https://arxiv.org/abs/2411.04983): a world model does not necessarily need to reconstruct the visual world if it can predict a representation in which distances between states are meaningful for control.

<figure class="media-block media-block--medium">
  <img src="/assets/images/world-model-thesis/imageencoders.png" alt="Comparison of autoencoding, masked autoencoding, and self-distillation objectives">
  <figcaption>Representation objectives emphasize different information. Self-distillation directly rewards invariance in feature space rather than pixel reconstruction.</figcaption>
</figure>

Each input frame is resized and center-cropped to `224 × 224`, then encoded by DINOv2-base with a `14 × 14` patch size. The class token and DINO register tokens are discarded; the world model operates on the dense image tokens:

<div class="technical-equation">
  <code>z_t ∈ R^(256 × 768)</code>
</div>

A single frame therefore contains 256 spatial tokens and 196,608 scalar features. This is not a compact VAE bottleneck. It is a large semantic feature grid, which has important consequences for transformer memory, diffusion noise schedules, and rollout feedback.

The pretrained decoder from [Representation Autoencoders](https://arxiv.org/abs/2510.11690) converts predicted DINO features back to RGB for inspection. It is only a visualization tool: neither training loss nor planning cost is computed in decoded pixel space.

#### Collecting the target-domain robot data

I extended [LeRobot](https://github.com/huggingface/lerobot) with UR5 support through the RTDE control interface and recorded the robot using smartphone teleoperation. The objective was not to collect demonstrations for one imitation-learning task. I wanted broad local dynamics: the arm picking up, moving, stacking, dropping, and contacting objects from varied configurations.

The target-domain dataset contains approximately two hours of interaction with ten tabletop objects. A single RGB camera was used for each episode, but its position changed between recordings to prevent the model from binding the robot dynamics to one fixed viewpoint.

The raw stream contains images, end-effector pose, gripper state, and robot timing. I resampled the trajectories to 5 Hz and represented actions as local end-effector displacements between consecutive states:

<div class="technical-equation">
  <code>Δp_local = R_t⁻¹(p_(t+1) - p_t)</code><br>
  <code>ΔR_local = R_t⁻¹R_(t+1)</code><br>
  <code>a_t = [Δx, Δy, Δz, Δr_x, Δr_y, Δr_z, Δg] ∈ R^7</code>
</div>

Translation is expressed in the current tool frame, making an action describe motion relative to the end effector rather than the fixed robot base. Orientation is computed as a relative rotation matrix and then converted to a rotation vector; directly subtracting two absolute rotation vectors would not represent the true rotational displacement.

Episodes are converted to a common LeRobot-style sequence format. Each training sample contains 32 frames at 5 Hz, corresponding to 6.4 seconds. Sequences extending beyond an episode are padded with terminal frames and accompanied by a validity mask, so artificial transitions do not contribute to the loss.

#### Learning from passive video and robot actions together

The UR5 dataset is too small to support a 400M-parameter video model by itself. The useful asymmetry is that action labels are scarce, but video is abundant. I mixed the target-domain recordings with three external sources:

| Source | Training weight | Actions used | Contribution |
|---|---:|:---:|---|
| UR5 recordings | 25% | yes | Target embodiment and action-conditioned transitions |
| [BridgeData V2](https://arxiv.org/abs/2308.12952) | 15% | no | Manipulation video from another robot setup |
| [EPIC-KITCHENS](https://epic-kitchens.github.io/) | 30% | no | Egocentric human-object interaction |
| [DROID](https://arxiv.org/abs/2403.12945) | 30% | no | Diverse in-the-wild robot manipulation |

All sources are temporally resampled to 5 Hz. Mixture weights are defined over effective video duration rather than stored frame count; otherwise, datasets recorded at higher native frame rates would be over-represented without containing more real interaction time.

I trained one action-capable model on the full mixture from the beginning. I did not pretrain an action-free backbone and attach action conditioning afterward, because that changes the input interface during fine-tuning and performed poorly in preliminary experiments.

The solution is a shared action-token position. Every frame receives a learned base action token. When a compatible UR5 action exists, its projected 7D embedding is added to that token. Passive video keeps only the base token. The architecture is unchanged across data sources, and action-free samples can still train visual dynamics.

<figure class="media-block media-block--medium">
  <img src="/assets/images/world-model-thesis/token_pipeline.png" alt="Construction of action, signal, register, and DINO patch tokens">
  <figcaption>Per-frame token construction. Action-free video and action-conditioned UR5 trajectories share the same transformer interface.</figcaption>
</figure>

The complete token layout for frame `t` is:

<div class="technical-equation">
  <code>[signal | action | register₁ … register₄ | patch₁ … patch₂₅₆]</code>
</div>

The signal token tells the denoiser how corrupted the current latent is. Four learned register tokens provide frame-level workspace. The 256 DINO patch tokens contain the visual state and are the only tokens projected back to DINO space and supervised by the reconstruction objective.

#### Spatial-temporal transformer

The world model is a block-causal transformer inspired by the scalable interface of [Dreamer 4](https://arxiv.org/abs/2509.24527) and the divided attention pattern of [TimeSformer](https://arxiv.org/abs/2102.05095).

The final configuration uses:

- 24 transformer blocks;
- model width 1024;
- 16 attention heads;
- approximately 400 million trainable parameters;
- temporal attention every fourth block;
- a 24-frame causal context, equivalent to 4.8 seconds at 5 Hz;
- pre-normalized RMSNorm, query-key normalization, rotary embeddings, SwiGLU feed-forward layers, and residual scaling.

Most blocks perform spatial attention inside each frame, allowing signal, action, register, and image tokens to interact. Temporal blocks transpose the representation and perform causal attention through time for each token position. This factorization avoids full attention over every patch in every frame while still propagating information across both image regions and temporal history.

<figure class="media-block media-block--medium">
  <img src="/assets/images/world-model-thesis/token_layout_attention.png" alt="Per-frame tokens with spatial and causal temporal attention">
  <figcaption>Spatial layers mix tokens within a frame; temporal layers propagate each token position causally through the sequence.</figcaption>
</figure>

During training, each frame is independently marked as temporally independent with probability `0.3`. Independent frames cannot attend to history and must be denoised from their own corrupted observation. Dependent frames use causal context and, when available, actions. This prevents the model from solving every example by copying nearby frames and ensures that passive images still provide useful denoising supervision.

UR5 actions are additionally masked with probability `0.3` on dependent frames. This keeps an unconditional pathway active even inside the target robot data and prevents the model from assuming that action information is always available.

#### Diffusion Forcing in a semantic feature space

Video futures are multi-modal. Given the same observation, an object may move in several valid directions, contact may resolve differently, or an occluded state may have multiple plausible continuations. A deterministic MSE predictor tends toward the conditional mean, which can represent no valid future.

I used flow matching to learn a conditional distribution over future semantic states. For a clean latent `z_t`, Gaussian noise `ε_t`, and signal level `s_t ∈ [0,1]`, the corrupted state is:

<div class="technical-equation">
  <code>x_t(s_t) = s_t z_t + (1 - s_t) ε_t</code>
</div>

The model predicts the clean endpoint and derives a velocity along the straight noise-to-data path. The training loss is the mean squared velocity error over valid DINO patch features.

Standard video diffusion usually assigns one noise level to an entire sequence. [Diffusion Forcing](https://arxiv.org/abs/2407.01392) assigns an independent noise level to each frame. A sequence can therefore contain clean observations, uncertain intermediate states, and nearly pure-noise future states simultaneously. The causal transformer learns to denoise arbitrary subsets conditioned on whatever reliable context remains.

<figure class="media-block media-block--wide">
  <img src="/assets/images/world-model-thesis/diffusion_forcing.png" alt="Comparison between teacher forcing and Diffusion Forcing">
  <figcaption>Per-frame corruption exposes the model to imperfect histories during training, reducing the mismatch encountered when generated states are fed back during rollout.</figcaption>
</figure>

The noise schedule required specific attention because a DINO frame has 196,608 dimensions. A moderate signal level can retain substantial recoverable information when spread over such a large representation. The final model uses the dimension-aware resolution shift proposed for high-dimensional RAE latents:

<div class="technical-equation">
  <code>s = αu / (1 + (α - 1)u)</code>, where
  <code>α = √(4096 / 196608) ≈ 0.144</code>
</div>

This schedule samples low signal levels more frequently and forces the model to solve genuinely difficult denoising problems.

<figure class="media-block media-block--medium">
  <img src="/assets/images/world-model-thesis/noise_schedule_distributions.png" alt="Uniform, logit-normal, and resolution-shifted signal schedules">
  <figcaption>The resolution-shifted distribution allocates more training probability to strongly corrupted high-dimensional DINO states.</figcaption>
</figure>

#### Autoregressive latent rollout

At inference time, observed frames are encoded once at signal level `1.0`, and their attention keys and values are stored in a KV cache. Each future state begins as Gaussian noise and is iteratively denoised with an Euler solver while attending to the cached history and candidate action.

After generation, the new state must become context for the next prediction. Feeding it back as perfectly clean context creates a train-test mismatch: it is generated, but presented to the model as if it were ground truth. I instead re-noise the generated latent to a fixed feedback signal before adding it to the cache.

<figure class="media-block media-block--wide">
  <img src="/assets/images/world-model-thesis/rollout_with_kv_cache.png" alt="Latent rollout with Euler denoising and transformer KV cache">
  <figcaption>Observed and generated states are cached once. Each new future latent is denoised while attending to the cached causal history, then reinserted at a controlled signal level.</figcaption>
</figure>

This mechanism is important for planning efficiency. Without caching, every candidate action sequence and denoising iteration would repeatedly recompute the same observation history.

#### Training and evaluation

Training used distributed data parallelism on four NVIDIA H200 GPUs from the University of Tartu UT Rocket cluster. The optimizer was AdamW with bfloat16 autocast, gradient clipping at norm `1.0`, and a warmup from `10⁻⁷` to `3 × 10⁻⁴` over 500 optimizer steps. Each dataloader batch contains 128 sequences of 32 frames; gradient accumulation over four minibatches increases the effective batch without exceeding memory limits.

All reported metrics use held-out UR5 episodes. Evaluation receives 85-frame sequences at 5 Hz:

- **Teacher forcing:** generate one next state from a clean real context and the ground-truth action.
- **Autoregressive rollout:** observe ten real frames, then generate the future using only ground-truth actions and the model's own predicted history.

Errors are mean squared distances in normalized DINO space, averaged over all 256 patches and 768 feature dimensions. Reporting horizons `H = 5, 10, 20` distinguishes local prediction quality from accumulated rollout drift.

#### Result 1: mixed video delayed overfitting

The UR5-only model reached its best held-out checkpoint after only 2,000 optimizer steps. Increasing the proportion of external video allowed useful training to continue much longer and substantially improved rollout quality.

<figure class="media-block media-block--wide">
  <img src="/assets/images/world-model-thesis/mixed_data_results.png" alt="Held-out rollout error for different proportions of UR5 and mixed video data">
  <figcaption>External robot and human-interaction video reduced held-out UR5 rollout error and delayed overfitting.</figcaption>
</figure>

| Training mixture | Best step | Teacher forcing | H=5 | H=10 | H=20 |
|---|---:|---:|---:|---:|---:|
| UR5 only | 2,000 | 0.166 | 0.224 | 0.257 | 0.312 |
| 50% UR5 | 5,500 | 0.153 | 0.210 | 0.238 | 0.280 |
| 25% UR5 | 15,500 | **0.141** | 0.186 | 0.210 | 0.242 |
| 10% UR5 | 35,500 | 0.148 | **0.178** | **0.199** | **0.236** |

The 10% UR5 mixture produced the lowest rollout errors, but required more than twice as many steps as the 25% setting and slightly worsened one-step prediction. Under the available compute budget, 25% UR5 was the more practical operating point.

The conclusion is not simply that more unrelated video is always better. Broader video acts as a useful regularizer and teaches generic visual dynamics, but target-domain frequency, model capacity, and training duration must remain balanced.

#### Result 2: one-step metrics hid rollout failures

The signal-schedule ablation produced nearly identical teacher-forced errors for logit-normal and resolution-shifted training: both reached `0.141`. Their autoregressive behavior was different:

| Signal schedule | Teacher forcing | H=5 | H=10 | H=20 |
|---|---:|---:|---:|---:|
| Uniform | 0.142 | 0.213 | 0.245 | 0.283 |
| Logit-normal | **0.141** | 0.205 | 0.232 | 0.263 |
| Resolution-shifted | **0.141** | **0.186** | **0.210** | **0.242** |

A one-step benchmark would have suggested that the two schedules learned comparable models. The difference only appears when generated states recursively enter the context. For a world model intended for planning, rollout evaluation is the relevant test.

#### Result 3: clean feedback was not optimal

The best `H=20` rollout error occurred when generated states were fed back at signal level `0.8`. Strong corruption destroyed useful temporal information, but perfectly clean feedback also degraded performance.

<figure class="media-block media-block--medium">
  <img src="/assets/images/world-model-thesis/rollout_feedback_signal.png" alt="Long-horizon rollout error across feedback signal levels">
  <figcaption>Partially corrupted generated history matched the model's Diffusion Forcing training distribution better than perfectly clean feedback.</figcaption>
</figure>

This result is specific to the interaction between training and representation dimensionality. A feedback level that would heavily damage a compact VAE latent can leave a 196k-dimensional DINO state highly informative.

#### What the model actually predicts

For qualitative evaluation, the model receives ten clean context frames and then only the future UR5 action sequence. The top row below is the held-out future; the bottom row is the action-conditioned latent rollout decoded by the RAE decoder.

<figure class="media-block media-block--wide">
  <img src="/assets/images/world-model-thesis/rollout_comparison_part1.png" alt="Ground-truth and generated UR5 rollout at early horizons">
  <img src="/assets/images/world-model-thesis/rollout_comparison_part2.png" alt="Ground-truth and generated UR5 rollout at later horizons">
  <figcaption>The background remains stable and robot motion follows the actions. Object identity becomes less reliable during contact and occlusion.</figcaption>
</figure>

The strong part is robot kinematics: the arm remains coherent and follows the provided motion over the shown horizon. The main failure mode is object dynamics. Small manipulated objects occupy few patch tokens, become occluded by the gripper, and can change appearance after contact. The model learned the robot body more reliably than the consequences of manipulation.

#### Planning toward a visual goal

The final experiment uses the world model as a simulator. Given a current image and a goal image, both are encoded with DINOv2. Candidate UR5 action sequences are rolled out in latent space, and their terminal state is scored by:

<div class="technical-equation">
  <code>J(a₁:H) = MSE(ẑ_H, z_goal) + λ/H Σ ||Δa_h||²</code>
</div>

The first term measures terminal DINO distance to the visual goal. The second discourages unnecessarily large end-effector jumps; `λ = 0.2`.

Before using this objective, I compared DINO feature distance with pixel MSE under random brightness and contrast perturbations. Pixel distance changed substantially even when the physical scene state did not. DINO distance tracked semantic progress toward the goal more smoothly.

<figure class="media-block media-block--wide">
  <img src="/assets/images/world-model-thesis/dino_vs_pixel_distance.png" alt="DINO and pixel distance to a visual goal under photometric perturbations">
  <figcaption>DINO feature distance is less sensitive than pixel MSE to nuisance brightness and contrast changes.</figcaption>
</figure>

I optimized the action sequence with the [Cross-Entropy Method](https://doi.org/10.1016/B978-0-444-53859-8.00003-5). CEM maintains a diagonal Gaussian over action sequences, samples a population, evaluates each candidate through the world model, retains an elite subset, and refits the distribution around those elites.

The reported run used:

- 30 CEM iterations;
- population 64;
- elite fraction `0.1`;
- 10 action steps;
- feedback signal `0.8`;
- 20 Euler denoising steps per generated state;
- action penalty weight `0.2`.

<div class="media-grid">
  <figure class="media-block">
    <img src="/assets/images/world-model-thesis/cem_cost_convergence.png" alt="CEM latent planning cost over iterations">
    <figcaption>The terminal latent cost decreases as CEM refines its proposal distribution.</figcaption>
  </figure>
  <figure class="media-block">
    <img src="/assets/images/world-model-thesis/cem_translation_error.png" alt="Terminal translation error during CEM optimization">
    <figcaption>Cartesian terminal error converges to centimeter and sub-centimeter values.</figcaption>
  </figure>
</div>

The latent objective correlated with physical robot configuration: as the DINO-space cost decreased, the terminal end-effector translation approached the held-out goal, reaching a combined error of approximately one centimeter.

<figure class="media-block media-block--medium">
  <img src="/assets/images/world-model-thesis/cem_trajectory_3d.png" alt="Evolution of the planned end-effector trajectory during CEM optimization">
  <figcaption>The sampled action distribution progressively contracts around a stable end-effector trajectory.</figcaption>
</figure>

The decoded rollout is the final sanity check. A lower latent cost is only useful if it corresponds to a coherent imagined transition rather than an adversarial shortcut in representation space.

<figure class="media-block media-block--wide">
  <img src="/assets/images/world-model-thesis/cem_planning_rollout.png" alt="Evaluation trajectory and decoded rollout under the optimized CEM action sequence">
  <figcaption>The optimized sequence produces an imagined motion toward the visual goal while remaining coherent over the planning horizon.</figcaption>
</figure>

#### Limitations

This is an offline planning result, not closed-loop robot control. The CEM experiment demonstrates that the learned latent dynamics and DINO cost can identify a meaningful action sequence on held-out UR5 data. It does not establish robustness to execution error, camera changes, calibration drift, or unexpected object motion.

The principal technical limitations are:

- **Contact and object identity.** Robot kinematics are modeled more reliably than small objects during grasping, occlusion, and contact.
- **Planning latency.** The illustrative CEM optimization takes roughly two minutes on one H200 GPU. Repeated diffusion rollouts are too expensive for real-time control.
- **Evaluation scale.** Planning diagnostics cover selected held-out episodes rather than a large closed-loop success benchmark.
- **Frozen representation constraints.** DINOv2 supplies useful semantics but may discard details needed for precise contact dynamics.

The direct next steps are closed-loop receding-horizon evaluation, faster sampling through distillation or consistency-style objectives, better action proposals, and richer supervision for object-centric interaction dynamics.

The main conclusion is narrower but useful: frozen semantic features form a viable state space for action-conditioned world modeling; passive interaction video measurably improves a small target-robot domain; and the resulting latent predictions are meaningful enough to support offline visual planning. The remaining gap is turning that useful simulator into a fast and robust controller.

[Source code](https://github.com/GauthierBassereau/World-Model) ·
[Full thesis](https://github.com/GauthierBassereau/World-Model/blob/main/thesis/thesis.pdf) ·
[DINOv2](https://arxiv.org/abs/2304.07193) ·
[DINO-WM](https://arxiv.org/abs/2411.04983) ·
[Diffusion Forcing](https://arxiv.org/abs/2407.01392)
