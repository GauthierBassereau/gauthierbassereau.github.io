---
layout: post
title: Differentiable Lithography Simulator (R&D Internship)
summary: Joined the Resolution Enhancement Technique team. Built a GPU-accelerated, differentiable lithography simulator.
---
<!--more-->

I joined the Resolution Enhancement Technique team at [STMicroelectronics](https://www.st.com) as an R&D intern.  
Due to confidentiality reasons, I won’t be able to share too many technical details, but I’ll outline the general context of my work and what I learned.

---

#### What is Lithography?

Lithography is the process at the heart of semiconductor manufacturing. It’s the method used to transfer intricate patterns from a mask onto a silicon wafer, layer after layer, to eventually build integrated circuits. In practice, this involves shining light through a mask and projecting the image onto a photosensitive resist layer. After exposure and chemical processing, the desired structures remain on the wafer.

The challenge: modern chips pack billions of transistors, each smaller than the wavelength of the light used to print them. This is where **Resolution Enhancement Techniques (RET)** come into play.

A simple way to see the limitation is given by the **Rayleigh criterion** for resolution:

*R = k1 * (lambda / NA)*

where *lambda* is the wavelength of light, *NA* is the numerical aperture of the imaging system, and *k_1* is a process-dependent factor.  
When the feature size approaches or goes below *lambda* / *NA*, the system can no longer sharply resolve it, thus the need for advanced computational techniques to push beyond this optical limit.

---

#### Resolution Enhancement and OPC

When features are smaller than the wavelength of light, distortions inevitably appear. Resolution Enhancement Techniques are methods developed to overcome these optical limits and reliably print sub-wavelength features.

One of the most widely used techniques is **Optical Proximity Correction (OPC)**. Instead of printing the exact target shape, OPC intentionally modifies the mask patterns so that, after light diffraction and resist effects, the wafer ends up with the desired geometry. It’s a bit like pre-warping an image so that it looks correct once projected on a distorted surface.

To achieve this, OPC software requires extremely fast and accurate **lithography simulation**.

---

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
Normally, using the TCC requires large convolution operations. However, I implemented a more efficient approach (from a research paper): applying **Singular Value Decomposition (SVD)** to the TCC, keeping only the most significant components. This reduced computation while retaining most of the accuracy.

I implemented the entire optical model in PyTorch, which gave me a solid foundation in GPU simulation frameworks and helped me write clean, production-quality scientific code.

For the resist stage, I explored multiple approaches:  
- Classical resist models from the literature.  
- Differentiable CNN-based surrogates to approximate chemical processes.  

Both approaches were fully differentiable, making them usable in optimization loops.

---

#### Key Challenges

- **Pattern representation:** Converting between binary masks, sub-pixel representations, and an in-house proprietary format, while preserving gradient flow, was especially tricky. I used techniques like **Straight-Through Estimators (STE)** to handle discrete operations in a differentiable way.  
- **GPU efficiency:** Balancing memory usage and inference speed was critical when scaling to large patterns.  
- **Data scarcity:** Without real-world measurement instruments, I had to rely on synthetic or limited datasets, which added complexity to validation.

---

#### Looking Back

This internship was a fantastic learning experience. It combined physics, math, GPU programming, and deep learning into one project.  

My main interest lies in **robotic intelligence**, where simulators play a central role for training and testing algorithms. Even though this project was in semiconductor manufacturing, I found it highly engaging because it involved building a complex differentiable simulator, a skillset that transfers directly to the world of robotics.  