---
layout: post
title: Few-Step Generative Distillation on a 2D Diffusion Teacher
summary: Implemented DMD and DMD2 for distilling a DDPM teacher into a one-step generator on a Gaussian-to-checkerboard transport task.
---
<!--more-->

This was a personal implementation project in the continuation of my work on diffusion world models for robotics: take a trained generative process, compress its sampling trajectory, and study what is lost when generation is forced into one or a few steps.

The setting is intentionally small enough to inspect directly. The source distribution is an isotropic Gaussian `π0`; the target distribution `π1` is uniform over eight active cells of a 4×4 checkerboard. The task is to learn a transport from `π0` to `π1`, first with a DDPM teacher, then with one-step students trained by regression, DMD, and DMD2-style objectives.

<figure class="media-block media-block--medium">
  <img src="/assets/images/2026-06-07-generative-distillation/data_source_target.png" alt="Gaussian source samples overlaid with checkerboard target samples">
  <figcaption>Source and target distributions. The target is multimodal, but each mode has large 2D support rather than occupying a tiny high-dimensional image manifold.</figcaption>
</figure>

#### Teacher model

I implemented a DDPM teacher with an MLP noise predictor conditioned on sinusoidal timestep embeddings. Training used the standard epsilon-prediction objective:

<div class="technical-equation">
  <code>x_t = sqrt(alpha_bar_t) x_0 + sqrt(1 - alpha_bar_t) eps</code><br>
  <code>L_teacher = E || eps_phi(x_t, t) - eps ||^2</code>
</div>

Sampling used deterministic DDIM updates. With the full 1000-step trajectory, the teacher recovered the checkerboard structure; with one or four DDIM steps directly from the same teacher, the samples were poor. This is the failure case distillation is supposed to address: the teacher learned a score field distributed across many small denoising corrections, not a single global jump from Gaussian noise to target samples.

<div class="media-grid">
  <figure class="media-block">
    <img src="/assets/images/2026-06-07-generative-distillation/teacher_samples.png" alt="1000-step DDIM teacher samples matching the checkerboard target">
    <figcaption>Full teacher sampling recovers the target modes.</figcaption>
  </figure>
  <figure class="media-block">
    <img src="/assets/images/2026-06-07-generative-distillation/one_step_teacher_samples.png" alt="One-step DDIM teacher samples failing to match the checkerboard target">
    <figcaption>A naive one-step teacher call amplifies denoising error instead of producing a valid transport.</figcaption>
  </figure>
</div>

#### Why regression is not the full problem

The simplest distillation baseline is to precompute pairs `(z, x_teacher)` by running the teacher from Gaussian noise `z`, then train the student with MSE:

<div class="technical-equation">
  <code>L_reg = || G_theta(z) - DDIM_teacher(z) ||^2</code>
</div>

This is useful, but it is not a distribution-matching objective. It asks the student to imitate teacher samples for fixed latent seeds. If the teacher mapping is complex or the target density contains many narrow modes, the regression objective can spend capacity matching arbitrary pairings rather than correcting density error. In high-dimensional image generation, this is where pointwise losses tend to blur, average, or miss modes.

DMD changes the supervision signal. Instead of asking whether a generated sample matches its paired teacher output, it asks whether the student distribution has the same score field as the teacher distribution. For a generated sample `x = G_theta(z)`, I re-noise it to `x_t`, evaluate two denoisers, and use their clean-sample predictions as a score-difference proxy:

<div class="technical-equation">
  <code>x_real = x0_hat_teacher(x_t, t)</code><br>
  <code>x_fake = x0_hat_fake(x_t, t)</code><br>
  <code>grad_DMD ~= (x_fake - x_real) / || x - x_real ||</code>
</div>

The teacher denoiser is frozen and represents the target distribution. The fake denoiser is trained online on student samples and represents the current generator distribution. Their difference estimates how the generator should move samples to reduce distribution mismatch. In the code, I implemented this with the usual stop-gradient target trick:

<div class="technical-equation">
  <code>target = stopgrad(x - grad_DMD)</code><br>
  <code>L_DMD = 0.5 || x - target ||^2</code>
</div>

This was the central implementation point of the project: not a new architecture, but the mechanics required to make the DMD gradient usable inside a small DDPM/DDIM pipeline.

#### Stabilizing the DMD update

The DMD loss was the least forgiving part of the implementation. The clean prediction

<div class="technical-equation">
  <code>x0_hat = (x_t - sqrt(1 - alpha_bar_t) eps_hat) / sqrt(alpha_bar_t)</code>
</div>

becomes ill-conditioned at very large timesteps because `alpha_bar_t` is close to zero. Small noise-prediction errors are amplified by `1 / sqrt(alpha_bar_t)`, and the fake denoiser is itself changing during training. The result is an easy path to gradient spikes.

The stabilizers that mattered were practical:

- clamping the DMD normalization term with `clamp_min(1e-1)`;
- clipping generator, fake-denoiser, and discriminator gradients;
- reducing the maximum sampled DMD timestep.

The last point is the most interesting scientifically. Paper settings often sample very late diffusion times, but in this 2D checkerboard setup, pushing `t_max_fraction` near `0.95-0.98` often made the score-difference target noisy. Reducing it toward `0.8` kept more target geometry in `x_t`, so the teacher/fake clean predictions carried a more stable direction. This is specific to the toy distribution: there is less benefit in asking the model to reason from almost pure noise when the relevant structure is simple and low-dimensional.

<div class="media-grid">
  <figure class="media-block">
    <img src="/assets/images/2026-06-07-generative-distillation/distill_nodmd_samples.png" alt="Regression-only one-step student samples">
    <figcaption>Regression-only student. Surprisingly competitive on this target.</figcaption>
  </figure>
  <figure class="media-block">
    <img src="/assets/images/2026-06-07-generative-distillation/distill_dmd_samples.png" alt="DMD plus regression one-step student samples">
    <figcaption>DMD + regression student. Similar global coverage, with different density artifacts.</figcaption>
  </figure>
</div>

#### DMD2

DMD2 modifies the recipe in two important ways: remove the regression loss and add an adversarial loss, while updating the fake denoiser/discriminator on a faster time scale than the generator. The motivation is strong for images. Regression encourages the generator to follow fixed teacher trajectories; a GAN loss instead penalizes samples that leave the real data support, while DMD keeps the score-based distribution-matching pressure.

In this implementation, DMD2 reuses the same training loop with:

- `lambda_reg = null`;
- `lambda_gan > 0`;
- a discriminator implemented as the same MLP family with scalar output;
- multiple fake-denoiser updates per generator update.

<figure class="media-block media-block--medium">
  <img src="/assets/images/2026-06-07-generative-distillation/distill_dmd2_samples.png" alt="DMD2 one-step student samples">
  <figcaption>DMD2-style student with GAN loss and no regression. It improves over the naive one-step teacher, but did not dominate the regression baseline on this toy problem.</figcaption>
</figure>

#### Results

I evaluated each sampler with energy distance and checkerboard occupancy error. Energy distance measures global sample-distribution discrepancy. Occupancy error is total variation distance over the eight active cells plus an inactive-mass bin. Lower is better.

| Sampler | Steps | Energy distance | Occupancy error |
|---|---:|---:|---:|
| Target vs target floor | n/a | 0.00093 ± 0.00067 | 0.01416 ± 0.00365 |
| Gaussian source | 0 | 0.04145 ± 0.00301 | 0.53944 ± 0.00574 |
| DDPM teacher | 1000 | 0.00524 ± 0.00098 | 0.17308 ± 0.00529 |
| Naive teacher | 1 | 3.73497 ± 0.06868 | 0.96144 ± 0.00169 |
| Naive teacher | 4 | 0.14592 ± 0.00582 | 0.59704 ± 0.00987 |
| Regression only | 1 | 0.00334 ± 0.00047 | 0.26860 ± 0.00276 |
| DMD + regression | 1 | 0.00471 ± 0.00108 | 0.31528 ± 0.00593 |
| DMD only | 1 | 1.66849 ± 0.02383 | 0.83412 ± 0.00590 |
| DMD2 | 1 | 0.01071 ± 0.00091 | 0.38040 ± 0.00216 |

The important result is not that DMD2 wins here. It does not. The useful observation is that the toy distribution under-stresses exactly the regime where DMD2 is designed to help.

Natural images occupy tiny, structured regions of a huge ambient space. Modes correspond to semantic and geometric configurations with extremely small volume, and pointwise regression can move samples into visually implausible averages even when the numeric loss is low. Here, each checkerboard mode is a full 2D square with large Lebesgue measure, hard boundaries, and no internal texture. A deterministic MSE transport from Gaussian noise to teacher samples can already map substantial latent regions into substantial target regions. There are no fine visual modes to sharpen and no high-dimensional manifold to stay on.

That explains why the regression-only ablation was competitive. It learned a usable transport because the support was broad and low-dimensional. DMD and DMD2 added the correct distributional machinery, but their extra score-estimation and adversarial components introduced variance that the task did not strongly need. I would expect the balance to change on robotics world-model rollouts or image-like observations, where missing a narrow mode corresponds to losing a physically meaningful future.

[Source code](https://github.com/GauthierBassereau/GenerativeDistillation) ·
[DMD paper](https://arxiv.org/abs/2311.18828) ·
[DMD2 paper](https://arxiv.org/abs/2405.14867)
