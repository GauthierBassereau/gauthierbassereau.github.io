---
layout: default
title: Home
---
<ul class="timeline">
{% assign posts_by_date = site.posts | sort: 'date' | reverse %}
{% for post in posts_by_date %}
  <li class="timeline-item">
    <a class="entry-card" href="{{ post.url | relative_url }}" aria-label="Read: {{ post.title }}">
      <span class="dot"></span>
      <div class="entry-top">
        <span class="entry-title">{{ post.title }}</span>
        <span class="entry-date">{{ post.date | date: "%B %-d, %Y" }}</span>
      </div>
      {% assign summary_text = post.summary | default: post.excerpt %}
      {% if summary_text %}
        <p class="entry-summary">{{ summary_text | strip_html | strip_newlines }}</p>
      {% endif %}
    </a>
  </li>
{% endfor %}
</ul>
