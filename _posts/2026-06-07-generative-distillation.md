---
layout: post
title: Few-Step Generative Distillation on a 2D Diffusion Teacher
summary: DMD and DMD2 distillation of a DDPM teacher into a one-step generator on a Gaussian-to-checkerboard transport task.
---
<!--more-->

This was a personal project in the continuation of my work on diffusion world models for robotics. The question is simple: if a diffusion model needs hundreds of denoising steps to sample well, what objective should be used to compress it into one step without destroying the distribution?

The distillation losses come directly from [DMD](https://arxiv.org/abs/2311.18828) and [DMD2](https://arxiv.org/abs/2405.14867). The goal was to reproduce the gradients cleanly, understand what each loss is really pushing on, and see where they behave differently on a controlled distribution.

I kept the setting in 2D so the failure modes are visible instead of hidden behind image quality. The source distribution is an isotropic Gaussian `π0`; the target `π1` is uniform over eight active cells of a 4×4 checkerboard. I first trained a DDPM teacher, then distilled it into one-step students with regression, DMD, and DMD2-style losses.

<figure class="media-block media-block--medium">
  <img src="/assets/images/2026-06-07-generative-distillation/data_source_target.png" alt="Gaussian source samples overlaid with checkerboard target samples">
  <figcaption>Source and target distributions. The target is multimodal, but each mode has large 2D support rather than occupying a tiny high-dimensional image manifold.</figcaption>
</figure>

#### Teacher model

The teacher is a DDPM with an MLP noise predictor conditioned on sinusoidal timestep embeddings. Training used the standard epsilon-prediction objective:

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

#### What the distillation losses are doing

The simplest distillation baseline is to precompute pairs `(z, x_teacher)` by running the teacher from Gaussian noise `z`, then train the student with MSE:

<div class="technical-equation">
  <code>L_reg = || G_theta(z) - DDIM_teacher(z) ||^2</code>
</div>

This loss is important because it gives a transport signal. If a region of Gaussian noise is supposed to end in the top-right square, the regression pair creates a direct gradient from the current student output toward that teacher endpoint. It prevents the generator from freely putting too much mass into a single convenient region, because every latent sample has an assigned destination.

But regression is also a teacher-imitation loss. It is upper-bounded by the teacher trajectory used to generate the pairs. If the teacher has artifacts, bad density, or arbitrary DDIM transport choices, the student is trained to reproduce them. In image generation this is even worse: a pointwise loss can be numerically small while still producing samples that are not on the real image manifold.

DMD changes the supervision signal. Instead of asking whether a generated sample matches its paired teacher output, it asks whether the student distribution has the same score field as the teacher distribution. For a generated sample `x = G_theta(z)`, I re-noise it to `x_t`, evaluate two denoisers, and use their clean-sample predictions as a score-difference proxy:

<div class="technical-equation">
  <code>x_real = x0_hat_teacher(x_t, t)</code><br>
  <code>x_fake = x0_hat_fake(x_t, t)</code><br>
  <code>grad_DMD ~= (x_fake - x_real) / || x - x_real ||</code>
</div>

The teacher denoiser is frozen and represents the target distribution. The fake denoiser is trained online on student samples and represents the current generator distribution. Their difference estimates how the generator should move samples to reduce distribution mismatch. I used the usual stop-gradient target trick:

<div class="technical-equation">
  <code>target = stopgrad(x - grad_DMD)</code><br>
  <code>L_DMD = 0.5 || x - target ||^2</code>
</div>

DMD alone is not enough. The KL direction behind this kind of score-distillation objective is mode-seeking: it can strongly penalize samples that lie in low teacher-density regions, but missing modes do not automatically create gradients because the generator never samples there. If the student collapses much of its mass into a sharp blob inside one valid square, that blob is not obviously wrong from the point of view of the local DMD update. The absent squares are absent; they do not push back.

This is where the regression loss is useful. It builds a gradient bridge from each source sample to a teacher endpoint. A collapse cannot stay isolated because many regression pairs still point outside the collapsed region. The stable Stage A objective was therefore:

<div class="technical-equation">
  <code>L_stageA = lambda_dmd L_DMD + lambda_reg L_reg</code>
</div>

The point is not that regression is more principled. It is less principled. But it supplies the low-variance transport constraint that pure DMD is missing.

#### Stabilizing the DMD update

The DMD loss was the least forgiving part. The clean prediction

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

#### Why DMD2 replaces regression with GAN

DMD2 makes the same correction, but without capping the student at the teacher's pairwise samples. It removes the regression term and adds a GAN loss against real target samples:

<div class="technical-equation">
  <code>L_stageB = lambda_dmd L_DMD + lambda_gan L_GAN</code>
</div>

The role of the GAN loss is close to the role regression played above: punish pathological mass placement that the DMD/KL term may tolerate. The difference is that the discriminator is anchored to the real data distribution, not to teacher-generated endpoints. In principle this is better: the student can be pushed toward reality even if the teacher transport is imperfect.

The price is stability. Once regression is removed, there is no fixed pairwise target holding the generator in place. The fake denoiser must track a student distribution that is moving during training, and stale fake scores give bad DMD gradients. This is why DMD2 uses a two-time-scale update: several fake-denoiser updates for each generator update, so the fake denoiser follows the current student distribution closely enough before its score difference is used.

For this 2D run, I kept the adversarial part deliberately small:

- `lambda_reg = null`;
- `lambda_gan > 0`;
- a simple MLP discriminator with scalar output;
- 10 fake-denoiser updates per generator update.

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

The important result is not that DMD2 wins here. It does not. That is the interesting part.

The checkerboard is multimodal, but it is not image-like. Natural images occupy tiny, structured regions of a huge ambient space. Modes correspond to semantic and geometric configurations with extremely small volume. If a generator misses one of those regions, regression and KL-type objectives can give a misleading sense of progress because most of the ambient space is already invalid.

Here, each mode is a full 2D square with large Lebesgue measure. The target support is not a thin manifold; it is eight fat boxes. A deterministic MSE transport from Gaussian noise to teacher samples can already map large latent regions into large target regions. There is no texture to sharpen, no semantic submode to recover, and no high-dimensional manifold constraint.

That explains why regression-only was competitive in my runs. It learned a usable transport because the support was broad and low-dimensional. DMD and DMD2 add the machinery I care about for harder settings, but on this toy problem their score-estimation and adversarial variance are not strongly compensated by the data geometry. I would expect the balance to change on diffusion world-model rollouts or image-like robot observations, where missing a narrow mode means losing a physically meaningful future.

[Source code](https://github.com/GauthierBassereau/GenerativeDistillation) ·
[DMD paper](https://arxiv.org/abs/2311.18828) ·
[DMD2 paper](https://arxiv.org/abs/2405.14867)
