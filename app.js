const feedSection = document.getElementById('news-feed');
const navButtons = document.querySelectorAll('nav button');
const searchInput = document.getElementById('search');
const loader = document.getElementById('loader');
const errorDiv = document.getElementById('error');
const darkToggle = document.getElementById('darkToggle');

const rssFeeds = {
  mobiles: 'https://www.gsmarena.com/rss-news-reviews.php3',
  ai: 'https://techcrunch.com/feed/',
  gadgets: 'https://www.theverge.com/rss/index.xml',
  all: [
    'https://www.gsmarena.com/rss-news-reviews.php3',
    'https://techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml'
  ]
};

let articles = []; // All fetched articles
let filteredArticles = []; // Articles after search/category filter
let currentCategory = 'all';
const pageSize = 10;
let page = 1;
let loading = false;
let allLoaded = false;

// Parse RSS XML to array
function parseRSS(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  const items = Array.from(xml.querySelectorAll('item')).map(item => ({
    title: item.querySelector('title')?.textContent || '',
    link: item.querySelector('link')?.textContent || '',
    description: item.querySelector('description')?.textContent || '',
    pubDate: item.querySelector('pubDate')?.textContent || '',
    image: extractImage(item)
  }));
  return items;
}

// Extract image from RSS item
function extractImage(item) {
  let media = item.getElementsByTagName('media:content')[0]?.getAttribute('url');
  if (media) return media;
  let enc = item.getElementsByTagName('enclosure')[0]?.getAttribute('url');
  if (enc) return enc;
  let content = item.getElementsByTagName('content:encoded')[0]?.textContent || '';
  let imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : null;
}

async function fetchFeed(url) {
  try {
    loader.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network error');
    const text = await response.text();
    return parseRSS(text);
  } catch (error) {
    errorDiv.classList.remove('hidden');
    console.error('Failed to fetch feed:', url, error);
    return [];
  } finally {
    loader.classList.add('hidden');
  }
}

async function loadArticles(category) {
  loading = true;
  articles = [];

  if (category === 'all') {
    for (const url of rssFeeds.all) {
      const data = await fetchFeed(url);
      articles = articles.concat(data);
    }
  } else {
    articles = await fetchFeed(rssFeeds[category]);
  }

  // Remove duplicates using link
  const seen = new Set();
  articles = articles.filter(article => {
    if(seen.has(article.link)) return false;
    seen.add(article.link);
    return true;
  });

  // Sort newest first
  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  resetPagination();
  initFuse(); // Search index initialization
  applyFilter(searchInput.value);
  loading = false;
}

function resetPagination() {
  page = 1;
  allLoaded = false;
  feedSection.innerHTML = '';
}

let fuse = null;
// Initialize Fuse.js for fuzzy search
function initFuse() {
  fuse = new Fuse(articles, {
    keys: ['title', 'description'],
    threshold: 0.3
  });
}

function applyFilter(searchText) {
  const filter = searchText.trim();
  if (!filter) {
    filteredArticles = articles;
  } else {
    filteredArticles = fuse.search(filter).map(res => res.item);
  }

  resetPagination();
  loadMore();
}

function loadMore() {
  if (loading || allLoaded) return;

  const start = (page - 1) * pageSize;
  const end = page * pageSize;
  const toLoad = filteredArticles.slice(start, end);

  if (toLoad.length === 0) {
    allLoaded = true;
    return;
  }

  for (const article of toLoad) {
    const articleElem = document.createElement('article');
    articleElem.classList.add('news-article');
    articleElem.innerHTML = `
      ${article.image ? `<img class="news-img" src="${article.image}" alt="Article image" loading="lazy"/>` : ''}
      <h2 class="news-title"><a href="${article.link}" target="_blank" rel="noopener">${article.title}</a></h2>
      <p class="news-desc">${truncateText(stripHTML(article.description), 200)}</p>
      <div class="news-date">${new Date(article.pubDate).toLocaleString()}</div>
    `;
    feedSection.appendChild(articleElem);
  }
  page++;
}

function stripHTML(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

// Infinite scroll event listener
window.addEventListener('scroll', () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
    loadMore();
  }
});

// Nav buttons click
navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if(loading) return;
    navButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.getAttribute('data-cat');
    loadArticles(currentCategory);
    searchInput.value = '';
  });
});

// Search input event
searchInput.addEventListener('input', e => {
  applyFilter(e.target.value);
});

// Dark mode toggle and persistence
darkToggle.addEventListener('click', () => {
  document.body.classList.toggle('theme-light');
  localStorage.setItem('darkMode', document.body.classList.contains('theme-light') ? 'light' : 'dark');
});

// Load saved theme preference
const savedMode = localStorage.getItem('darkMode');
if (savedMode === 'light') {
  document.body.classList.add('theme-light');
} else {
  document.body.classList.remove('theme-light');
}

// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}

// Initial load
loadArticles(currentCategory);
