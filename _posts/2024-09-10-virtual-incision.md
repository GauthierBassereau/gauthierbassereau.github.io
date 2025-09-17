---
layout: post
title: Surgical Robot Imitation Learning (R&D Internship)
summary: Developed an Action Chunking Transformer for a dual-arm surgical robot, trained for tasks like needle pick and hand-off. The policy was deployed for real-time inference on an NVIDIA Holoscan pipeline.
---
<!--more-->

I had the incredible opportunity to spend 4 months at [Virtual Incision](https://virtualincision.com), a surgical robotics company in Lincoln, Nebraska.  
Their flagship robot, MIRA (Miniaturized In Vivo Robotic Assistant), is designed to make minimally invasive surgery more accessible worldwide. Unlike the massive, expensive robotic platforms you typically see in big hospitals, MIRA is portable and more affordable.

---

When I arrived at Virtual Incision, I didn’t have much of a background in deep learning. My experience was limited to small personal projects in computer vision. My first assignment was a real-time image super-resolution project using [NVIDIA Holoscan](https://www.nvidia.com/en-eu/edge-computing/holoscan/). This was a perfect introduction: hands-on, challenging, and a crash course in working directly with cutting-edge medical hardware.

After that, with the R&D team, we started discussing the most ambitious directions we could take. That’s when we came across a paper from Intuitive that applied transformers to imitation learning for surgical robotics (application of the ACT paper to surgical robotics). It was exactly the kind of challenge I wanted to dive into.

#### Why Imitation Learning and ACT?

There are many ways to approach robot learning: reinforcement learning, model-based control, predictive control, and more. But imitation learning stood out because of its data efficiency and the recent release of the [Action Chunking Transformer](https://arxiv.org/abs/2304.13705) (ACT) paper, which showed impressive capabilities.

What makes ACT interesting is its ability to capture multimodal behaviors. A single task, like opening a door, can be done in multiple valid ways (left hand or right hand). A naïve model would average those demonstrations and end up with something unusable. ACT avoids that pitfall by modeling multiple modes of behavior—a capability that has since influenced many state-of-the-art action models. Today, nearly every imitation learning robot policy (e.g., VLAs, LBMs) uses a flow-matching or diffusion framework, which is one of the best ways to model this.

#### Building the Proof of Concept

The goal wasn’t to build something production-ready, but to show what could be possible.

- **Data Collection:** With the help of Evan, I set up a pipeline to record camera feeds and timestamps while I teleoperated MIRA. I then used MIRA's logs to retrieve joint positions and corresponding timestamps, and finally synced images and joint values together. In total, I recorded ~70 demonstrations of needle pick-and-place and hand-off tasks.
- **Data Preprocessing:** Wrote a few scripts to clean up the data, segment demonstrations, and prepare it for training.
- **ACT from scratch:** Implemented the ACT model in PyTorch.
- **Model Training:** Using an NVIDIA 3090, I trained the policy on this dataset. Despite the limited hardware, I managed to get a working model with mixed-precision training.
- **Deployment:** Finally, I integrated the trained policy into a Holoscan operator for real-time inference, and for the first time, MIRA moved entirely on its own. Watching it autonomously pick up a needle and pass it between its arms was an incredible moment.

[GitHub repo link](https://github.com/GauthierBassereau/Surgical-Robot-Imitation-Learning)

#### Looking Back

This incredible experience was entirely made possible by [Jay Carlson](https://www.linkedin.com/in/jay-d-carlson/), my supervisor, who also became a great friend. I cannot thank him enough for giving me the purpose and determination that I have today because of this experience.

---

#### Illustrations
 
<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://youtu.be/wZuMUCP2N-o" target="_blank">
        <img src="https://img.youtube.com/vi/wZuMUCP2N-o/hqdefault.jpg" alt="Video demo thumbnail" width="360">
      </a><br>
      <sub><em>Autonomous needle pick-and-hand-off demo (click to watch)</em></sub>
    </td>
    <td align="center" width="50%">
      <img src="/assets/images/2024-09-10-virtual-incision/university_presentation.jpg" alt="Team photo" width="360"><br>
      <sub><em>My work presented at Lincoln's University</em></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="/assets/images/2024-09-10-virtual-incision/Mira.jpeg" alt="MIRA robot" width="360"><br>
      <sub><em>MIRA surgical robot</em></sub>
    </td>
    <td align="center" width="50%">
      <img src="/assets/images/2024-09-10-virtual-incision/teleop.jpeg" alt="Teleoperation setup" width="360"><br>
      <sub><em>Teleoperation device used for data collection</em></sub>
    </td>
  </tr>
</table>