---
layout: default
title: Home
---
{% assign projects = site.projects | sort: "home_rank" %}

<section class="project-list" aria-label="Projects">
{% for post in projects %}
{% assign thumbnail_path = post.thumbnail | default: "" %}
{% assign thumbnail_ext = thumbnail_path | split: "?" | first | split: "#" | first | split: "." | last | downcase %}
{% assign is_gif_thumbnail = false %}
{% if thumbnail_ext == "gif" %}
{% assign is_gif_thumbnail = true %}
{% endif %}
{% assign still_thumbnail = thumbnail_path %}
{% if is_gif_thumbnail %}
{% assign still_thumbnail = post.thumbnail_still | default: "" %}
{% if still_thumbnail == "" %}
{% assign still_thumbnail = thumbnail_path | replace: ".gif", "-still.png" | replace: ".GIF", "-still.png" %}
{% endif %}
{% endif %}
<article class="project-row"
{% if is_gif_thumbnail %}
data-still-thumbnail="{{ still_thumbnail | relative_url }}"
data-animated-thumbnail="{{ post.thumbnail | relative_url }}"
onmouseenter="this.querySelector('.project-thumb img').src=this.dataset.animatedThumbnail"
onmouseleave="this.querySelector('.project-thumb img').src=this.dataset.stillThumbnail"
onfocusin="this.querySelector('.project-thumb img').src=this.dataset.animatedThumbnail"
onfocusout="if (!this.contains(event.relatedTarget)) this.querySelector('.project-thumb img').src=this.dataset.stillThumbnail"
{% endif %}>
<a class="project-row__link" href="{{ post.url | relative_url }}" aria-label="Read writeup: {{ post.title }}"></a>
<div class="project-thumb{% if is_gif_thumbnail %} project-thumb--gif{% endif %}">
{% if post.thumbnail %}
{% if is_gif_thumbnail %}
<img src="{{ still_thumbnail | relative_url }}" alt="{{ post.thumbnail_alt }}" loading="lazy" decoding="async">
{% else %}
<img src="{{ post.thumbnail | relative_url }}" alt="{{ post.thumbnail_alt }}" loading="lazy" decoding="async">
{% endif %}
{% else %}
<span class="project-thumb__placeholder">
Confidential project
</span>
{% endif %}
</div>
<div class="project-info">
<p class="project-meta">{{ post.eyebrow }} · {{ post.date | date: "%B %-d, %Y" }}</p>
<h2>{{ post.title }}</h2>
<p class="project-summary">{{ post.summary }}</p>
{% if post.tags %}
<ul class="tag-list" aria-label="Technologies">
{% for tag in post.tags %}
<li>{{ tag }}</li>
{% endfor %}
</ul>
{% endif %}
{% if post.links %}
<div class="project-links">
{% for link in post.links limit: 3 %}
<a href="{{ link.url }}">{{ link.label }}</a>
{% endfor %}
</div>
{% endif %}
</div>
</article>
{% endfor %}
</section>
