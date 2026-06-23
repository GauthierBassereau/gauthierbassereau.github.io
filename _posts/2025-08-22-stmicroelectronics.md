---
layout: post
title: Differentiable Lithography Simulator
summary: Built a GPU-accelerated, differentiable lithography simulator.
home_rank: 4
eyebrow: Research Internship
impact: Built differentiable optics and resist simulation components in PyTorch for GPU-accelerated computational lithography research.
tags:
  - Scientific ML
  - GPU simulation
  - Differentiable physics
  - PyTorch
  - Optimization
metrics:
  - In-house simulator
  - SVD optics
  - Gradient-based ILT
links:
  - label: STMicroelectronics
    url: https://www.st.com
  - label: Reference
    url: https://arxiv.org/html/2409.15306v1
---
<!--more-->

I joined the Resolution Enhancement Technique team at [STMicroelectronics](https://www.st.com) as an R&D intern.  
Due to confidentiality reasons, I won’t be able to share too many technical details, but I’ll outline the general context of my work and what I learned.

---

The challenge: modern chips pack billions of transistors, each smaller than the wavelength of the light used to print them. This is where **Resolution Enhancement Techniques (RET)** come into play.

A simple way to see the limitation is given by the **Rayleigh criterion** for resolution:

*R = k1 * (lambda / NA)*

where *lambda* is the wavelength of light, *NA* is the numerical aperture of the imaging system, and *k_1* is a process-dependent factor.  
When the feature size approaches or goes below *lambda* / *NA*, the system can no longer sharply resolve it, thus the need for advanced computational techniques to push beyond this optical limit.

#### Resolution Enhancement and OPC

When features are smaller than the wavelength of light, distortions inevitably appear. Resolution Enhancement Techniques are methods developed to overcome these optical limits and reliably print sub-wavelength features.

One of the most widely used techniques is **Optical Proximity Correction (OPC)**. Instead of printing the exact target shape, OPC intentionally modifies the mask patterns so that, after light diffraction and resist effects, the wafer ends up with the desired geometry. It’s a bit like pre-warping an image so that it looks correct once projected on a distorted surface.

To achieve this, OPC software requires extremely fast and accurate **lithography simulation**.

#### Lithography Simulation

Lithography simulators model two key stages:
1. **Optics:** How light propagates through the mask and imaging system.  
2. **Resist:** How the photosensitive layer chemically reacts to the light.

By simulating both, OPC tools can iteratively refine the mask until the final wafer patterns match the target.  

These simulations are computationally heavy because of the sheer size of the patterns involved. Traditional CAD vendors rely on CPU based parallelization, but recent research—particularly from NVIDIA, has shown that **GPU acceleration** can bring significant speedups.

---

#### Building a Differentiable Simulator

During my 4 months, I built an **in-house, GPU-accelerated lithography simulator** in PyTorch. The goal was not only to simulate the process but to make it **differentiable**, opening the door to gradient-based optimization of OPC algorithms.

On the optics side, I studied **Hopkins’ model**, one of the most accurate ways to represent partially coherent imaging. The model relies on the **Transmission Cross Coefficient (TCC)**, which describes interactions between spatial frequencies of the mask.  
Normally, using the TCC requires large convolution operations. However, I implemented a more efficient approach (from [paper_link](https://arxiv.org/html/2409.15306v1)): applying **Singular Value Decomposition (SVD)** to the TCC, keeping only the most significant components. This reduced computation while retaining most of the accuracy.

I implemented the entire optical model in PyTorch, which gave me a solid foundation in GPU simulation frameworks and helped me write clean, production-quality scientific code.

For the resist stage, I explored multiple approaches:  
- Classical resist models from the literature.
- Differentiable CNN-based surrogates to approximate chemical processes.  

Both approaches were made fully differentiable, I was able to train a resist model on synthetic data with good results, but also implement an ILT (Inverse Lithography Technology) algorithm to correct mask patterns by optimization, via gradient descent.

#### Key Challenges

- **Pattern representation:** Converting between binary masks, sub-pixel representations, and an in-house proprietary format, while preserving gradient flow, was especially tricky. I used techniques like **Straight-Through Estimators (STE)** to handle discrete operations in a differentiable way.  
- **GPU efficiency:** Balancing memory usage and inference speed was critical when scaling to large patterns.  
- **Data scarcity:** Without real-world measurement instruments, I had to rely on synthetic or limited datasets, which added complexity to validation.

---

I am unable to share any results, but I really enjoyed working on this project. It combined physics, math, GPU programming, and deep learning into one project.
