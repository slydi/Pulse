document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('pulseForm');
  const container = document.querySelector('.content');

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      username: params.get('username'),
      repo: params.get('repo'),
      tag: params.get('tag')
    };
  }

  function updateUrlParams(username, repo, tag='') {
    const params = new URLSearchParams();
    if(username) params.set('username', username);
    if(repo) params.set('repo', repo);
    if(tag) params.set('tag', tag);
    const newUrl = window.location.origin + window.location.pathname + '?' + params.toString();
    window.history.pushState({}, '', newUrl);
  }

  async function fetchAllReleases(username, repo) {
    let releases = [], page = 1;
    while(true) {
      const res = await fetch(`https://api.github.com/repos/${username}/${repo}/releases?page=${page}&per_page=100`);
      if(res.status === 403) throw new Error('GitHub API rate limit exceeded');
      if(res.status === 404) throw new Error('Repository not found');
      if(!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      if(data.length===0) break;
      releases = releases.concat(data);
      page++;
    }
    return releases;
  }

  function autoFillFromUrl() {
    const {username, repo, tag} = getUrlParams();
    if(username) form.username.value = username;
    if(repo) form.repository.value = repo;
    if(tag) form.releaseTag.value = tag;
    if(username && repo) form.dispatchEvent(new Event('submit'));
  }

  function calculateStatistics(releases) {
    let totalDownloads = 0;
    let totalReactions = 0;
    let totalReleases = releases.length;
    let totalAssets = 0;
    
    releases.forEach(release => {
      const releaseDownloadsCount = release.assets.reduce((sum, asset) => {
        totalAssets++;
        return sum + asset.download_count;
      }, 0);
      
      totalDownloads += releaseDownloadsCount;
      totalReactions += release.reactions ? release.reactions.total_count : 0;
    });
    
    return {
      totalDownloads,
      totalReactions,
      totalReleases,
      totalAssets
    };
  }

  function renderStatistics(stats, releases) {
     const statsSection = document.createElement('div');
     statsSection.className = 'statistics-section';
     statsSection.innerHTML = `
         <div class="stat-card">
             <div class="stat-content">
                 <div class="stat-item">
                     <i class="fas fa-download stat-icon"></i>
                     <div class="stat-main-value">${stats.totalDownloads.toLocaleString()}</div>
                     <div class="stat-label">Total Downloads</div>
                     <div class="stat-description">
                         ${stats.totalReleases} releases<br>
                         ${stats.totalAssets} assets
                     </div>
                 </div>
                 <div class="stat-item">
                     <i class="fas fa-heart stat-icon"></i>
                     <div class="stat-main-value">${stats.totalReactions.toLocaleString()}</div>
                     <div class="stat-label">Total Reactions</div>
                     <div class="stat-description">
                         ${releases.filter(r => r.reactions).length} releases<br>
                         with reactions
                     </div>
                 </div>
             </div>
         </div>
     `;
     
     container.appendChild(statsSection);
  }

  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function renderReleases(releases, tag = '') {
    releases = releases.filter(r => r.assets && r.assets.length > 0);
    if (releases.length === 0) {
        throw new Error(`No releases with files found${tag ? ` for tag "${tag}"` : ''}`);
    }

    if (tag) {
        releases = releases.filter(r => r.tag_name === tag);
        if (releases.length === 0) {
            throw new Error(`No releases with files found${tag ? ` for tag "${tag}"` : ''}`);
        }
    }

    const stats = calculateStatistics(releases);
    
    container.innerHTML = '';
    renderStatistics(stats, releases);
    
    releases.forEach((r, i) => {
        const card = document.createElement('div');
        card.className = 'release-card';

        card.innerHTML = `
            <div class="release-header">
                <a href="https://github.com/${r.author.login}/${form.repository.value.trim()}/releases/tag/${r.tag_name}" 
                   target="_blank" 
                   class="version-link">
                    <span class="version">${r.tag_name}</span>
                </a>
            <div class="header-right">
              ${i===0 && !tag ? '<span class="latest-label"><i class="fas fa-star"></i> Latest</span>' 
                : r.prerelease 
                  ? '<span class="pre-label"><i class="fas fa-flask"></i> Pre-release</span>'
                  : '<span class="release-label"><i class="fas fa-check-circle"></i> Release</span>'}
            </div>
            </div>
            <div class="release-meta">
            <div class="release-meta-left">
              <a href="https://github.com/${r.author.login}" target="_blank" class="author-link">
                <span class="release-author">
                  <img src="${r.author.avatar_url}" alt="${r.author.login}" class="author-avatar">
                  <span class="author-name">${r.author.login}</span>
                  </span>
              </a>
                <span class="release-date">
                  <i class="fas fa-calendar-alt"></i> Date: ${new Date(r.published_at).toLocaleDateString()}
                </span>
              </div>
              <span class="release-size">
                <i class="fas fa-database"></i> Size: ${formatSize(r.assets.reduce((acc, a) => acc + a.size, 0))}
              </span>
            </div>
            <div class="file-list">
                <div class="file-list-header">
                    <span class="files-title"><i class="fas fa-cube"></i> Assets</span>
                    <span class="files-title-downloads"><i class="fas fa-download"></i> ${r.assets.reduce((acc,a)=>acc+a.download_count,0)}</span>
                </div>
                ${r.assets.map(f=>`<div class="file-item"><a href="${f.browser_download_url}" target="_blank">${f.name}</a><span>${f.download_count}</span></div>`).join('')}
            </div>
            ${r.reactions ? `
            <div class="reactions-section">
                <div class="file-list-header">
                    <span class="files-title"><i class="fas fa-bell"></i> Reactions</span>
                    <span class="files-title-downloads"><i class="fas fa-heart"></i> ${r.reactions.total_count}</span>
                </div>
                <div class="reactions-items">
                    ${r.reactions['+1'] ? `<span><i class="fas fa-thumbs-up" style="color:#a4d7f4; filter: drop-shadow(0 0 8px rgba(164, 215, 244, 0.2));"></i> ${r.reactions['+1']}</span>` : ''}
                    ${r.reactions['-1'] ? `<span><i class="fas fa-thumbs-down" style="color:#a4d7f4; filter: drop-shadow(0 0 8px rgba(164, 215, 244, 0.2));"></i> ${r.reactions['-1']}</span>` : ''}
                    ${r.reactions.laugh ? `<span><i class="fas fa-smile" style="color:#a4d7f4; filter: drop-shadow(0 0 8px rgba(164, 215, 244, 0.2));"></i> ${r.reactions.laugh}</span>` : ''}
                    ${r.reactions.hooray ? `<span><i class="fas fa-hands-clapping" style="color:#a4d7f4; filter: drop-shadow(0 0 8px rgba(164, 215, 244, 0.2));"></i> ${r.reactions.hooray}</span>` : ''}
                    ${r.reactions.confused ? `<span><i class="fas fa-surprise" style="color:#a4d7f4; filter: drop-shadow(0 0 8px rgba(164, 215, 244, 0.2));"></i> ${r.reactions.confused}</span>` : ''}
                    ${r.reactions.heart ? `<span><i class="fas fa-heart" style="color:#a4d7f4; filter: drop-shadow(0 0 8px rgba(164, 215, 244, 0.2));"></i> ${r.reactions.heart}</span>` : ''}
                    ${r.reactions.rocket ? `<span><i class="fas fa-rocket" style="color:#a4d7f4; filter: drop-shadow(0 0 8px rgba(164, 215, 244, 0.2));"></i> ${r.reactions.rocket}</span>` : ''}
                    ${r.reactions.eyes ? `<span><i class="fas fa-eye" style="color:#a4d7f4; filter: drop-shadow(0 0 8px rgba(164, 215, 244, 0.2));"></i> ${r.reactions.eyes}</span>` : ''}
                </div>
            </div>` : ''}
        `;
        container.appendChild(card);
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault(); 
    const glassWindow = document.querySelector('.glass-window');  
    glassWindow.classList.remove('shimmer-once');
    void glassWindow.offsetWidth;
    glassWindow.classList.add('shimmer-once');  
    const username = form.username.value.trim();
    const repo = form.repository.value.trim();
    const tag = form.releaseTag.value.trim(); 
    updateUrlParams(username, repo, tag);
    container.innerHTML = '<div class="loader"><div class="loader-spinner"></div></div>'; 
    try {
      const releases = await fetchAllReleases(username, repo);
      renderReleases(releases, tag);
    } catch(err) {
      container.innerHTML = `<p style="text-align:center; color: #a4d7f4;">${err.message}</p>`;
    }
  }); 
    autoFillFromUrl();

  const scrollBtn = document.getElementById('scrollTopBtn');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) { scrollBtn.classList.add('show'); } 
    else { scrollBtn.classList.remove('show'); }
  });

  scrollBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
});