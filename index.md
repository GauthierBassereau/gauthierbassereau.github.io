---
layout: default
title: Home
---
{% assign projects = site.posts | sort: "home_rank" %}

<section class="proof-strip" aria-label="Portfolio highlights">
  <div>
    <span class="proof-value">400M</span>
    <span class="proof-label">parameter world model</span>
  </div>
  <div>
    <span class="proof-value">1,000h</span>
    <span class="proof-label">passive video mixed into training</span>
  </div>
  <div>
    <span class="proof-value">Real robot</span>
    <span class="proof-label">closed-loop policy deployment</span>
  </div>
  <div>
    <span class="proof-value">GPU</span>
    <span class="proof-label">differentiable simulation</span>
  </div>
</section>

{% for post in projects %}
  {% if post.home_featured %}
    <section class="featured-project" aria-labelledby="featured-project-title">
      <div class="section-label">Featured project</div>
      <article class="featured-card">
        <a class="featured-media" href="{{ post.url | relative_url }}" aria-label="Read: {{ post.title }}">
          <img src="{{ post.thumbnail | relative_url }}" alt="{{ post.thumbnail_alt }}">
        </a>
        <div class="featured-copy">
          <p class="project-eyebrow">{{ post.eyebrow }}</p>
          <h2 id="featured-project-title">
            <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
          </h2>
          <p class="project-impact">{{ post.impact }}</p>
          <ul class="metric-list">
            {% for metric in post.metrics %}
              <li>{{ metric }}</li>
            {% endfor %}
          </ul>
          <ul class="tag-list" aria-label="Technologies">
            {% for tag in post.tags %}
              <li>{{ tag }}</li>
            {% endfor %}
          </ul>
          <div class="project-links">
            <a class="primary-link" href="{{ post.url | relative_url }}">Read writeup</a>
            {% for link in post.links %}
              <a href="{{ link.url }}">{{ link.label }}</a>
            {% endfor %}
          </div>
        </div>
      </article>
    </section>
  {% endif %}
{% endfor %}

<section class="project-section" aria-labelledby="project-section-title">
  <div class="section-heading">
    <div>
      <div class="section-label">Selected work</div>
      <h2 id="project-section-title">Projects with implementation details, results, and code.</h2>
    </div>
    <a class="section-action" href="/assets/CV/Gauthier_Bassereau_RESUME.pdf">Resume</a>
  </div>

  <div class="project-grid">
    {% for post in projects %}
      {% unless post.home_featured %}
        <article class="project-card">
          {% if post.thumbnail %}
            <a class="project-media" href="{{ post.url | relative_url }}" aria-label="Read: {{ post.title }}">
              <img src="{{ post.thumbnail | relative_url }}" alt="{{ post.thumbnail_alt }}">
            </a>
          {% else %}
            <a class="project-media project-media--confidential" href="{{ post.url | relative_url }}" aria-label="Read: {{ post.title }}">
              <span>{{ post.eyebrow }}</span>
              <strong>Differentiable lithography</strong>
            </a>
          {% endif %}
          <div class="project-card__body">
            <p class="project-eyebrow">{{ post.eyebrow }}</p>
            <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
            <p>{{ post.impact }}</p>
            <ul class="tag-list" aria-label="Technologies">
              {% for tag in post.tags %}
                <li>{{ tag }}</li>
              {% endfor %}
            </ul>
            <div class="project-links">
              <a class="primary-link" href="{{ post.url | relative_url }}">Read writeup</a>
              {% for link in post.links limit: 2 %}
                <a href="{{ link.url }}">{{ link.label }}</a>
              {% endfor %}
            </div>
          </div>
        </article>
      {% endunless %}
    {% endfor %}
  </div>
</section>

<section class="focus-section" aria-labelledby="focus-title">
  <div>
    <div class="section-label">Focus</div>
    <h2 id="focus-title">Robot learning systems that connect models, data, and hardware.</h2>
  </div>
  <div class="focus-grid">
    <div>
      <span>01</span>
      <p>Training generative and representation-based models for long-horizon robot prediction.</p>
    </div>
    <div>
      <span>02</span>
      <p>Deploying visuomotor policies into real-time robot perception and control pipelines.</p>
    </div>
    <div>
      <span>03</span>
      <p>Building GPU-accelerated scientific ML tools where differentiability changes the workflow.</p>
    </div>
  </div>
</section>
