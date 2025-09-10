---
layout: default
title: Home
---

<div class="intro">
<p>I work on deep learning and robotics. This site collects projects and experiments. My objective is to be Tony Stark and share what I learn along the way.</p>
</div>

## Posts

<ul class="posts">
{% assign posts_by_date = site.posts | sort: 'date' | reverse %}
{% for post in posts_by_date %}
  <li>
    <span class="date">{{ post.date | date: "%b %d, %Y" }}</span>
    <a href="{{ post.url }}">{{ post.title }}</a>
  </li>
{% endfor %}
</ul>
