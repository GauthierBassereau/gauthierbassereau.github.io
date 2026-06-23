---
layout: default
title: Home
---
{% assign projects = site.posts | sort: "home_rank" %}

<section class="project-list" aria-label="Projects">
{% for post in projects %}
<article class="project-row">
<a class="project-thumb" href="{{ post.url | relative_url }}" aria-label="Read: {{ post.title }}">
{% if post.thumbnail %}
<img src="{{ post.thumbnail | relative_url }}" alt="{{ post.thumbnail_alt }}">
{% else %}
<span class="project-thumb__placeholder">
Confidential project
</span>
{% endif %}
</a>
<div class="project-info">
<p class="project-meta">{{ post.eyebrow }} · {{ post.date | date: "%B %-d, %Y" }}</p>
<h2><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
<p class="project-summary">{{ post.summary }}</p>
{% if post.tags %}
<ul class="tag-list" aria-label="Technologies">
{% for tag in post.tags %}
<li>{{ tag }}</li>
{% endfor %}
</ul>
{% endif %}
<div class="project-links">
<a class="primary-link" href="{{ post.url | relative_url }}">Writeup</a>
{% for link in post.links limit: 3 %}
<a href="{{ link.url }}">{{ link.label }}</a>
{% endfor %}
</div>
</div>
</article>
{% endfor %}
</section>
